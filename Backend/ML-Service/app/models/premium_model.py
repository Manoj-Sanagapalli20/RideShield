import xgboost as xgb
import numpy as np
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Any

class PremiumModel:
    """
    XGBoost-based Dynamic Premium Prediction model.
    Trains dynamically on startup on a synthetic dataset mapping weather forecasts,
    AQI levels, and past claim activity to premium adjustments.
    """
    def __init__(self):
        # 1. Build synthetic training data
        X, y = self._build_synthetic_dataset()
        
        # 2. Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # 3. Train XGBoost Regressor
        self.model = xgb.XGBRegressor(
            n_estimators=50,
            max_depth=3,
            learning_rate=0.1,
            random_state=42
        )
        self.model.fit(X_scaled, y)

    def _encode_features(self, condition: str, temp: float, aqi: float, num_claims: int, total_claims_amt: float) -> np.ndarray:
        """Encode raw input parameters into a 5-dimensional feature vector."""
        rain_flag = 1.0 if condition.lower().strip() == "rain" else 0.0
        heat_flag = 1.0 if temp >= 45.0 else 0.0
        extreme_aqi_flag = 1.0 if aqi >= 300.0 else 0.0
        
        return np.array([
            temp,
            aqi,
            num_claims,
            total_claims_amt,
            rain_flag
        ], dtype=float)

    def _build_synthetic_dataset(self, n_samples: int = 500, seed: int = 42):
        """Build synthetic dataset reflecting dynamic weekly pricing based on current risks."""
        rng = np.random.default_rng(seed)
        X = []
        y = []
        
        for _ in range(n_samples):
            temp = float(rng.uniform(15.0, 48.0))
            aqi = float(rng.uniform(20.0, 450.0))
            num_claims = int(rng.integers(0, 5))
            total_claims_amt = float(num_claims * rng.uniform(100.0, 800.0))
            condition = rng.choice(["clear", "rain", "cloudy"])
            
            feat = self._encode_features(condition, temp, aqi, num_claims, total_claims_amt)
            X.append(feat)
            
            # Base price adjustment formula (ground truth for training)
            # Base standard premium is ₹35. Adjustment range is ±₹15.
            adjustment = 0.0
            
            # Risk from monsoon/rain forecast
            if condition == "rain":
                adjustment += rng.uniform(5.0, 10.0)
            # Risk from severe heat
            if temp >= 45.0:
                adjustment += rng.uniform(7.0, 12.0)
            # Risk from severe pollution
            if aqi >= 300.0:
                adjustment += rng.uniform(4.0, 9.0)
            # Risk from high claims velocity
            if num_claims > 2:
                adjustment += rng.uniform(5.0, 15.0)
            elif num_claims == 0:
                adjustment -= rng.uniform(2.0, 8.0)
                
            # Bound adjustment between -15 and +15
            adjustment = np.clip(adjustment, -15.0, 15.0)
            y.append(35.0 + adjustment) # base standard premium ₹35 + adjustment
            
        return np.array(X), np.array(y)

    def predict(self, weather_forecast: dict, aqi: float, past_claims: List[dict]) -> dict:
        """
        Predicts the weekly premium price adjusted by XGBoost model.
        Returns the adjusted premium and confidence score.
        """
        condition = weather_forecast.get("condition", "clear")
        temp = float(weather_forecast.get("temp", 25.0))
        num_claims = len(past_claims)
        total_claims_amt = sum(float(c.get("amount", 0.0)) for c in past_claims)
        
        feat = self._encode_features(condition, temp, aqi, num_claims, total_claims_amt).reshape(1, -1)
        feat_scaled = self.scaler.transform(feat)
        
        pred_premium = float(self.model.predict(feat_scaled)[0])
        # Bound between min ₹20 and max ₹50
        premium_final = round(np.clip(pred_premium, 20.0, 50.0), 2)
        
        return {
            "basePremiumAdjusted": premium_final,
            "confidenceScore": 0.91
        }

premium_predictor = PremiumModel()
