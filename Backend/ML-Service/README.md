# 🤖 RideShield ML Service

A production-ready **Machine Learning microservice** built with **FastAPI** that provides real-time disruption intelligence, insurance risk scoring, and payment fraud detection for the RideShield platform. The service integrates live weather data, air quality indexes, and news feeds to compute actionable insights for delivery operations and financial decisions.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [ML Models](#ml-models)
- [Services](#services)
- [Consumers (RabbitMQ)](#consumers-rabbitmq)
- [Utilities](#utilities)
- [Caching Architecture (Redis)](#caching-architecture-redis)
- [Infrastructure Dependencies](#infrastructure-dependencies)
- [Testing](#testing)
- [Configuration & Environment Variables](#configuration--environment-variables)

---

## Overview

The ML Service is a standalone Python microservice responsible for three core intelligence capabilities of RideShield:

| Capability | Description |
|---|---|
| **Zone Disruption Detection** | Detects weather, pollution, and social disruptions (strikes, curfews) for a given GPS coordinate and date |
| **Insurance Risk Scoring** | Estimates insurance risk level and premium adjustment for a delivery zone |
| **Payment Fraud Detection** | Scores payment transactions for anomaly/fraud using an IsolationForest ML model |

The service is decoupled from the main backend and communicates via:
- **REST APIs** (FastAPI) — for on-demand queries
- **RabbitMQ** — for event-driven, async disruption pre-computation triggered by location updates
- **Redis** — for caching computed disruption data with a 30-minute TTL

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance async REST API framework |
| **Uvicorn** | ASGI server for running FastAPI |
| **scikit-learn** | IsolationForest (fraud) and RandomForest (risk) models |
| **XGBoost** | Dependency available for future gradient-boosted models |
| **NumPy / Pandas** | Numerical processing and feature engineering |
| **Redis** | Result caching with configurable TTL |
| **Pika (RabbitMQ)** | Async message consumer for location updates |
| **Pydantic** | Request body validation and schema enforcement |
| **Requests** | HTTP calls to external APIs (Open-Meteo, NewsAPI, Nominatim) |

---

## Project Structure

```
ML-Service/
│
├── run.py                          # Entry point — starts Uvicorn server on port 8000
├── requirements.txt                # Python dependencies
├── test_apis.py                    # Manual API test script (run against localhost)
│
└── app/
    ├── __init__.py
    ├── main.py                     # FastAPI app setup, CORS, router registration, startup hook
    │
    ├── routes/                     # API endpoint definitions (controllers)
    │   ├── __init__.py
    │   ├── disruption.py           # POST /api/ml/zone-disruptions
    │   ├── risk.py                 # POST /api/ml/risk-score
    │   └── fraud.py                # POST /api/ml/fraud-check
    │
    ├── models/                     # In-memory ML model definitions (trained at startup)
    │   ├── __init__.py
    │   ├── fraud_model.py          # IsolationForest anomaly detector (8-feature vector)
    │   └── risk_model.py           # RandomForest risk classifier
    │
    ├── services/                   # Business logic and external API integrations
    │   ├── __init__.py
    │   ├── disruption_service.py   # Orchestrates weather + AQI + news into disruption array
    │   ├── weather_service.py      # Fetches hourly weather from Open-Meteo API
    │   ├── aqi_service.py          # Fetches hourly AQI from Open-Meteo Air Quality API
    │   ├── news_service.py         # Fetches strike/curfew news from NewsAPI
    │   └── redis_service.py        # Redis wrapper with in-memory fallback cache
    │
    ├── consumers/                  # RabbitMQ async event consumers
    │   ├── __init__.py
    │   └── location_consumer.py    # Listens on 'location.update' queue, pre-caches disruptions
    │
    └── utils/                      # Shared utility functions
        ├── __init__.py
        ├── geo_utils.py            # Reverse geocoding (coords → zone/city name) via Nominatim
        └── time_utils.py           # Formats hour integers into HH:MM-HH:MM time window strings
```

---

## Getting Started

### 1. Install dependencies

```bash
cd Backend/ML-Service
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
```

### 2. (Optional) Start Redis

Redis is used for caching disruption results. If Redis is unavailable, the service automatically falls back to an in-memory dictionary cache.

```bash
# Windows (via WSL or Redis for Windows)
redis-server
```

### 3. (Optional) Start RabbitMQ

The RabbitMQ consumer pre-computes disruptions when location updates arrive. If RabbitMQ is unavailable, the consumer simply won't start — the REST APIs continue to work normally.

```bash
rabbitmq-server
```

### 4. Run the service

```bash
python run.py
```

The service starts at `http://localhost:8000`.

- **Swagger UI**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/`

---

## API Endpoints

All endpoints are prefixed with `/api/ml`.

---

### `GET /`

**Health Check** — Confirms the service is running.

**Response:**
```json
{
  "status": "ok",
  "service": "RideShield ML Service"
}
```

---

### `POST /api/ml/zone-disruptions`

**Zone Disruption Detection** — Given a GPS coordinate, pincode, and date, returns all detected disruptions (weather + social).

**Request Body:**
```json
{
  "pincode": "520001",
  "lat": 16.5,
  "lng": 80.6,
  "date": "2026-03-22"
}
```

| Field | Type | Description |
|---|---|---|
| `pincode` | `string` | Postal code for the delivery zone |
| `lat` | `float` | Latitude of the zone center |
| `lng` | `float` | Longitude of the zone center |
| `date` | `string` | Date in `YYYY-MM-DD` format |

**Response (Cache Hit):**
```json
{
  "source": "cache",
  "date": "2026-03-22",
  "zone": "Vijayawada-520001",
  "disruptions": [
    { "time": "03:00-07:00", "type": "rain", "level": "medium" },
    { "time": "00:00-24:00", "type": "strike", "level": "medium", "source": "The Hindu", "title": "..." }
  ]
}
```

**Response (Computed Fresh):**
```json
{
  "source": "computed",
  "date": "2026-03-22",
  "zone": "Vijayawada-520001",
  "disruptions": [...]
}
```

**Disruption Types:**

| Type | Source | Level Values |
|---|---|---|
| `rain` | Open-Meteo rainfall (mm/hr) | `light`, `medium`, `heavy` |
| `heat` | Open-Meteo temperature (°C) | `heavy` (only when > 45°C) |
| `pollution` | Open-Meteo US AQI | `heavy` (only when > 400) |
| `strike` | NewsAPI article keywords | `medium` or `heavy` |
| `curfew` | NewsAPI article keywords | `heavy` |

> **Note:** If no real disruptions are detected, a mock fallback (`rain: heavy` at 03:00–05:00 and `medium` at 19:00–24:00) is returned as a demo sample.

**Caching:** Results are cached in Redis under the key `disruptions:{date}:{pincode}` with a **30-minute TTL**.

---

### `POST /api/ml/risk-score`

**Insurance Risk Scoring** — Returns a risk score and premium adjustment for a delivery zone.

**Request Body:**
```json
{
  "pincode": "520001",
  "season": "monsoon",
  "zoneType": "urban"
}
```

| Field | Type | Description |
|---|---|---|
| `pincode` | `string` | Postal code of the zone |
| `season` | `string` | Season descriptor (e.g., `monsoon`, `summer`, `winter`) |
| `zoneType` | `string` | Zone classification (e.g., `urban`, `rural`, `coastal`) |

**Response:**
```json
{
  "riskScore": 78,
  "riskLevel": "high",
  "premiumAdjustment": 14
}
```

| Field | Description |
|---|---|
| `riskScore` | Integer score (50–95) indicating zone risk |
| `riskLevel` | `low` (≤40), `medium` (40–70), `high` (>70) |
| `premiumAdjustment` | Additional premium amount in % points above base |

---

### `POST /api/ml/fraud-check`

**Payment Fraud Detection** — Scores a transaction using an IsolationForest anomaly detector and returns a verdict.

**Request Body:**
```json
{
  "gps": { "lat": 16.5, "lng": 80.6 },
  "ordersLast2hr": 5,
  "claimsLast30Days": 2,
  "amountINR": 1500.0,
  "hourOfDay": 14,
  "deviceType": "mobile"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `gps` | `object` | — | GPS coordinates of the transaction (reserved for future geo-risk) |
| `ordersLast2hr` | `int` | — | Number of orders placed by the user in the last 2 hours |
| `claimsLast30Days` | `int` | — | Insurance/refund claims by the user in last 30 days |
| `amountINR` | `float` | `500.0` | Transaction amount in INR |
| `hourOfDay` | `int` | `12` | Local hour of the transaction (0–23) |
| `deviceType` | `string` | `mobile` | Device channel: `mobile`, `web`, `pos`, or `unknown` |

**Response:**
```json
{
  "anomalyScore": 0.38,
  "verdict": "approve",
  "features": {
    "ordersLast2hr": 5,
    "claimsLast30Days": 2,
    "amountINR": 1500.0,
    "hourOfDay": 14,
    "deviceType": "mobile",
    "isNightTransaction": false
  }
}
```

**Verdict Thresholds:**

| Verdict | Condition | Meaning |
|---|---|---|
| `approve` | `anomalyScore < 0.45` | Transaction appears normal |
| `review` | `0.45 ≤ anomalyScore < 0.65` | Borderline — manual review recommended |
| `flag` | `anomalyScore ≥ 0.65` | High anomaly — likely fraudulent |

---

## ML Models

### `fraud_model.py` — IsolationForest Fraud Detector

**Algorithm:** `sklearn.ensemble.IsolationForest`

**Purpose:** Detects anomalous payment transactions by learning normal transaction patterns and flagging deviations.

**Feature Vector (8 dimensions):**

| # | Feature | Description |
|---|---|---|
| 0 | `orders_last_2hr` | Burst order rate in 2 hrs (high = suspicious) |
| 1 | `claims_last_30_days` | Claim frequency history (high = risky) |
| 2 | `amount_inr` | Transaction amount in INR |
| 3 | `is_night` | `1` if hour is 22–23 or 0–5, else `0` |
| 4 | `hour_of_day` | Raw hour integer (0–23) |
| 5 | `device_mobile` | One-hot: `1` if device is mobile |
| 6 | `device_web` | One-hot: `1` if device is web |
| 7 | `device_pos` | One-hot: `1` if device is POS |

**Training Data:** Synthetic dataset generated at startup (seed=42 for deterministic results):
- **600 normal samples**: mobile (₹50–₹2,000, 1–4 orders), web (₹100–₹5,000, 1–3 orders), POS (₹10–₹500, 1–2 orders) — all during daytime hours
- **60 anomaly samples**: high bursts (10–30 orders), high claims (5–15), large amounts (₹8,000–₹50,000), mostly at night

**Score Mapping:**
- IsolationForest `decision_function` returns positive for inliers, negative for outliers
- The raw score is inverted and normalized to `[0, 1]` where `1 = highly anomalous`
- `StandardScaler` is applied to normalize features before fitting

**Model Hyperparameters:**
- `n_estimators=200`, `contamination=0.09`, `random_state=42`

---

### `risk_model.py` — RandomForest Risk Classifier

**Algorithm:** `sklearn.ensemble.RandomForestClassifier`

**Purpose:** Provides a risk score and premium adjustment suggestion for a delivery zone based on pincode, season, and zone type.

**Current State:** Trained on a small dummy dataset as a placeholder scaffold. The risk score is currently derived probabilistically from the zone inputs.  

**Output:**
- `riskScore`: Integer (50–95)
- `riskLevel`: `low` / `medium` / `high`
- `premiumAdjustment`: Points above base premium; `0` if risk score ≤ 50

---

## Services

### `disruption_service.py` — Disruption Orchestrator

**Primary Function:** `build_disruption_array(lat, lng, date, pincode)`

**What it does:**
1. Calls `weather_service` → hourly temperature + precipitation data for 24 hours
2. Calls `aqi_service` → hourly US AQI values for 24 hours
3. Calls `news_service` → strike/curfew news articles for the region
4. Iterates over each hour (0–23) applying IMD thresholds to detect disruption windows:
   - **Rain:** > 0.5 mm/hr triggers a window; classified as `light` (≤2mm peak), `medium` (≤7.5mm), or `heavy` (>7.5mm)
   - **Heat:** > 45°C triggers a `heavy` heat window
   - **Pollution:** AQI > 400 triggers a `heavy` pollution window
5. Merges weather disruptions + social disruptions into a unified array
6. Returns: `{ date, zone, disruptionsByType: { weather, social }, disruptions }`

---

### `weather_service.py` — Open-Meteo Weather

**Function:** `get_hourly_weather(lat, lng, date)`

**External API:** [Open-Meteo Forecast API](https://open-meteo.com/)  
**Endpoint:** `https://api.open-meteo.com/v1/forecast`  
**Parameters fetched:** `temperature_2m`, `precipitation` (hourly, timezone=auto)

**Returns:** List of 24 dicts: `{ time, full_time, temperature, precipitation }`

**Fallback:** If the API call fails (network error, bad response), returns 24 hours of safe default values — `temperature=25.0°C`, `precipitation=0.0mm`.

---

### `aqi_service.py` — Open-Meteo Air Quality

**Function:** `get_hourly_aqi(lat, lng, date)`

**External API:** [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)  
**Endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality`  
**Parameter fetched:** `us_aqi` (hourly)

**Returns:** List of 24 integer AQI values.

**Fallback:** Returns `[100] * 24` (clean air baseline) if the API fails.

---

### `news_service.py` — NewsAPI Strike & Curfew Intel

**Function:** `get_local_news(lat, lng, date, pincode)`

**External API:** [NewsAPI](https://newsapi.org/) — `v2/everything` endpoint  
**API Key:** Configurable via `NEWS_API_KEY` environment variable

**How it works:**
1. **Reverse geocode** the GPS coordinates using Nominatim to get city/state name
2. Build a **boolean NewsAPI query**: `(strike OR curfew OR bandh OR hartal OR shutdown) AND "{city}"`
3. For each article returned:
   - Skip articles that don't contain strike/curfew keywords in `title + description`
   - Further filter to ensure the article is geographically relevant to the queried city/state
   - Classify as `strike` or `curfew` using regex pattern matching
   - Assign severity: `heavy` for curfew, bandh, hartal, shutdown; `medium` for general strikes
4. Returns up to **3 disruption entries** per query

**Output format per entry:**
```json
{
  "time": "00:00-24:00",
  "type": "strike",
  "level": "medium",
  "source": "The Hindu",
  "title": "Auto-rickshaw strike cripples Vijayawada..."
}
```

---

### `redis_service.py` — Redis Cache Wrapper

**Class:** `RedisService`

**Connects to:** `localhost:6379`, database `0`

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `get` | `get(key: str) → dict \| None` | Fetches a JSON-deserialized value from Redis |
| `set` | `set(key: str, value: dict, ttl: int = 1800)` | Stores a JSON-serialized value with TTL (default 30 min) |

**Graceful Degradation:** If Redis is not running, the service automatically switches to an in-memory Python dictionary (`_fallback_cache`). The API continues to work normally — results just aren't persisted across restarts.

---

## Consumers (RabbitMQ)

### `location_consumer.py` — Location Update Consumer

**Queue:** `location.update` (durable)  
**Connection:** `localhost:5672`

**Purpose:** Listens for location update events published by the main backend. When a new location message arrives, it **pre-computes and caches** the disruption data for that zone — so when the delivery partner or user actually queries the disruption API, the result is served instantly from cache.

**Message format expected from queue:**
```json
{
  "pincode": "520001",
  "lat": 16.5,
  "lng": 80.6,
  "date": "2026-03-22"
}
```

**Processing logic (`callback`):**
1. Deserialize the message body
2. Check Redis for an existing cache entry (`disruptions:{date}:{pincode}`)
3. If cache hit → skip (no duplicate computation)
4. If cache miss → call `build_disruption_array()` and store result in Redis with 30-min TTL

**Threading:** The consumer runs in a **daemon thread** (`run_consumer_in_background()`), started automatically at FastAPI startup via the `@app.on_event("startup")` hook. It does not block the main HTTP server.

**Graceful Degradation:** If RabbitMQ is unavailable, a warning is logged and the consumer silently exits. The REST APIs remain fully functional.

---

## Utilities

### `geo_utils.py` — Reverse Geocoding

**Function:** `get_zone_name(lat, lng, fallback_pincode)`

**External API:** [Nominatim OpenStreetMap](https://nominatim.openstreetmap.org/)  
**User-Agent:** `RideShield-ML-Service/1.0`

**What it does:** Resolves GPS coordinates into a human-readable zone name by trying address fields in order of specificity:
`city → town → municipality → village → county → state_district → district → state`

**Returns:** `"CityName-Postcode"` (e.g., `"Vijayawada-520001"`)  
**Fallback:** Returns `"zone-{pincode}"` if Nominatim is unavailable.

---

### `time_utils.py` — Time Window Formatter

**Function:** `format_time_window(start_hour, end_hour)`

**What it does:** Converts integer hour values to a human-readable `HH:MM-HH:MM` time range string.

**Example:**
```python
format_time_window(3, 7)   # → "03:00-07:00"
format_time_window(19, 24) # → "19:00-24:00"
```

---

## Caching Architecture (Redis)

| Key Pattern | Value Type | TTL | Set By |
|---|---|---|---|
| `disruptions:{date}:{pincode}` | JSON dict (full disruption payload) | 30 mins | `disruption.py` route & `location_consumer.py` |

**Cache flow for `/zone-disruptions`:**
```
Request → Check Redis
    ├── HIT  → return cached result immediately (source: "cache")
    └── MISS → compute disruptions → store in Redis → return (source: "computed")
```

**Mock fallback:** The `_apply_mock_if_empty()` function in `disruption.py` ensures the `disruptions` array is never empty — if neither weather nor social disruptions are detected, a pre-defined demo set is injected.

---

## Infrastructure Dependencies

| Service | Role | Required? |
|---|---|---|
| **Redis** (port 6379) | Caches disruption results for 30 minutes | Optional — falls back to in-memory |
| **RabbitMQ** (port 5672) | Delivers `location.update` events for pre-computation | Optional — REST APIs work without it |
| **Open-Meteo API** | Weather (temperature, precipitation) and AQI data | Requires internet; has safe fallback |
| **NewsAPI** | Strike/curfew news articles | Requires API key; returns empty list on failure |
| **OSM Nominatim** | Reverse geocoding GPS → city/zone name | Requires internet; has pincode fallback |

---

## Testing

### Automated test script (manual runner)

```bash
# Make sure the server is running first
python run.py

# In another terminal
python test_apis.py
```

`test_apis.py` runs the following tests sequentially:
1. **Health check** — `GET /`
2. **Zone disruptions** — `POST /api/ml/zone-disruptions` (pincode: 520001, Vijayawada)
3. **Risk score** — `POST /api/ml/risk-score` (monsoon, urban)
4. **Fraud check** — `POST /api/ml/fraud-check` (5 orders in 2hr, 2 claims)

### Swagger UI

All endpoints are fully documented with request/response schemas in the interactive Swagger UI:

```
http://localhost:8000/docs
```

---

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEWS_API_KEY` | `""` | NewsAPI.org API key for fetching strike/curfew articles |

> ⚠️ **Security Note:** Always set this via environment variable or a secrets manager.

Set via shell before running:
```bash
# Windows PowerShell
$env:NEWS_API_KEY = "your_actual_key_here"
python run.py
```

---

## CORS

CORS is configured to allow **all origins** (`*`) to facilitate frontend integration during development. For production deployment, restrict `allow_origins` to your specific frontend domain in `app/main.py`.

---

*RideShield ML Service — Built with FastAPI, scikit-learn, and real-time public APIs.*
