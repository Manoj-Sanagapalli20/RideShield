import csv
import os
from fastapi import APIRouter
from pydantic import BaseModel
from ..models.risk_model import risk_predictor

router = APIRouter()

class RiskRequest(BaseModel):
    pincode: str = ""
    season: str = "monsoon"
    zoneType: str = "urban"
    city: str = ""

def lookup_district_data(city_name: str, pincode_val: str) -> dict:
    """
    Search the local CSV for the city or district.
    Cleans string parameters (lowercased, stripped) to handle minor variations.
    If no direct match is found, looks for pincode prefix or falls back to standard defaults.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(os.path.dirname(current_dir), "data", "imd_historical_data.csv")
    
    # Default parameters in case of missing matches (safe fallback)
    default_row = {
        "district": "default",
        "state": "india",
        "avg_rain_days_per_month": "8.0",
        "flood_zone_classification": "0.0",
        "avg_aqi_score_last_year": "90.0",
        "strike_events_last_2_years": "1.0",
        "zone_type": "1.0", # Semi-Urban
        "monsoon_season_flag": "1.0",
        "risk_label": "0"
    }
    
    if not os.path.exists(csv_path):
        return default_row

    # Clean the input city name
    search_term = city_name.lower().strip()
    # Remove common zone/district/city suffixes
    for suffix in [" zone", " district", " city", " rural", " urban"]:
        if search_term.endswith(suffix):
            search_term = search_term[:-len(suffix)].strip()
            
    # Read the CSV to search for matches
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
        # 1. Exact match by district/city name
        for row in rows:
            if row["district"].lower().strip() == search_term:
                return row
                
        # 2. Substring match
        for row in rows:
            dist_val = row["district"].lower().strip()
            if dist_val in search_term or search_term in dist_val:
                return row

        # 3. Match by Pincode Prefix (e.g. "522" for Guntur district)
        cleaned_pin = pincode_val.strip()
        if len(cleaned_pin) >= 3 and cleaned_pin.isdigit():
            prefix = cleaned_pin[:3]
            pin_mappings = {
                "520": "vijayawada", "521": "vijayawada",
                "522": "guntur", "524": "nellore",
                "530": "visakhapatnam", "531": "visakhapatnam",
                "515": "anantapur", "516": "kadapa",
                "517": "tirupati", "518": "kurnool",
                "533": "kakinada", "534": "eluru",
                "535": "vizianagaram", "532": "srikakulam",
                "523": "ongole",
                "500": "hyderabad"
            }
            if prefix in pin_mappings:
                mapped_city = pin_mappings[prefix]
                for row in rows:
                    if row["district"].lower().strip() == mapped_city:
                        return row

    # 4. If we geocoded a city name and it's not matched, use the cleaned name in default output
    if city_name:
        default_row["district"] = city_name
    return default_row

@router.post("/risk-score")
def get_risk_score(req: RiskRequest):
    # Lookup the district parameters in the CSV database
    row = lookup_district_data(req.city, req.pincode)
    
    # Is it monsoon season?
    is_monsoon = 1.0 if req.season.lower().strip() == "monsoon" else 0.0
    
    # Run RandomForest prediction on resolved IMD/NDMA features
    result = risk_predictor.predict(
        avg_rain_days_per_month=float(row["avg_rain_days_per_month"]),
        flood_zone_classification=float(row["flood_zone_classification"]),
        avg_aqi_score_last_year=float(row["avg_aqi_score_last_year"]),
        strike_events_last_2_years=float(row["strike_events_last_2_years"]),
        zone_type=float(row["zone_type"]),
        monsoon_season_flag=is_monsoon
    )
    
    # Add resolved parameters to output for transparency
    result.update({
        "city": row["district"].title(),
        "state": row["state"].title(),
        "avg_rain_days_per_month": float(row["avg_rain_days_per_month"]),
        "flood_zone_classification": int(float(row["flood_zone_classification"])),
        "avg_aqi_score_last_year": float(row["avg_aqi_score_last_year"]),
        "strike_events_last_2_years": int(float(row["strike_events_last_2_years"])),
        "zone_type": int(float(row["zone_type"]))
    })
    
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
