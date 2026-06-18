"""
News service — fetches strike / curfew / bandh disruptions from NewsAPI.

Region accuracy
---------------
The query is built using the real city/state name resolved from the GPS
coordinates (via Nominatim).  If geocoding fails the pincode is used as a
last-resort location hint so results always stay region-specific.

Output format
-------------
Each disruption entry contains:
  time   : "00:00-24:00"   (full-day impact assumed for news events)
  type   : "strike" | "curfew"   (derived from article keywords)
  level  : "heavy" | "medium"
  source : name of the news source
  title  : headline of the article
"""

import re
import requests
import logging
import os

logger = logging.getLogger(__name__)

NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")

# ── Keywords used to classify and filter articles ─────────────────────────────
_CURFEW_PATTERN = re.compile(r"\bcurfew\b", re.IGNORECASE)
_STRIKE_PATTERN = re.compile(r"\b(strike|bandh|hartal|shutdown|blockade)\b", re.IGNORECASE)
_IGNORE_PATTERN = re.compile(
    r"\b(air strike|missile strike|military strike|precision strike|drone strike|surgical strike|"
    r"hunger strike|lightning strike|strike a deal|strike gold|strike a balance|strike a chord|"
    r"government shutdown)\b",
    re.IGNORECASE
)


def _resolve_location(lat: float, lng: float) -> dict:
    """
    Returns a dict with the best available names for the region:
      city, state, country, query_term
    Uses the cached reverse geocoding utility.
    """
    from ..utils.geo_utils import reverse_geocode_coords
    geo = reverse_geocode_coords(lat, lng)
    
    city = geo.get("city", "")
    state = geo.get("state", "")
    country = geo.get("country", "")
    query_term = (city or state or "").strip()
    
    return {
        "city": city,
        "state": state,
        "country": country,
        "query_term": query_term
    }


def _classify_disruption(text: str) -> str:
    """Determine disruption type from article text."""
    if _CURFEW_PATTERN.search(text):
        return "curfew"
    return "strike"


def get_local_news(lat: float, lng: float, date: str, pincode: str = "") -> list:
    """
    Fetches strike / curfew alerts for the given region using NewsAPI.

    Steps
    -----
    1. Resolve GPS → city/state name.
    2. Build a tight NewsAPI query: keywords AND location.
    3. For each matching article:
       - Skip if neither strike nor curfew keywords appear in title/description.
       - Classify as "strike" or "curfew".
       - Assign level based on keyword severity.

    Returns a list of disruption dicts (may be empty if no relevant news).
    """
    location_info = _resolve_location(lat, lng)
    location_term = location_info["query_term"]

    # Fall back to pincode as a search hint if geocoding returned nothing
    if not location_term and pincode:
        location_term = pincode

    # Build boolean query — narrow to the location AND strike/curfew keywords
    keyword_clause = "(strike OR curfew OR bandh OR hartal OR shutdown)"
    if location_term:
        query = f"{keyword_clause} AND \"{location_term}\""
    else:
        query = keyword_clause

    disruptions = []

    try:
        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={requests.utils.quote(query)}"
            f"&from={date}"
            f"&to={date}"
            f"&sortBy=publishedAt"
            f"&language=en"
            f"&pageSize=10"
            f"&apiKey={NEWS_API_KEY}"
        )
        res = requests.get(url, timeout=6)

        if res.status_code != 200:
            logger.warning(f"NewsAPI returned {res.status_code}: {res.text[:200]}")
            return disruptions

        articles = res.json().get("articles", [])

        for article in articles:
            title       = article.get("title") or ""
            description = article.get("description") or ""
            combined    = f"{title} {description}"

            # Skip military, hunger, metaphorical or non-transportation strikes
            if _IGNORE_PATTERN.search(combined):
                continue

            # Only keep articles that are genuinely about strikes or curfews
            is_curfew = bool(_CURFEW_PATTERN.search(combined))
            is_strike = bool(_STRIKE_PATTERN.search(combined))

            if not (is_curfew or is_strike):
                continue

            # Further filter: ensure the article is actually about our region
            if location_term:
                region_matched = False
                if location_term.lower() in combined.lower():
                    region_matched = True
                else:
                    state = location_info.get("state", "")
                    if state and state.lower() in combined.lower():
                        region_matched = True
                
                if not region_matched:
                    continue

            disruption_type = "curfew" if is_curfew else "strike"

            # Severity: curfew is always heavy; bandh/hartal/shutdown = heavy; regular strike = medium
            strike_match = _STRIKE_PATTERN.search(combined)
            matched_word = strike_match.group(0).lower() if strike_match else ""
            if is_curfew or matched_word in ("bandh", "hartal", "shutdown"):
                level = "heavy"
            else:
                level = "medium"

            disruptions.append({
                "time":   "00:00-24:00",
                "type":   disruption_type,
                "level":  level,
                "source": article.get("source", {}).get("name", "Unknown"),
                "title":  title[:120],   # truncate very long headlines
            })

            if len(disruptions) >= 3:
                break

    except Exception as e:
        logger.error(f"News API error: {e}")

    return disruptions
