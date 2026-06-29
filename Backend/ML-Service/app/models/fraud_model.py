"""
Fraud Detection Model — IsolationForest-based anomaly scorer.
Uses real-world physical and cohort metrics to detect spoofing anomalies.
"""

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np


def _encode_features(
    gps_zone_vs_cell_tower_zone_match: int,
    accelerometer_motion_during_claim: float,
    login_to_trigger_gap_minutes: float,
    orders_3hr_before_disruption: int,
    claims_last_30_days: int,
    neighbor_claims_same_window: int,
    registration_cohort_size: int,
    device_fingerprint_cluster_score: float
) -> np.ndarray:
    """Convert raw physical and cohort features into a normalized vector."""
    return np.array([
        float(gps_zone_vs_cell_tower_zone_match),
        float(accelerometer_motion_during_claim),
        float(login_to_trigger_gap_minutes),
        float(orders_3hr_before_disruption),
        float(claims_last_30_days),
        float(neighbor_claims_same_window),
        float(registration_cohort_size),
        float(device_fingerprint_cluster_score)
    ], dtype=float)


def _build_synthetic_dataset(n_normal: int = 600, n_anomaly: int = 60, seed: int = 42):
    """
    Builds a synthetic dataset that represents physical and cohort metrics.
    
    Normal patterns:
      - Triangulation matches (1), active motion (0.4-1.0), normal login-to-trigger gaps (15m-300m),
        low claims velocity, normal cohort registrations, and low fingerprint clusters.
    
    Anomalous patterns (GPS Spoofers & Rings):
      - Triangulation mismatches (0), stationary accelerometer (<0.15), timed login gaps (<10m),
        high claims history, cohort registrations spikes, and high fingerprint clusters.
    """
    rng = np.random.default_rng(seed)
    rows = []

    # ── Normal driver activity ──────────────────────────────────────────
    for _ in range(n_normal):
        rows.append(_encode_features(
            gps_zone_vs_cell_tower_zone_match=1,
            accelerometer_motion_during_claim=float(rng.uniform(0.4, 1.0)),
            login_to_trigger_gap_minutes=float(rng.uniform(15.0, 300.0)),
            orders_3hr_before_disruption=int(rng.integers(1, 6)),
            claims_last_30_days=int(rng.integers(1, 4)),
            neighbor_claims_same_window=int(rng.integers(5, 50)),
            registration_cohort_size=int(rng.integers(1, 15)),
            device_fingerprint_cluster_score=float(rng.uniform(0.0, 0.2))
        ))

    # ── Anomalous/Spoofing activity ──────────────────────────────────────
    for _ in range(n_anomaly):
        rows.append(_encode_features(
            gps_zone_vs_cell_tower_zone_match=int(rng.choice([0, 1], p=[0.7, 0.3])),
            accelerometer_motion_during_claim=float(rng.uniform(0.0, 0.15)),
            login_to_trigger_gap_minutes=float(rng.uniform(0.0, 10.0)),
            orders_3hr_before_disruption=int(rng.integers(0, 2)),
            claims_last_30_days=int(rng.integers(5, 10)),
            neighbor_claims_same_window=int(rng.integers(0, 4)),
            registration_cohort_size=int(rng.integers(40, 200)),
            device_fingerprint_cluster_score=float(rng.uniform(0.7, 1.0))
        ))

    return np.array(rows)


class FraudModel:
    """
    IsolationForest anomaly detector for location spoofing and claim fraud.
    """

    def __init__(self):
        X = _build_synthetic_dataset()
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.09,
            max_features=1.0,
            random_state=42,
        )
        self.model.fit(X_scaled)

    @staticmethod
    def _iso_score_to_anomaly(raw_score: float) -> float:
        """
        Convert IsolationForest score to [0-1] range.
        """
        clipped = float(np.clip(-raw_score, -0.5, 0.5))
        normalised = (clipped + 0.5) / 1.0
        return round(float(np.clip(normalised, 0.0, 1.0)), 4)

    def predict(
        self,
        gps_zone_vs_cell_tower_zone_match: int,
        accelerometer_motion_during_claim: float,
        login_to_trigger_gap_minutes: float,
        orders_3hr_before_disruption: int,
        claims_last_30_days: int,
        neighbor_claims_same_window: int,
        registration_cohort_size: int,
        device_fingerprint_cluster_score: float
    ) -> dict:
        """
        Predicts anomalyScore ∈ [0, 1] and outputs a decision verdict.
        """
        feat = _encode_features(
            gps_zone_vs_cell_tower_zone_match=gps_zone_vs_cell_tower_zone_match,
            accelerometer_motion_during_claim=accelerometer_motion_during_claim,
            login_to_trigger_gap_minutes=login_to_trigger_gap_minutes,
            orders_3hr_before_disruption=orders_3hr_before_disruption,
            claims_last_30_days=claims_last_30_days,
            neighbor_claims_same_window=neighbor_claims_same_window,
            registration_cohort_size=registration_cohort_size,
            device_fingerprint_cluster_score=device_fingerprint_cluster_score
        ).reshape(1, -1)

        feat_scaled = self.scaler.transform(feat)
        raw = float(self.model.decision_function(feat_scaled)[0])
        anomaly_score = self._iso_score_to_anomaly(raw)

        # composite score limits
        if anomaly_score >= 0.55:
            verdict = "flag"
        elif anomaly_score >= 0.30:
            verdict = "review"
        else:
            verdict = "approve"

        return {
            "anomalyScore": anomaly_score,
            "verdict": verdict,
            "features": {
                "gpsZoneVsCellTowerZoneMatch": gps_zone_vs_cell_tower_zone_match,
                "accelerometerMotionDuringClaim": accelerometer_motion_during_claim,
                "loginToTriggerGapMinutes": login_to_trigger_gap_minutes,
                "orders3hrBeforeDisruption": orders_3hr_before_disruption,
                "claimsLast30Days": claims_last_30_days,
                "neighborClaimsSameWindow": neighbor_claims_same_window,
                "registrationCohortSize": registration_cohort_size,
                "deviceFingerprintClusterScore": device_fingerprint_cluster_score
            }
        }


fraud_predictor = FraudModel()
