from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import numpy as np

class RiskModel:
    """
    Random Forest-based Zone Risk Scoring model.
    Trains dynamically on startup on a synthetic dataset mapping pincodes,
    seasons, and zone classifications to risk levels.
    """
    def __init__(self):
        # 1. Build synthetic training data
        X, y = self._build_synthetic_dataset()
        
        # 2. Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # 3. Train RandomForest Classifier
        self.model = RandomForestClassifier(
            n_estimators=50,
            max_depth=4,
            random_state=42
        )
        self.model.fit(X_scaled, y)

    def _encode_features(self, pincode: str, season: str, zone_type: str) -> np.ndarray:
        """Encode raw input parameters into a 4-dimensional feature vector."""
        # Clean inputs
        pin = float(pincode) if pincode and pincode.isdigit() else 522001.0
        is_monsoon = 1.0 if season.lower().strip() == "monsoon" else 0.0
        is_urban = 1.0 if zone_type.lower().strip() == "urban" else 0.0
        is_rural = 1.0 if zone_type.lower().strip() == "rural" else 0.0
        
        return np.array([
            pin,
            is_monsoon,
            is_urban,
            is_rural
        ], dtype=float)

    def _build_synthetic_dataset(self, n_samples: int = 500, seed: int = 42):
        """Build a synthetic dataset representing zone-level risk mapping."""
        rng = np.random.default_rng(seed)
        X = []
        y = []
        
        for _ in range(n_samples):
            # Simulate a range of Andhra Pradesh pincodes (e.g. 522001 to 522999)
            pincode_num = int(rng.integers(522000, 523000))
            season = rng.choice(["monsoon", "summer", "winter"])
            zone_type = rng.choice(["urban", "semi-urban", "rural"])
            
            feat = self._encode_features(str(pincode_num), season, zone_type)
            X.append(feat)
            
            # Ground truth risk calculation:
            # Pincodes ending in odd numbers in flood plains (e.g. Tenali/Bhattiprolu region) are higher risk.
            score = 0.0
            if season == "monsoon":
                score += 40.0
            if zone_type == "rural": # Rural zones are more susceptible to flood cutoffs
                score += 25.0
            elif zone_type == "urban": # Urban zones have higher strike disruption frequency
                score += 15.0
            if pincode_num % 2 == 1: # Odd pincodes represent high flood zones in our synthetic risk matrix
                score += 20.0
                
            # Label as high risk (1) if risk score is high
            label = 1 if score >= 45.0 else 0
            y.append(label)
            
        return np.array(X), np.array(y)

    def predict(self, pincode: str, season: str, zone_type: str) -> dict:
        """
        Predicts the risk score and premium adjustment using the Random Forest classifier.
        """
        feat = self._encode_features(pincode, season, zone_type).reshape(1, -1)
        feat_scaled = self.scaler.transform(feat)
        
        # Get probability of the high-risk class (class 1)
        risk_prob = float(self.model.predict_proba(feat_scaled)[0][1])
        
        # Map probability to risk score (scale of 0-100)
        # Low risk is mapped to 0-30, Medium is 31-60, High is 61-100
        risk_score = int(risk_prob * 100)
        
        if risk_score >= 61:
            risk_level = "high"
            premium_adj = 15
        elif risk_score >= 31:
            risk_level = "medium"
            premium_adj = 8
        else:
            risk_level = "low"
            premium_adj = 0
            
        return {
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "premiumAdjustment": premium_adj
        }

risk_predictor = RiskModel()
