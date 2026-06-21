import csv
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import numpy as np

class RiskModel:
    """
    Random Forest-based Zone Risk Scoring model.
    Trains dynamically on startup on a district-level CSV dataset containing
    historical meteorological (IMD) and hazard (NDMA) statistics.
    """
    def __init__(self):
        # 1. Load data from imd_historical_data.csv
        X, y = self._load_historical_dataset()
        
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

    def _encode_features(self, avg_rain_days_per_month: float, flood_zone_classification: float, 
                         avg_aqi_score_last_year: float, strike_events_last_2_years: float, 
                         zone_type: float, monsoon_season_flag: float) -> np.ndarray:
        """Encode raw input parameters into a 6-dimensional feature vector."""
        return np.array([
            float(avg_rain_days_per_month),
            float(flood_zone_classification),
            float(avg_aqi_score_last_year),
            float(strike_events_last_2_years),
            float(zone_type),
            float(monsoon_season_flag)
        ], dtype=float)

    def _load_historical_dataset(self):
        """Loads dataset from the local imd_historical_data.csv file."""
        X = []
        y = []
        
        # Resolve path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(os.path.dirname(current_dir), "data", "imd_historical_data.csv")
        
        # Fallback if file doesn't exist
        if not os.path.exists(csv_path):
            print(f"WARNING: CSV path {csv_path} does not exist. Using synthetic fallback.")
            return self._build_synthetic_dataset()
            
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                feat = self._encode_features(
                    row["avg_rain_days_per_month"],
                    row["flood_zone_classification"],
                    row["avg_aqi_score_last_year"],
                    row["strike_events_last_2_years"],
                    row["zone_type"],
                    row["monsoon_season_flag"]
                )
                X.append(feat)
                y.append(int(row["risk_label"]))
                
        return np.array(X), np.array(y)

    def _build_synthetic_dataset(self):
        # Simple fallback method
        X = []
        y = []
        for i in range(100):
            feat = self._encode_features(10.0, 1.0, 100.0, 2.0, 1.0, 1.0)
            X.append(feat)
            y.append(1 if i % 2 == 0 else 0)
        return np.array(X), np.array(y)

    def predict(self, avg_rain_days_per_month: float, flood_zone_classification: float, 
                avg_aqi_score_last_year: float, strike_events_last_2_years: float, 
                zone_type: float, monsoon_season_flag: float) -> dict:
        """
        Predicts the risk score and premium adjustment using the Random Forest classifier.
        """
        feat = self._encode_features(
            avg_rain_days_per_month,
            flood_zone_classification,
            avg_aqi_score_last_year,
            strike_events_last_2_years,
            zone_type,
            monsoon_season_flag
        ).reshape(1, -1)
        feat_scaled = self.scaler.transform(feat)
        
        # Get probability of the high-risk class (class 1)
        risk_prob = float(self.model.predict_proba(feat_scaled)[0][1])
        
        # Map probability to risk score (scale of 0-100)
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
