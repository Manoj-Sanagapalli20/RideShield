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


from ..models.premium_model import premium_predictor

class PremiumPredictRequest(BaseModel):
    weatherForecast: dict
    aqi: float
    pastClaims: list

@router.post("/premium-predict")
def predict_premium(req: PremiumPredictRequest):
    result = premium_predictor.predict(
        weather_forecast=req.weatherForecast,
        aqi=req.aqi,
        past_claims=req.pastClaims
    )
    return result

