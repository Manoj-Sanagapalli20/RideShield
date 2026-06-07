import sys
from .weather_service import get_hourly_weather
from .aqi_service import get_hourly_aqi
from .news_service import get_local_news
from ..utils.time_utils import format_time_window
from ..utils.geo_utils import get_zone_name


def _p(msg="", flush=True):
    """Unbuffered print that always shows in terminal even from background threads."""
    sys.stdout.write(msg + "\n")
    if flush:
        sys.stdout.flush()


def build_disruption_array(lat: float, lng: float, date: str, pincode: str):
    weather_data = get_hourly_weather(lat, lng, date)
    aqi_data = get_hourly_aqi(lat, lng, date)
    news_disruptions = get_local_news(lat, lng, date, pincode=pincode)

    rain_list = [float(hour.get('precipitation', 0.0)) for hour in weather_data]
    rain_data = rain_list[:24]

    temp_list = [float(hour.get('temperature', 25.0)) for hour in weather_data]
    temp_data = temp_list[:24]

    disruptions = []

    def _add(t_type, start, end, level="medium"):
        disruptions.append({
            "time": format_time_window(start, end),
            "type": t_type,
            "level": level
        })

    current_rain_start = None
    current_heat_start = None
    current_poll_start = None

    for hour in range(24):
        rain = rain_data[hour] if rain_data and hour < len(rain_data) and rain_data[hour] is not None else 0
        temp = temp_data[hour] if temp_data and hour < len(temp_data) and temp_data[hour] is not None else 25
        aqi = aqi_data[hour] if aqi_data and hour < len(aqi_data) and aqi_data[hour] is not None else 100

        # 🌧 Rain detection
        if rain > 0.5:
            if current_rain_start is None:
                current_rain_start = hour
        else:
            if current_rain_start is not None:
                peak = max(rain_data[current_rain_start:hour])
                level = "heavy" if peak > 7.5 else "medium" if peak > 2.0 else "light"
                _add("rain", current_rain_start, hour, level=level)
                current_rain_start = None

        # 🔥 Heat detection
        if temp > 45:
            if current_heat_start is None:
                current_heat_start = hour
        else:
            if current_heat_start is not None:
                _add("heat", current_heat_start, hour, level="heavy")
                current_heat_start = None

        # 💨 Pollution detection
        if aqi > 400:
            if current_poll_start is None:
                current_poll_start = hour
        else:
            if current_poll_start is not None:
                _add("pollution", current_poll_start, hour, level="heavy")
                current_poll_start = None

    # Handle ongoing events till end of day
    if current_rain_start is not None:
        peak = max(rain_data[current_rain_start:24])
        level = "heavy" if peak > 7.5 else "medium" if peak > 2.0 else "light"
        _add("rain", current_rain_start, 24, level=level)

    if current_heat_start is not None:
        _add("heat", current_heat_start, 24, level="heavy")

    if current_poll_start is not None:
        _add("pollution", current_poll_start, 24, level="heavy")

    # Merge disruptions
    weather_disruptions = disruptions
    social_disruptions = news_disruptions
    final_disruptions = weather_disruptions + social_disruptions

    # ── Terminal Output (clean debug logs) ──
    W = 62
    _p()
    _p("=" * W)
    _p(f"  [ML] CALCULATION DONE  |  {date}  |  lat={lat}, lng={lng}")
    _p("=" * W)

    rainy_hours = [(i, rain_data[i], temp_data[i]) for i in range(len(rain_data)) if rain_data[i] > 0]
    if rainy_hours:
        _p(f"  Rain detected in {len(rainy_hours)} hour(s):")
        _p(f"  {'Hour':<8} {'Rain(mm)':<12} {'Temp(C)':<10} Status")
        _p("  " + "-" * 44)
        for hr, rain, temp in rainy_hours:
            flag = ">>> DISRUPTION" if rain > 0.5 else "trace"
            _p(f"  {str(hr).zfill(2)}:00   {rain:<12.2f} {temp:<10.1f} {flag}")
    else:
        _p("  No rain detected in any hour.")

    _p("-" * W)

    if not final_disruptions:
        _p("  RESULT: Clear — no disruption events.")
    else:
        _p(f"  RESULT: {len(final_disruptions)} disruption event(s) found:")
        for i, d in enumerate(final_disruptions, 1):
            dtype = d.get("type", "?").upper()
            level = d.get("level", "?")
            window = d.get("time", "?")
            _p(f"  {i}. [{dtype}]  Level: {level:<8}  Window: {window}")

    if social_disruptions:
        _p(f"  Social events: {len(social_disruptions)}")
        for s in social_disruptions:
            _p(f"    -> {s.get('type','?')} | {s.get('time','?')}")

    _p("=" * W)
    _p()

    return {
        "date": date,
        "lat": lat,
        "lng": lng,
        "zone": get_zone_name(lat, lng, pincode),
        "disruptionsByType": {
            "weather": weather_disruptions,
            "social": social_disruptions,
        },
        "disruptions": final_disruptions,
    }