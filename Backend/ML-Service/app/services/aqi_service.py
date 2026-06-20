import requests
import re
import logging
import pandas as pd
from ..utils.geo_utils import calculate_distance

logger = logging.getLogger(__name__)

# Global in-memory cache to store parsed features of stations.geojson
_STATIONS_CACHE = None

def clean_name(s: str) -> str:
    """
    Cleans name for constructing Vayuayan archive filename.
    Converts to lowercase, replaces non-alphanumeric sequences with a single underscore,
    and strips leading/trailing underscores.
    """
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    s = s.strip('_')
    return s

def fetch_stations_geojson() -> list:
    """
    Fetches the stations geojson from the Vayuayan archive and caches it in memory.
    """
    global _STATIONS_CACHE
    if _STATIONS_CACHE is not None:
        return _STATIONS_CACHE
    try:
        url = "https://saket-choudhary.me/vayuayan-archive/stations.geojson"
        logger.info(f"Fetching Vayuayan stations geojson from {url}")
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            _STATIONS_CACHE = resp.json().get("features", [])
            logger.info(f"Successfully loaded {len(_STATIONS_CACHE)} stations from Vayuayan geojson")
            return _STATIONS_CACHE
    except Exception as e:
        logger.warning(f"Failed to fetch stations geojson: {e}")
    return []

def get_fallback_open_meteo(lat: float, lng: float, date: str) -> list:
    """
    Fallback method to query the Open-Meteo Air Quality API for global US AQI.
    """
    logger.info("Falling back to Open-Meteo AQI API")
    try:
        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lng}&hourly=us_aqi&start_date={date}&end_date={date}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            us_aqi = data.get('hourly', {}).get('us_aqi', [])
            if len(us_aqi) >= 24:
                return us_aqi[:24]
    except Exception as e:
        logger.error(f"Open-Meteo AQI API error: {e}")
    # Absolute safe fallback
    return [100] * 24

def get_hourly_aqi(lat: float, lng: float, date: str) -> list:
    """
    Fetches hourly AQI data dynamically:
    1. Finds the closest CPCB ground station from Vayuayan archive within 20km.
    2. If found, queries its CSV data and returns the max subindex/average AQI.
    3. Otherwise, falls back to the global Open-Meteo Air Quality API.
    """
    features = fetch_stations_geojson()
    
    closest_station = None
    min_dist = float('inf')
    
    for f in features:
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [])
        if len(coords) >= 2:
            st_lng, st_lat = coords[0], coords[1]
            dist = calculate_distance(lat, lng, st_lat, st_lng)
            if dist < min_dist:
                min_dist = dist
                closest_station = f
                
    if closest_station and min_dist <= 20.0:
        props = closest_station.get("properties", {})
        station_id = props.get("station_id")
        state_cleaned = clean_name(props.get("state", ""))
        city_cleaned = clean_name(props.get("city", ""))
        name_cleaned = clean_name(props.get("station_name", ""))
        
        filename = f"{state_cleaned}__{city_cleaned}__{name_cleaned}__{station_id}.csv.gz"
        url = f"https://saket-choudhary.me/vayuayan-archive/data/{filename}"
        
        logger.info(f"Nearest CPCB station: {props.get('station_name')} ({min_dist:.2f} km). Querying: {url}")
        
        try:
            df = pd.read_csv(url, compression='gzip')
            df = df.dropna(subset=['timestamp'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            df = df.dropna(subset=['timestamp'])
            
            day_df = df[df['timestamp'].dt.strftime('%Y-%m-%d') == date].copy()
            if not day_df.empty:
                subindex_cols = [
                    'PM2.5_subindex', 'PM10_subindex', 'SO2_subindex', 
                    'NO2_subindex', 'OZONE_subindex', 'CO_subindex', 'NH3_subindex'
                ]
                avg_cols = ['PM2.5_avg', 'PM10_avg']
                
                # Ensure columns exist and convert to numeric
                for col in subindex_cols + avg_cols:
                    if col in day_df.columns:
                        day_df[col] = pd.to_numeric(day_df[col], errors='coerce')
                
                present_cols = [c for c in subindex_cols + avg_cols if c in day_df.columns]
                day_df['aqi_val'] = day_df[present_cols].max(axis=1)
                
                hourly_aqi = []
                for hour in range(24):
                    hour_df = day_df[day_df['timestamp'].dt.hour == hour]
                    if not hour_df.empty:
                        val = hour_df['aqi_val'].mean()
                        if pd.isna(val):
                            hourly_aqi.append(None)
                        else:
                            hourly_aqi.append(int(round(val)))
                    else:
                        hourly_aqi.append(None)
                        
                # Linearly interpolate missing hours
                s = pd.Series(hourly_aqi)
                s = s.interpolate(method='linear', limit_direction='both')
                s = s.fillna(100) # Fallback baseline
                result = [int(round(x)) for x in s.tolist()]
                
                logger.info(f"Dynamically resolved hourly CPCB AQI from station for date {date}: max={max(result)}")
                return result
            else:
                logger.warning(f"No CPCB data found in CSV for date {date}")
        except Exception as e:
            logger.warning(f"Failed to query or parse CPCB station CSV: {e}")
            
    logger.info("Using standard Open-Meteo fallback for AQI")
    return get_fallback_open_meteo(lat, lng, date)
