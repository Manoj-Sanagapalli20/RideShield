import os
import datetime
import requests
import logging
from datetime import date as date_type

logger = logging.getLogger(__name__)



def get_hourly_weather(lat: float, lng: float, date: str):
    """
    Fetches weather data from Open-Meteo for 3 coordinates (lat, lat + 2km, lat - 2km)
    and merges them by taking the maximum temperature and precipitation.
    - Past dates → archive API
    - Today/future → forecast API
    Returns full day weather data as a list of dicts.
    """
    try:
        today = date_type.today().isoformat()

        # If date is in the future, return fallback directly
        if date > today:
            logger.info(f"[WeatherService] Date {date} is in the future. Returning fallback.")
            return [
                {
                    "time": f"{str(i).zfill(2)}:00",
                    "full_time": f"{date}T{str(i).zfill(2)}:00",
                    "temperature": 25.0,
                    "precipitation": 0.0
                }
                for i in range(24)
            ]

        # Offset latitudes by +/- 0.018 degrees (~2 km North/South)
        lat_north = lat + 0.018
        lat_south = lat - 0.018

        lat_param = f"{lat},{lat_north:.6f},{lat_south:.6f}"
        lng_param = f"{lng},{lng:.6f},{lng:.6f}"

        # Always use the Archive API to get real, measured physical weather station records
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat_param}&longitude={lng_param}"
            f"&hourly=temperature_2m,precipitation"
            f"&timezone=auto"
            f"&start_date={date}&end_date={date}"
        )
        logger.info(f"[WeatherService] Using ARCHIVE API for date: {date}")

        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            logger.warning(f"[WeatherService] API error {response.status_code}: {response.text[:200]}")
            raise Exception("API request failed")

        raw_response = response.json()

        # Open-Meteo returns a list of dictionaries when querying multiple locations
        if isinstance(raw_response, list):
            raw_data_list = raw_response
        elif isinstance(raw_response, dict):
            raw_data_list = [raw_response]
        else:
            raise Exception("Invalid API response format")

        if not raw_data_list or 'hourly' not in raw_data_list[0]:
            raise Exception("Invalid or missing hourly data in API response")

        # Use the first coordinate's offset for timezone calculations
        utc_offset = raw_data_list[0].get('utc_offset_seconds', 0)
        import datetime
        now_utc = datetime.datetime.utcnow()
        local_now = now_utc + datetime.timedelta(seconds=utc_offset)
        local_today_str = local_now.date().isoformat()
        current_local_hour = local_now.hour

        # Determine the number of hours (usually 24)
        times = raw_data_list[0]['hourly'].get('time') or []
        n_hours = len(times)

        # Merge the weather data across all coordinates (taking max temp and max precip)
        merged_precips = []
        merged_temps = []

        for i in range(n_hours):
            p_values = []
            t_values = []
            for item in raw_data_list:
                if not item or 'hourly' not in item:
                    continue
                h = item['hourly']
                
                item_p = h.get('precipitation') or []
                p_val = item_p[i] if i < len(item_p) and item_p[i] is not None else 0.0
                p_values.append(p_val)

                item_t = h.get('temperature_2m') or []
                t_val = item_t[i] if i < len(item_t) and item_t[i] is not None else 25.0
                t_values.append(t_val)

            merged_precips.append(max(p_values) if p_values else 0.0)
            merged_temps.append(max(t_values) if t_values else 25.0)

        # Query Tomorrow.io if API key is present
        tomorrow_api_key = os.getenv("TOMORROW_API_KEY")
        tomorrow_data = {}
        if tomorrow_api_key:
            logger.info(f"[WeatherService] Querying Tomorrow.io API for lat={lat}, lng={lng}, date={date}")
            try:
                tomorrow_url = f"https://api.tomorrow.io/v4/weather/forecast?location={lat},{lng}&timesteps=1h&units=metric&apikey={tomorrow_api_key}&timezone=auto"
                tomorrow_res = requests.get(tomorrow_url, timeout=10)
                if tomorrow_res.status_code == 200:
                    tomorrow_json = tomorrow_res.json()

                    # Helper function to parse ISO timestamps with local offsets
                    def get_local_hour_and_date(t_str: str, offset: int):
                        try:
                            t_clean = t_str.replace('Z', '+00:00')
                            dt = datetime.datetime.fromisoformat(t_clean)
                            if dt.tzinfo is not None:
                                dt_utc = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                                dt_local = dt_utc + datetime.timedelta(seconds=offset)
                            else:
                                dt_local = dt + datetime.timedelta(seconds=offset)
                            return dt_local.date().isoformat(), dt_local.hour
                        except Exception as parse_e:
                            logger.error(f"[WeatherService] Tomorrow.io timestamp parse error: {parse_e}")
                            return None, None

                    # Parse Format A (data -> timelines -> intervals)
                    if "data" in tomorrow_json and "timelines" in tomorrow_json["data"]:
                        for timeline in tomorrow_json["data"]["timelines"]:
                            if timeline.get("timestep") == "1h":
                                for interval in timeline.get("intervals", []):
                                    t_str = interval.get("startTime") or interval.get("time")
                                    vals = interval.get("values", {})
                                    if t_str and vals:
                                        t_date, t_hour = get_local_hour_and_date(t_str, utc_offset)
                                        if t_date == date and t_hour is not None:
                                            tomorrow_data[t_hour] = {
                                                "temperature": vals.get("temperature"),
                                                "precipitation": vals.get("precipitationIntensity")
                                            }

                    # Parse Format B (timelines -> hourly)
                    if "timelines" in tomorrow_json:
                        timelines_obj = tomorrow_json["timelines"]
                        if isinstance(timelines_obj, dict) and "hourly" in timelines_obj:
                            for interval in timelines_obj["hourly"]:
                                t_str = interval.get("time") or interval.get("startTime")
                                vals = interval.get("values", {})
                                if t_str and vals:
                                    t_date, t_hour = get_local_hour_and_date(t_str, utc_offset)
                                    if t_date == date and t_hour is not None:
                                        tomorrow_data[t_hour] = {
                                            "temperature": vals.get("temperature"),
                                            "precipitation": vals.get("precipitationIntensity")
                                        }
                    logger.info(f"[WeatherService] Successfully fetched and parsed Tomorrow.io data for {len(tomorrow_data)} hour(s)")
                else:
                    logger.warning(f"[WeatherService] Tomorrow.io API returned status {tomorrow_res.status_code}: {tomorrow_res.text[:200]}")
            except Exception as tomorrow_e:
                logger.error(f"[WeatherService] Failed to query Tomorrow.io API: {tomorrow_e}")

        # Merge Tomorrow.io data into the Open-Meteo arrays (using Gatekeeper logic)
        for i in range(n_hours):
            open_meteo_p = merged_precips[i]
            
            # Merge temperature using max as before
            if i in tomorrow_data:
                t_val = tomorrow_data[i].get("temperature")
                if t_val is not None:
                    merged_temps[i] = max(merged_temps[i], float(t_val))

            # Merge precipitation using Gatekeeper logic
            if open_meteo_p > 0.0:
                if i in tomorrow_data:
                    p_val = tomorrow_data[i].get("precipitation")
                    if p_val is not None:
                        merged_precips[i] = max(open_meteo_p, float(p_val))
            else:
                # If physical stations show 0.0 rain, ignore Tomorrow.io forecast
                merged_precips[i] = 0.0

        logger.info(
            f"[WeatherService] Merged Records: {n_hours}, Max rain: {max(merged_precips) if merged_precips else 0}"
        )

        weather_data = []
        for i in range(n_hours):
            t = times[i]
            p = merged_precips[i]
            temp = merged_temps[i]

            # If the queried date is today's local date, filter out future hours
            if date == local_today_str:
                if i > current_local_hour:
                    p = 0.0
                    temp = 25.0
            # If the queried date is in the future, filter out all hours
            elif date > local_today_str:
                p = 0.0
                temp = 25.0

            weather_data.append({
                "time": t[-5:],  # HH:MM
                "full_time": t,
                "temperature": temp,
                "precipitation": p
            })

        return weather_data

    except Exception as e:
        logger.error(f"[WeatherService] Error: {e}")

        # ✅ fallback (VERY IMPORTANT)
        return [
            {
                "time": f"{str(i).zfill(2)}:00",
                "full_time": f"{date}T{str(i).zfill(2)}:00",
                "temperature": 25.0,
                "precipitation": 0.0
            }
            for i in range(24)
        ]