from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from ..models.fraud_model import fraud_predictor

router = APIRouter()


class FraudRequest(BaseModel):
    gps: Dict[str, Any]
    ordersLast2hr: int
    claimsLast30Days: int
    # ── New contextual fields ──────────────────────────────────────────────
    amountINR: float = Field(default=500.0, ge=0, description="Transaction amount in INR")
    hourOfDay: int = Field(default=12, ge=0, le=23, description="Local hour of transaction (0-23)")
    deviceType: str = Field(
        default="mobile",
        description="Device used: 'mobile' | 'web' | 'pos' | 'unknown'"
    )


@router.post("/fraud-check")
def check_fraud(req: FraudRequest):
    result = fraud_predictor.predict(
        gps=req.gps,
        orders_last_2hr=req.ordersLast2hr,
        claims_last_30_days=req.claimsLast30Days,
        amount_inr=req.amountINR,
        hour_of_day=req.hourOfDay,
        device_type=req.deviceType,
    )
    return result
