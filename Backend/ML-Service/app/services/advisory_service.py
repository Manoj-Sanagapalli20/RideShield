"""
Smart Work Advisory Service — RideShield
Generates human-readable, contextual daily advisories for drivers based on
tomorrow's weather forecast and AQI predictions.
"""

import logging
import datetime
import requests

logger = logging.getLogger(__name__)


def _fetch_tomorrow_forecast(lat: float, lng: float) -> dict:
    """
    Fetches tomorrow's hourly weather (precipitation + temperature) from Open-Meteo Forecast API.
    Returns a dict with hourly precipitation and temperature lists.
    """
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lng}"
            f"&hourly=temperature_2m,precipitation,wind_speed_10m"
            f"&timezone=auto"
            f"&start_date={tomorrow}&end_date={tomorrow}"
        )
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            hourly = data.get("hourly", {})
            return {
                "date": tomorrow,
                "precipitation": hourly.get("precipitation", [0.0] * 24),
                "temperature": hourly.get("temperature_2m", [28.0] * 24),
                "wind_speed": hourly.get("wind_speed_10m", [10.0] * 24),
            }
    except Exception as e:
        logger.warning(f"[AdvisoryService] Weather forecast fetch failed: {e}")
    # Fallback: mild clear day
    return {
        "date": tomorrow,
        "precipitation": [0.0] * 24,
        "temperature": [28.0] * 24,
        "wind_speed": [10.0] * 24,
    }


def _fetch_tomorrow_aqi(lat: float, lng: float) -> list:
    """
    Fetches tomorrow's hourly AQI from Open-Meteo Air Quality API.
    Returns a list of 24 AQI values.
    """
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    try:
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lng}"
            f"&hourly=us_aqi"
            f"&start_date={tomorrow}&end_date={tomorrow}"
        )
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            aqi_list = data.get("hourly", {}).get("us_aqi", [])
            if len(aqi_list) >= 24:
                return [v if v is not None else 100 for v in aqi_list[:24]]
    except Exception as e:
        logger.warning(f"[AdvisoryService] AQI forecast fetch failed: {e}")
    return [100] * 24


