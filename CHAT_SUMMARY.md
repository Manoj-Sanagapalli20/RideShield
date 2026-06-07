# 🛡️ RideShield - Project Transition & Security Audit Summary

This document provides a comprehensive summary of the work done to transition the project, configure cloud credentials, audit/clean up branding, and secure the codebase against credential leakage before pushing to GitHub.

---

## 1. Project Transition & Refactoring
* **Concept Shift:** Refactored a food-delivery insurance architecture (NichePay / DummyZomato) into a ride-hailing parametric insurance platform (RideShield / DummyRapido).
* **Mock Simulation Engine:** Removed the empty legacy folder `Frontend/DummyZomato` and fully integrated `DummyRapido` (backend on port `5000`, frontend on port `5174`).
* **Service Fallbacks:** Cleaned up code references fallback routes (`process.env.DUMMYZOMATO_URL`) in PolicyService, MainService, and AuthService, replacing them with the new `DUMMYRAPIDO_URL`.
* **Monolith Dockerfile:** Updated the Monolithic Dockerfile configuration to build `DummyRapido` dependencies instead of `DummyZomato`, exposing the updated ports and internal environment variables.

---

## 2. Cloud Infrastructure & Credentials Setup
We successfully connected the local microservice architecture to your remote cloud instances:
* **Database (MongoDB Atlas):** Configured `MONGO_URI` in `PaymentService/.env` and `DummyRapido/backend/.env` using your Atlas connection string (real credentials replaced with placeholders):
  `mongodb+srv://<username>:<password>@rideshield.xurwmbh.mongodb.net/`
* **Message Queue (CloudAMQP RabbitMQ):** Configured all services to use:
  `amqps://<username>:<password>@puffin.rmq2.cloudamqp.com/<vhost>`
* **Caching (Upstash Redis):** Configured `REDIS_URL` in `PaymentService/.env` and `ML-Service/.env` using the TLS-enabled Upstash Redis instance:
  `rediss://default:<password>@useful-hagfish-115554.upstash.io:6379`
* **Mock Stripe payments:** Standardized the `STRIPE_SECRET_KEY` value as `sk_test_dummy` (Mock Mode) so checkout processes generate instant payments without requiring real Stripe merchant accounts.

---

## 3. Brand Audit & Developer Identity Cleanup
* **Identity Removal:** Checked the repository for the old developer's name (`balumeduri` or `meduri`) and cleaned up all occurrences:
  * Replaced the example notification recipient email with `support@rideshield.com` in `NotificationService/examples/publisher.js`.
  * Updated `README.md` Docker run scripts to reference `<your-docker-username>/rideshield`.
  * Updated `.github/workflows/docker-push.yml` to build and tag the Docker Hub image dynamically using GitHub Secrets (`${{ secrets.DOCKERHUB_USERNAME }}/rideshield`).
* **Email Template Branding:** Cleaned up residual "NichePay" branding and domains in `paymentSuccess.js` and `floodAlert.js` email notifications templates, replacing them with "RideShield".

---

## 4. Security Hardening (Credentials Leakage Protection)
* **The Vulnerability:** Discovered that the secret RabbitMQ URL (containing the username and password) and NewsAPI keys were hardcoded as fallback values in JS and Python source files (`MainService`, `PolicyService`, `AddressPolling`, `ML-Service`).
* **The Root Cause:** These services did not load local environment variables from `.env` files, which forced them to fall back on the hardcoded credentials.
* **The Fix:**
  1. Removed all hardcoded fallbacks from JS/Python files and replaced them with safe local mock strings (`amqp://localhost:5672` or `""`).
  2. Implemented manual, dependency-free `.env` configuration parsers using standard libraries (`fs` and `path` in JS; `os` and `open` in Python) in the microservices.
  3. These files now read secrets dynamically from your git-ignored `.env` file, allowing you to push the codebase to GitHub securely without any risk of credential leaks.

---

## 5. Current Service Health & Ports
All 11 backend services and frontend portals are running successfully and connected to CloudAMQP, MongoDB Atlas, and Upstash Redis:
* **DummyRapido Backend:** Port `5000`
* **AuthService:** Port `5001`
* **PolicyService:** Port `5002`
* **PaymentService:** Port `5003`
* **AddressPolling:** Port `5004`
* **MainService:** Port `5005`
* **NotificationService:** Port `3004`
* **ML-Service:** Port `8000`
* **User Dashboard Frontend:** Port `5173`
* **DummyRapido Frontend:** Port `5174`
* **Admin Dashboard Frontend:** Port `5175`