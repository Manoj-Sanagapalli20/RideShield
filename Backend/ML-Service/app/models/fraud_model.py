"""
Fraud Detection Model — IsolationForest-based anomaly scorer.

Feature vector (8 dimensions):
  0  orders_last_2hr       — burst ordering rate (high = suspicious)
  1  claims_last_30_days   — claim history (high = risky)
  2  amount_inr            — transaction amount (INR)
  3  is_night              — 1 if hour ∈ [22‒23, 0‒5], else 0 (night txn)
  4  hour_of_day           — 0‒23
  5  device_mobile         — 1 if device_type == "mobile"
  6  device_web            — 1 if device_type == "web"
  7  device_pos            — 1 if device_type == "pos"

The model is trained on a representative synthetic dataset that encodes
normal behaviour patterns so that IsolationForest can detect genuine
anomalies rather than returning a random score.
"""

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np

# ─── Known device types ────────────────────────────────────────────────────────
DEVICE_TYPES = ["mobile", "web", "pos", "unknown"]


def _encode_features(
    orders_last_2hr: int,
    claims_last_30_days: int,
    amount_inr: float,
    hour_of_day: int,
    device_type: str,
) -> np.ndarray:
    """Convert raw inputs into a normalised feature vector."""
    is_night = 1 if (hour_of_day >= 22 or hour_of_day <= 5) else 0
    dev = device_type.lower().strip() if device_type else "unknown"
    device_mobile = 1 if dev == "mobile" else 0
    device_web    = 1 if dev == "web"    else 0
    device_pos    = 1 if dev == "pos"    else 0

    return np.array([
        orders_last_2hr,
        claims_last_30_days,
        amount_inr,
        is_night,
        hour_of_day,
        device_mobile,
        device_web,
        device_pos,
    ], dtype=float)


def _build_synthetic_dataset(n_normal: int = 600, n_anomaly: int = 60, seed: int = 42):
    """
    Build a labelled synthetic dataset that represents realistic behaviour.

    Normal patterns:
      - Mobile: 1‒4 orders/2hr, 0‒3 claims, ₹50–₹2 000, mostly daytime
      - Web   : 1‒3 orders/2hr, 0‒2 claims, ₹100–₹5 000
      - POS   : 1‒2 orders/2hr, 0‒1 claims, ₹10–₹500

    Anomaly patterns:
      - Very high order bursts (10‒30), high claims (5‒15), large amounts,
        mostly at night, or unusual device combos.
    """
    rng = np.random.default_rng(seed)
    rows = []

    # ── Normal mobile transactions ──────────────────────────────────────────
    n = n_normal // 3
    for _ in range(n):
        hour = int(rng.integers(6, 22))
        rows.append(_encode_features(
            orders_last_2hr=int(rng.integers(1, 5)),
            claims_last_30_days=int(rng.integers(0, 4)),
            amount_inr=float(rng.uniform(50, 2000)),
            hour_of_day=hour,
            device_type="mobile",
        ))

    # ── Normal web transactions ──────────────────────────────────────────────
    for _ in range(n):
        hour = int(rng.integers(8, 22))
        rows.append(_encode_features(
            orders_last_2hr=int(rng.integers(1, 4)),
            claims_last_30_days=int(rng.integers(0, 3)),
            amount_inr=float(rng.uniform(100, 5000)),
            hour_of_day=hour,
            device_type="web",
        ))

    # ── Normal POS transactions ──────────────────────────────────────────────
    for _ in range(n_normal - 2 * n):
        hour = int(rng.integers(9, 21))
        rows.append(_encode_features(
            orders_last_2hr=int(rng.integers(1, 3)),
            claims_last_30_days=int(rng.integers(0, 2)),
            amount_inr=float(rng.uniform(10, 500)),
            hour_of_day=hour,
            device_type="pos",
        ))

    # ── Anomalous transactions ───────────────────────────────────────────────
    for _ in range(n_anomaly):
        hour = int(rng.choice([0, 1, 2, 3, 4, 23, 22]))
        dev  = rng.choice(DEVICE_TYPES)
        rows.append(_encode_features(
            orders_last_2hr=int(rng.integers(10, 31)),
            claims_last_30_days=int(rng.integers(5, 16)),
            amount_inr=float(rng.uniform(8000, 50000)),
            hour_of_day=hour,
            device_type=dev,
        ))

    return np.array(rows)


class FraudModel:
    """
    IsolationForest anomaly detector for payment fraud.

    The raw IsolationForest score (typically ‑1 to +0.5) is mapped to a
    [0, 1] anomalyScore where higher → more anomalous.
    """

    def __init__(self):
        X = _build_synthetic_dataset()
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.09,   # ~9 % anomaly rate in training data
            max_features=1.0,
            random_state=42,
        )
        self.model.fit(X_scaled)

    # ── Internal helpers ────────────────────────────────────────────────────

    @staticmethod
    def _iso_score_to_anomaly(raw_score: float) -> float:
        """
        Convert IsolationForest decision_function score to [0‒1].
        decision_function returns positive for inliers, negative for outliers.
        We invert and clip so that anomaly = 1 means "very suspicious".
        """
        # Typical range: roughly ‑0.3 (anomaly) to +0.3 (normal)
        clipped = float(np.clip(-raw_score, -0.5, 0.5))
        normalised = (clipped + 0.5) / 1.0   # maps [‑0.5, 0.5] → [0, 1]
        return round(float(np.clip(normalised, 0.0, 1.0)), 4)

    # ── Public API ──────────────────────────────────────────────────────────

    def predict(
        self,
        gps: dict,
        orders_last_2hr: int,
        claims_last_30_days: int,
        amount_inr: float = 500.0,
        hour_of_day: int = 12,
        device_type: str = "mobile",
    ) -> dict:
        """
        Returns anomalyScore ∈ [0, 1] and a verdict.

        Parameters
        ----------
        gps               : dict with optional lat/lng (currently unused in
                            the feature vector but kept for future geo-risk)
        orders_last_2hr   : number of orders placed in last 2 hours
        claims_last_30_days: insurance/refund claims in last 30 days
        amount_inr        : transaction amount in INR
        hour_of_day       : local hour (0‒23)
        device_type       : "mobile" | "web" | "pos" | "unknown"
        """
        feat = _encode_features(
            orders_last_2hr=orders_last_2hr,
            claims_last_30_days=claims_last_30_days,
            amount_inr=amount_inr,
            hour_of_day=hour_of_day,
            device_type=device_type,
        ).reshape(1, -1)

        feat_scaled = self.scaler.transform(feat)
        raw = float(self.model.decision_function(feat_scaled)[0])
        anomaly_score = self._iso_score_to_anomaly(raw)

        if anomaly_score >= 0.65:
            verdict = "flag"
        elif anomaly_score >= 0.45:
            verdict = "review"
        else:
            verdict = "approve"

        return {
            "anomalyScore": anomaly_score,
            "verdict": verdict,
            "features": {
                "ordersLast2hr": orders_last_2hr,
                "claimsLast30Days": claims_last_30_days,
                "amountINR": amount_inr,
                "hourOfDay": hour_of_day,
                "deviceType": device_type,
                "isNightTransaction": bool(hour_of_day >= 22 or hour_of_day <= 5),
            },
        }


fraud_predictor = FraudModel()