def generate_advisory(lat: float, lng: float, pincode: str = None) -> dict:
    """
    Main advisory generator. Fetches weather + AQI for tomorrow and returns
    a structured advisory with title, message, severity, and shift recommendations.
    """
    forecast = _fetch_tomorrow_forecast(lat, lng)
    aqi_list = _fetch_tomorrow_aqi(lat, lng)

    precipitation = forecast["precipitation"]  # 24 values (mm/hr)
    temperature = forecast["temperature"]      # 24 values (°C)
    wind_speed = forecast["wind_speed"]        # 24 values (km/h)
    tomorrow_date = forecast["date"]

    # --- Analyse peaks ---
    peak_precip = max(precipitation) if precipitation else 0.0
    peak_temp = max(temperature) if temperature else 28.0
    peak_aqi = max(aqi_list) if aqi_list else 100
    avg_wind = sum(wind_speed) / len(wind_speed) if wind_speed else 10.0

    # Identify peak rain hours (precipitation > 0.5 mm/hr = RideShield threshold)
    heavy_rain_hours = [i for i, p in enumerate(precipitation) if p >= 0.5]
    extreme_rain_hours = [i for i, p in enumerate(precipitation) if p >= 5.0]

    # Severity classification
    advisories = []
    severity = "safe"  # safe | caution | warning | critical

    # --- Heavy Rain Advisory ---
    if extreme_rain_hours:
        first_hr = extreme_rain_hours[0]
        last_hr = extreme_rain_hours[-1]
        advisories.append(
            f"⛈️ Extreme rainfall ({peak_precip:.1f} mm/hr) expected between "
            f"{first_hr:02d}:00–{last_hr + 1:02d}:00. "
            f"Avoid riding during this window — RideShield coverage will activate automatically."
        )
        severity = "critical"
    elif heavy_rain_hours:
        first_hr = heavy_rain_hours[0]
        last_hr = heavy_rain_hours[-1]
        advisories.append(
            f"🌧️ Moderate to heavy rain ({peak_precip:.1f} mm/hr) forecast between "
            f"{first_hr:02d}:00–{last_hr + 1:02d}:00. "
            f"Try to complete your morning shift before {first_hr:02d}:00 or log in after the rain clears."
        )
        if severity == "safe":
            severity = "warning"

    # --- Heat Advisory ---
    if peak_temp >= 42.0:
        advisories.append(
            f"🌡️ Extreme heat alert: Temperature forecast to reach {peak_temp:.1f}°C tomorrow. "
            f"Carry water, avoid peak afternoon hours (12:00–15:00), and take regular breaks."
        )
        if severity == "safe":
            severity = "caution"
    elif peak_temp >= 38.0:
        advisories.append(
            f"☀️ High heat expected ({peak_temp:.1f}°C). Stay hydrated and try to shift your hours to morning (6:00–10:00) or evening (17:00–20:00)."
        )
        if severity == "safe":
            severity = "caution"

    # --- AQI Advisory ---
    if peak_aqi >= 300:
        advisories.append(
            f"🏭 Severe air quality (AQI {peak_aqi}) predicted tomorrow. "
            f"Prolonged outdoor exposure is hazardous. Consider wearing an N95 mask or limiting shift length."
        )
        if severity in ("safe", "caution"):
            severity = "warning"
    elif peak_aqi >= 200:
        advisories.append(
            f"😷 Poor air quality (AQI {peak_aqi}) expected. Sensitive individuals should limit time outdoors. "
            f"Keep ride windows closed where possible."
        )
        if severity == "safe":
            severity = "caution"

    # --- Wind Advisory ---
    if avg_wind >= 50.0:
        advisories.append(
            f"💨 Strong winds forecast (avg {avg_wind:.0f} km/h). Two-wheelers should exercise extra caution on highways and flyovers."
        )
        if severity == "safe":
            severity = "caution"

    # --- All-Clear / Positive Advisory ---
    if not advisories:
        if peak_precip < 0.1 and peak_temp < 35.0 and peak_aqi < 100:
            advisories.append(
                f"✅ Clear skies and comfortable conditions forecast tomorrow. "
                f"Great day to log in early — rides are typically higher during pleasant weather!"
            )
        else:
            advisories.append(
                f"🌤️ Mostly clear conditions expected tomorrow (max temp {peak_temp:.1f}°C, AQI {peak_aqi}). "
                f"Normal shift recommended."
            )
        severity = "safe"

    # Build optimal shift window suggestion
    shift_suggestion = None
    if heavy_rain_hours or extreme_rain_hours:
        bad_hours = set(heavy_rain_hours + extreme_rain_hours)
        good_morning = [h for h in range(5, 12) if h not in bad_hours]
        good_evening = [h for h in range(16, 22) if h not in bad_hours]
        windows = []
        if good_morning:
            windows.append(f"{good_morning[0]:02d}:00–{good_morning[-1] + 1:02d}:00")
        if good_evening:
            windows.append(f"{good_evening[0]:02d}:00–{good_evening[-1] + 1:02d}:00")
        if windows:
            shift_suggestion = "Recommended windows: " + " or ".join(windows)

    return {
        "date": tomorrow_date,
        "severity": severity,
        "title": _severity_to_title(severity),
        "advisories": advisories,
        "shiftSuggestion": shift_suggestion,
        "metrics": {
            "peakPrecipitation": round(peak_precip, 2),
            "peakTemperature": round(peak_temp, 1),
            "peakAqi": peak_aqi,
            "avgWindSpeed": round(avg_wind, 1),
        },
    }


def _severity_to_title(severity: str) -> str:
    return {
        "critical": "⚠️ Critical Weather Alert",
        "warning": "🌧️ Work With Caution Tomorrow",
        "caution": "☀️ Mild Advisory for Tomorrow",
        "safe": "✅ All Clear — Good Day to Ride",
    }.get(severity, "ℹ️ Tomorrow's Advisory")
