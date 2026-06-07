import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.disruption import router as disruption_router
from .routes.risk import router as risk_router
from .routes.fraud import router as fraud_router
from .consumers.location_consumer import run_consumer_in_background

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="RideShield ML Service")

# Added CORS middleware to fix "Failed to fetch" browser errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(disruption_router, prefix="/api/ml", tags=["Disruptions"])
app.include_router(risk_router, prefix="/api/ml", tags=["Risk"])
app.include_router(fraud_router, prefix="/api/ml", tags=["Fraud"])

@app.on_event("startup")
def startup_event():
    run_consumer_in_background()

@app.get("/")
def health_check():
    return {"status": "ok", "service": "RideShield ML Service"}
