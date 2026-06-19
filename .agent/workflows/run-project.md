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

### Step 3 — Start all services concurrently (RECOMMENDED)

You can start all backend, ML, and frontend services concurrently in a single terminal by running:
```bash
npm start
```
from the root directory `c:\RideShield`.

---

### Step 4 — Run services manually (alternative)

If you prefer to start them manually in separate terminals, run the following:

#### Frontends:
*   **User Dashboard** (port 3000):
    `npm run dev` in `c:\RideShield\Frontend\UserDashboard\reactjs`
*   **Dummy Rapido Portal** (port 3001):
    `npm run dev` in `c:\RideShield\Frontend\DummyRapido\frontend`
*   **Admin Dashboard** (port 5175):
    `npm run dev` in `c:\RideShield\Frontend\AdminDashboard`

#### Backends & ML:
*   **DummyRapido backend** (port 5000): `node index.js` in `c:\RideShield\Frontend\DummyRapido\backend`
*   **AuthService** (port 5001): `node index.js` in `c:\RideShield\Backend\AuthService`
*   **PolicyService** (port 5002): `node index.js` in `c:\RideShield\Backend\PolicyService`
*   **PaymentService** (port 5003): `node src/app.js` in `c:\RideShield\Backend\PaymentService`
*   **AddressPolling** (port 5004): `node index.js` in `c:\RideShield\Backend\AddressPolling`
*   **MainService** (port 5005): `node index.js` in `c:\RideShield\Backend\MainService`
*   **NotificationService** (port 3004): `node server.js` in `c:\RideShield\Backend\NotificationService`
*   **ML-Service** (port 8000): `python run.py` in `c:\RideShield\Backend\ML-Service`

---

## Port Reference

| App | URL |
|-----|-----|
| UserDashboard (main) | http://localhost:3000 |
| DummyRapido frontend | http://localhost:3001 |
| AdminDashboard       | http://localhost:5175 |
| DummyRapido backend  | http://localhost:5000 |
| AuthService          | http://localhost:5001 |
| PolicyService        | http://localhost:5002 |
| PaymentService       | http://localhost:5003 |
| AddressPolling       | http://localhost:5004 |
| MainService          | http://localhost:5005 |
| NotificationService  | http://localhost:3004 |
| ML-Service           | http://localhost:8000 |

