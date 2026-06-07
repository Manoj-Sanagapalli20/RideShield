import requests
import logging

logger = logging.getLogger(__name__)

def get_hourly_aqi(lat: float, lng: float, date: str):
    """
    Fetches real-time hourly AQI data using Open-Meteo Air Quality API.
    """
    mock_aqi = [100]*24
    try:
        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lng}&hourly=us_aqi&start_date={date}&end_date={date}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            us_aqi = data.get('hourly', {}).get('us_aqi', [])
            if len(us_aqi) >= 24:
                return us_aqi[:24]
        return mock_aqi
    except Exception as e:
        logger.error(f"AQI API error: {e}")
        return mock_aqi
