import requests
import logging
import math

logger = logging.getLogger(__name__)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Haversine formula to return distance in km
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance


def reverse_geocode_coords(lat: float, lng: float) -> dict:
    """
    Reverse geocodes coordinates to address components using OSM Nominatim API.
    Caches the results in Redis (7 days TTL) with key rounded to 4 decimals.
    """
    from ..services.redis_service import redis_client
    
    lat_r = round(lat, 4)
    lng_r = round(lng, 4)
    cache_key = f"geo:reverse:{lat_r}_{lng_r}"
    
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return cached
    except Exception as cache_err:
        logger.warning(f"Failed to check geocode cache: {cache_err}")

    result = {"city": "", "state": "", "country": "", "pincode": ""}
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}"
        headers = {
            'User-Agent': 'RideShield-ML-Service/1.0'
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            address = data.get("address", {})
            city_val = (
                address.get("city") or
                address.get("town") or
                address.get("municipality") or
                address.get("village") or
                address.get("county") or
                address.get("state_district") or
                address.get("district") or
                ""
            )
            state = address.get("state", "")
            country = address.get("country", "")
            postcode = address.get("postcode", "")
            
            result = {
                "city": city_val,
                "state": state,
                "country": country,
                "pincode": postcode
            }
            
            try:
                redis_client.set(cache_key, result, ttl=604800) # 7 days
            except Exception as cache_set_err:
                logger.warning(f"Failed to set geocode cache: {cache_set_err}")
    except Exception as e:
        logger.error(f"Nominatim reverse API error: {e}")
        
    return result


def get_zone_name(lat: float, lng: float, fallback_pincode: str):
    """
    Resolves zone/city name using OSM Nominatim API via the cached wrapper.
    Prioritizes fallback_pincode if it is a valid postcode to respect driver location simulation overrides.
    """
    geo = reverse_geocode_coords(lat, lng)
    place = (
        geo.get("city") or
        geo.get("state") or
        geo.get("country") or
        "Unknown"
    )
    postcode = fallback_pincode if (fallback_pincode and str(fallback_pincode).strip() not in ("", "000000")) else (geo.get("pincode") or "000000")
    return f"{place}-{postcode}"
