# ── ML-Service (Python / FastAPI) ────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install system deps needed for some Python packages (numpy, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Force unbuffered output so logs appear immediately in docker logs
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "run.py"]
