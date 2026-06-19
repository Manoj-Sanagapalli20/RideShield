"""
Smart Work Advisory Route — RideShield ML Service
Exposes GET /api/ml/smart-advisory?lat=...&lng=...&pincode=...
"""

from fastapi import APIRouter, Query
from ..services.advisory_service import generate_advisory

router = APIRouter()


@router.get("/smart-advisory")
def get_smart_advisory(
    lat: float = Query(..., description="Driver's latitude"),
    lng: float = Query(..., description="Driver's longitude"),
    pincode: str = Query(default=None, description="Driver's pincode (optional, for logging)"),
):
    """
    Returns a structured daily advisory for the driver based on tomorrow's
    weather and AQI forecast at their registered zone location.
    """
    advisory = generate_advisory(lat=lat, lng=lng, pincode=pincode)
    return advisory
