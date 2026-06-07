import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/ml"

def test_zone_disruptions():
    url = f"{BASE_URL}/zone-disruptions"
    payload = {
        "pincode": "520001",
        "lat": 16.5,
        "lng": 80.6,
        "date": "2026-03-18"
    }
    response = requests.post(url, json=payload)
    print(f"--- POST /zone-disruptions ---")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

def test_risk_score():
    url = f"{BASE_URL}/risk-score"
    payload = {
        "pincode": "520001",
        "season": "monsoon",
        "zoneType": "urban"
    }
    response = requests.post(url, json=payload)
    print(f"--- POST /risk-score ---")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

def test_premium_predict():
    url = f"{BASE_URL}/premium-predict"
    payload = {
        "weatherForecast": {
            "condition": "rain",
            "temp": 30
        },
        "aqi": 150.5,
        "pastClaims": [
            {"amount": 500, "date": "2025-01-01"}
        ]
    }
    response = requests.post(url, json=payload)
    print(f"--- POST /premium-predict ---")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

def test_fraud_check():
    url = f"{BASE_URL}/fraud-check"
    payload = {
        "gps": {"lat": 16.5, "lng": 80.6},
        "ordersLast2hr": 5,
        "claimsLast30Days": 2
    }
    response = requests.post(url, json=payload)
    print(f"--- POST /fraud-check ---")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()

if __name__ == "__main__":
    try:
        # Quick health check first
        health = requests.get("http://localhost:8000/")
        if health.status_code != 200:
            print(f"Server not fully ready: {health.status_code}")
            sys.exit(1)
            
        test_zone_disruptions()
        test_risk_score()
        test_premium_predict()
        test_fraud_check()
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to localhost:8000. Is the server running?")
    except Exception as e:
        print(f"Error running tests: {e}")
