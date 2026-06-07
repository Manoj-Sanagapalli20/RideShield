from sklearn.ensemble import RandomForestClassifier
import numpy as np

class RiskModel:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=10)
        X_dummy = np.random.rand(10, 3) 
        y_dummy = np.random.randint(0, 2, 10)
        self.model.fit(X_dummy, y_dummy)
    
    def predict(self, pincode: str, season: str, zone_type: str):
        risk_score = np.random.randint(50, 95)
        risk_level = "high" if risk_score > 70 else "medium" if risk_score > 40 else "low"
        premium_adj = int((risk_score - 50) * 0.5) if risk_score > 50 else 0
        
        return {
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "premiumAdjustment": max(0, premium_adj)
        }

risk_predictor = RiskModel()
