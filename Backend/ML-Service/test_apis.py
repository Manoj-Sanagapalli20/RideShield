import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/ml"


def run_tests():
    # 1. Prompt the user for City and Date
    print("=== RideShield ML-Service API Tester ===")
    if len(sys.argv) >= 3:
        city = sys.argv[1]
        date = sys.argv[2]
        print(f"Using arguments: city='{city}', date='{date}'")
    else:
        city = input("Enter City Name (e.g. Sattenapalli, Bhattiprolu, Vijayawada): ").strip()
        date = input("Enter Date (YYYY-MM-DD, e.g. 2026-06-15): ").strip()

    if not city or not date:
        print("Error: City name and Date are required.")
        return

    # 2. Call Geocoding Endpoint to resolve coordinates and pincode
    print(f"\nResolving coordinates and pincode for '{city}' via Geocoding API...")
    geocode_url = f"{BASE_URL}/geocode?city={requests.utils.quote(city)}"
    try:
        geo_response = requests.get(geocode_url, timeout=5)
        if geo_response.status_code != 200:
            print(f"Error: Geocoding failed with status {geo_response.status_code}")
            return
        geo_data = geo_response.json()
        if not geo_data.get("success"):
            print("Error: Could not resolve coordinates for the city.")
            return
        lat = geo_data["lat"]
        lng = geo_data["lng"]
        pincode = geo_data.get("pincode") or "522400"
        print(f"Successfully resolved: Lat={lat}, Lng={lng}, Pincode={pincode}")
    except Exception as e:
        print(f"Error calling geocoding endpoint: {e}")
        return

    # 3. Test POST /zone-disruptions
    print(f"\n--- Testing POST /zone-disruptions for {city} on {date} ---")
    disrupt_payload = {
        "pincode": pincode,
        "lat": lat,
        "lng": lng,
        "date": date
    }
    try:
        res = requests.post(f"{BASE_URL}/zone-disruptions", json=disrupt_payload, timeout=30)
        print(f"Status: {res.status_code}")
        print(json.dumps(res.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

    # 4. Test POST /risk-score
    print(f"\n--- Testing POST /risk-score using resolved pincode {pincode} ---")
    risk_payload = {
        "pincode": pincode,
        "season": "monsoon",
        "zoneType": "urban"
    }
    try:
        res = requests.post(f"{BASE_URL}/risk-score", json=risk_payload, timeout=5)
        print(f"Status: {res.status_code}")
        print(json.dumps(res.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

    # 5. Test POST /premium-predict
    print(f"\n--- Testing POST /premium-predict ---")
    premium_payload = {
        "weatherForecast": {
            "condition": "rain",
            "temp": 30
        },
        "aqi": 150.5,
        "pastClaims": [
            {"amount": 500, "date": "2025-01-01"}
        ]
    }
    try:
        res = requests.post(f"{BASE_URL}/premium-predict", json=premium_payload, timeout=5)
        print(f"Status: {res.status_code}")
        print(json.dumps(res.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

    # 6. Test POST /fraud-check
    print(f"\n--- Testing POST /fraud-check using resolved coordinates ({lat}, {lng}) ---")
    fraud_payload = {
        "gps": {"lat": lat, "lng": lng},
        "ordersLast2hr": 5,
        "claimsLast30Days": 2
    }
    try:
        res = requests.post(f"{BASE_URL}/fraud-check", json=fraud_payload, timeout=5)
        print(f"Status: {res.status_code}")
        print(json.dumps(res.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    try:
        # Quick health check first
        health = requests.get("http://localhost:8000/", timeout=3)
        if health.status_code != 200:
            print(f"Server not fully ready: {health.status_code}")
            sys.exit(1)
            
        run_tests()
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to localhost:8000. Is the server running?")
    except Exception as e:
        print(f"Error running tests: {e}")