from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..services.redis_service import redis_client
from ..services.disruption_service import build_disruption_array
from ..utils.geo_utils import calculate_distance, reverse_geocode_coords

router = APIRouter()

# Sample mock disruptions used as a demo fallback when no real disruptions are detected.
MOCK_DISRUPTIONS = [
    {"time": "03:00-05:00", "type": "rain", "level": "heavy"},
    {"time": "19:00-24:00", "type": "rain", "level": "medium"}
]

class DisruptionRequest(BaseModel):
    user_id: Optional[str] = None
    pincode: str
    lat: float
    lng: float
    date: str

def _apply_mock_if_empty(disruptions: list) -> list:
    """Return actual disruptions directly without mock fallbacks."""
    return disruptions

@router.post("/zone-disruptions")
def get_zone_disruptions(req: DisruptionRequest):
    pattern = f"disruptions:{req.date}:*"
    all_keys = redis_client.keys(pattern)
    
    matches = []
    for key in all_keys:
        cached_data = redis_client.get(key)
        if cached_data and "lat" in cached_data and "lng" in cached_data:
            dist = calculate_distance(req.lat, req.lng, cached_data["lat"], cached_data["lng"])
            if dist <= 2.5: # 2.5km radius = 5km diameter
                matches.append(cached_data)

    if len(matches) == 1:
        # Exactly 1 match in 5km diameter -> fetch from cache
        cached_data = matches[0]
        disruptions = _apply_mock_if_empty(cached_data.get("disruptions", []))
        return {
            "user_id": req.user_id,
            "source": "cache",
            "date": req.date,
            "zone": cached_data.get("zone", req.pincode),
            "disruptions": disruptions
        }
        
    # If >= 2 matches (conflict) or 0 matches -> calculate fresh from API
    fresh_data = build_disruption_array(
        lat=req.lat,
        lng=req.lng,
        date=req.date,
        pincode=req.pincode
    )
    
    # Cache key using specific lat/lng
    redis_key = f"disruptions:{req.date}:{req.lat}_{req.lng}"
    redis_client.set(redis_key, fresh_data, ttl=1800)
    
    disruptions = _apply_mock_if_empty(fresh_data.get("disruptions", []))
    return {
        "user_id": req.user_id,
        "source": "computed",
        "date": req.date,
        "zone": fresh_data.get("zone", req.pincode),
        "disruptions": disruptions
    }


@router.get("/geocode")
def geocode_city(city: str):
    import requests
    import urllib.parse
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(city)}&format=json&limit=1&addressdetails=1"
        headers = {
            'User-Agent': 'RideShield-ML-Service/1.0'
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                addr = data[0].get("address", {})
                postcode = addr.get("postcode", "")
                return {
                    "lat": float(data[0]["lat"]),
                    "lng": float(data[0]["lon"]),
                    "pincode": postcode,
                    "success": True
                }
    except Exception as e:
        logger.error(f"Geocoding endpoint error: {e}")
        
    return {
        "success": False,
        "error": "Could not resolve city coordinates."
    }


@router.get("/reverse")
def reverse_geocode(lat: float, lng: float):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        geo = reverse_geocode_coords(lat, lng)
        city_val = geo.get("city") or "Live GPS Location"
        return {
            "city": city_val,
            "pincode": geo.get("pincode") or "",
            "success": True
        }
    except Exception as e:
        logger.error(f"Reverse geocoding endpoint error: {e}")
        
    return {
        "success": False,
        "error": "Could not reverse geocode coordinates."
    }


@router.get("/news-alerts")
def get_news_alerts(city: str, date: str):
    import logging
    logger = logging.getLogger(__name__)
    from ..services.news_service import get_local_news
    
    try:
        geo_res = geocode_city(city)
        if geo_res.get("success"):
            lat = geo_res["lat"]
            lng = geo_res["lng"]
            pincode = geo_res.get("pincode", "")
            
            articles = get_local_news(lat=lat, lng=lng, date=date, pincode=pincode)
            return {
                "success": True,
                "city": city,
                "date": date,
                "alerts": articles
            }
    except Exception as e:
        logger.error(f"Failed to fetch news alerts for city {city}: {e}")
        
    return {
        "success": False,
        "alerts": [],
        "error": f"Failed to retrieve news alerts for {city}."
    }


