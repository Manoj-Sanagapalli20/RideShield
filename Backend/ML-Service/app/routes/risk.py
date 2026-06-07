from fastapi import APIRouter
from pydantic import BaseModel
from ..models.risk_model import risk_predictor

router = APIRouter()

class RiskRequest(BaseModel):
    pincode: str
    season: str
    zoneType: str

@router.post("/risk-score")
def get_risk_score(req: RiskRequest):
    result = risk_predictor.predict(
        pincode=req.pincode,
        season=req.season,
        zone_type=req.zoneType
    )
    return result
