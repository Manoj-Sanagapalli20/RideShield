---
description: Run the entire RideShield / RideShield project locally
---

// turbo-all

## Run RideShield Full Project

### Step 1 — Install deps for all frontends (skip if node_modules already exist)

Run these sequentially to avoid EPERM conflicts:

```
npm install
```
in `c:\RideShield\Frontend\UserDashboard\reactjs`

```
npm install
```
in `c:\RideShield\Frontend\DummyRapido\frontend`

```
npm install
```
in `c:\RideShield\Frontend\AdminDashboard`

---

### Step 2 — Install deps for all backends (sequentially)

```
npm install
```
in `c:\RideShield\Frontend\DummyRapido\backend`

```
npm install
```
in `c:\RideShield\Backend\AuthService`

```
npm install
```
in `c:\RideShield\Backend\PolicyService`

```
npm install
```
in `c:\RideShield\Backend\PaymentService`

```
npm install
```
in `c:\RideShield\Backend\AddressPolling`

```
npm install
```
in `c:\RideShield\Backend\MainService`

```
npm install
```
in `c:\RideShield\Backend\NotificationService`

---

### Step 3 — Start all frontend dev servers (background, in parallel)

```
npm run dev
```
in `c:\RideShield\Frontend\UserDashboard\reactjs`   → http://localhost:5173

```
npm run dev
```
in `c:\RideShield\Frontend\DummyRapido\frontend`    → http://localhost:5174

```
npm run dev
```
in `c:\RideShield\Frontend\AdminDashboard`          → http://localhost:5175

---

### Step 4 — Start all backend services (background, in parallel)

```
node index.js
```
in `c:\RideShield\Backend\AuthService`          → port 5001

```
node index.js
```
in `c:\RideShield\Backend\PolicyService`        → port 5002

```
node src/app.js
```
in `c:\RideShield\Backend\PaymentService`       → port 5003 (requires STRIPE_SECRET_KEY in .env)

```
node index.js
```
in `c:\RideShield\Backend\AddressPolling`       → port 5004

```
node index.js
```
in `c:\RideShield\Backend\MainService`          → port 5005

```
node server.js
```
in `c:\RideShield\Backend\NotificationService`  → port 3004

```
node index.js
```
in `c:\RideShield\Frontend\DummyRapido\backend` → port 5000 (requires MONGO_URI in .env)

---

## Port Reference

| App | URL |
|-----|-----|
| UserDashboard (main) | http://localhost:5173 |
| DummyRapido frontend | http://localhost:5174 |
| AdminDashboard       | http://localhost:5175 |
| DummyRapido backend  | http://localhost:5000 |
| AuthService          | http://localhost:5001 |
| PolicyService        | http://localhost:5002 |
| PaymentService       | http://localhost:5003 |
| AddressPolling       | http://localhost:5004 |
| MainService          | http://localhost:5005 |
| NotificationService  | http://localhost:3004 |
