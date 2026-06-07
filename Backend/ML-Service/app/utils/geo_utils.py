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


def get_zone_name(lat: float, lng: float, fallback_pincode: str):
    """
    Reverse geocodes coordinates to a zone/city name using OSM Nominatim API.
    Handles urban cities, small towns, villages, AND rural districts/counties.
    """
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}"
        headers = {
            'User-Agent': 'RideShield-ML-Service/1.0'
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            address = data.get("address", {})
            # Try the most specific → least specific location name available
            place = (
                address.get("city") or
                address.get("town") or
                address.get("municipality") or
                address.get("village") or
                address.get("county") or          # e.g. "Baripada Sadar"
                address.get("state_district") or  # e.g. "Mayurbhanj"
                address.get("district") or
                address.get("state") or
                "Unknown"
            )
            postcode = address.get("postcode", fallback_pincode)
            return f"{place}-{postcode}"
    except Exception as e:
        logger.error(f"Nominatim API error: {e}")
        
    return f"zone-{fallback_pincode}"
