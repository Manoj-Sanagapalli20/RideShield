from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from ..models.fraud_model import fraud_predictor

router = APIRouter()


class FraudRequest(BaseModel):
    gpsZoneVsCellTowerZoneMatch: int = Field(default=1, description="1 if GPS matches Cell Tower region, else 0")
    accelerometerMotionDuringClaim: float = Field(default=0.8, description="Micro-motion rating (0 to 1)")
    loginToTriggerGapMinutes: float = Field(default=120.0, description="Time gap between Rapido login and disruption event in minutes")
    orders3hrBeforeDisruption: int = Field(default=3, description="Rides/orders accepted in the 3 hours preceding the claim")
    claimsLast30Days: int = Field(default=0, description="Count of claims made by the driver in the last 30 days")
    neighborClaimsSameWindow: int = Field(default=15, description="Claims from other drivers in the same zone window")
    registrationCohortSize: int = Field(default=5, description="Drivers registered within same hour/group")
    deviceFingerprintClusterScore: float = Field(default=0.1, description="Similarity of device attributes (0 to 1)")


@router.post("/fraud-check")
def check_fraud(req: FraudRequest):
    result = fraud_predictor.predict(
        gps_zone_vs_cell_tower_zone_match=req.gpsZoneVsCellTowerZoneMatch,
        accelerometer_motion_during_claim=req.accelerometerMotionDuringClaim,
        login_to_trigger_gap_minutes=req.loginToTriggerGapMinutes,
        orders_3hr_before_disruption=req.orders3hrBeforeDisruption,
        claims_last_30_days=req.claimsLast30Days,
        neighbor_claims_same_window=req.neighborClaimsSameWindow,
        registration_cohort_size=req.registrationCohortSize,
        device_fingerprint_cluster_score=req.deviceFingerprintClusterScore
    )
    return result
