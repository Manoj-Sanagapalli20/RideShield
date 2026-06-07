# Payment Service

Production-grade Payment Service for the insurance platform. This service consumes events from RabbitMQ, processes subscription payments and claim payouts idempotently using Redis, and publishes results back to RabbitMQ.

## 🧱 Architecture

- **Node.js + Express** (Healthchecks and Server Base)
- **MongoDB (Mongoose)** (Stores payment and payout records)
- **Redis** (Handles idempotent processing to prevent duplicate processing)
- **RabbitMQ** (Event-driven message broker)
- **Stripe SDK** (API for Payments and Payouts)

## 🚀 Setup Instructions

### 1. Prerequisites
Ensure you have the following installed:
- Node.js (v18+)
- MongoDB
- Redis
- RabbitMQ
- Stripe Account (Test Mode)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and configure the values:
```bash
cp .env.example .env
```
Ensure you provide valid values for `STRIPE_SECRET_KEY`.

### 4. Run the Service Locally
**Development Mode:**
```bash
npm run dev
```

## 🚢 Production Deployment (Docker)

The service is fully containerized and production-ready. A `docker-compose.yml` is provided to spin up the entire ecosystem (Payment Service, MongoDB, Redis, RabbitMQ) automatically.

### Deploying the Ecosystem
```bash
# Build and start all containers in detached mode
docker-compose up --build -d
```

### Viewing Logs
```bash
docker-compose logs -f payment-service
```

### Stopping the Services
```bash
docker-compose down
```

## 🔁 RabbitMQ Setup & Testing Locally

The service automatically configures the RabbitMQ Exchange (`events`) and Dead Letter Exchanges/Queues upon startup.

### Local Testing Tool

A local testing tool is built right into your package to instantly inject mock JSON events into RabbitMQ rather than relying on another microservice to trigger them. You can run it locally with:

```bash
npm run test:produce
```

### Sample Messages to Test via RabbitMQ UI

You can publish the following JSON messages directly from the RabbitMQ Management UI (`http://localhost:15672/`) to the `events` exchange.

#### 1. Subscription Purchase
**Routing Key:** `subscription.purchase`
```json
{
  "eventId": "evt_12345",
  "type": "SUBSCRIPTION_PURCHASE",
  "userId": "user_001",
  "plan": "PRO",
  "amount": 499,
  "timestamp": "2023-10-27T10:00:00Z"
}
```

#### 2. Claim Approved (Payout)
**Routing Key:** `claim.approved`
```json
{
  "eventId": "evt_98765",
  "type": "CLAIM_APPROVED",
  "claimId": "clm_555",
  "userId": "user_002",
  "payoutAmount": 1500,
  "reason": "Medical Emergency",
  "timestamp": "2023-10-27T12:00:00Z"
}
```

## ⚠️ Important Notes
- This service does **not** calculate payouts. It strictly acts as an executor based on events.
- To prevent duplicate payouts or payments on RabbitMQ retries, **Redis** is used as a distributed lock/idempotency store.
- Erroneous messages are rejected (`requeue: false`) and automatically sent to a Dead Letter Queue (`dlq.subscription` or `dlq.claim`).
