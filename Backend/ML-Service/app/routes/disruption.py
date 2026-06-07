from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..services.redis_service import redis_client
from ..services.disruption_service import build_disruption_array
from ..utils.geo_utils import calculate_distance

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
    """If no real disruptions were detected, return demo sample data."""
    return disruptions if disruptions else MOCK_DISRUPTIONS

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
