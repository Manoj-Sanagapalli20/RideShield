# RideShield: Master Brain-Dump & Project Handover
**Last Updated:** April 2026
**Status:** Paused for Exams (Frontend & Mock Layer Complete)

## 📌 Context
You are heavily refactoring a Zomato food-delivery insurance architecture (NichePay) into a Rapido ride-hailing architecture (RideShield). 

### 🟢 What is ALREADY Done (Do not repeat these)
1. **Frontend Aesthetic:** You have a fully responsive, Rapido-Yellow interface with glassmorphism effects across `UserDashboard` and `AdminDashboard`.
2. **Mock Simulation Engine:** `DummyZomato` was destroyed. `DummyRapido` was built.
3. **Data Generation:** Your mock engine generates AI data based on "Morning & Evening Commutes", logging `Rides` and `Captains` instead of restaurants.

---

## 🚀 The Master Plan For When You Return

When you reopen this project in a few weeks/months, you need to execute exactly these technical steps to rewire the "Brains" of the microservices.

### Phase 3: Core Microservice Refactoring (The Logic)

Right now, your massive backend services (`MainService`, `PolicyService`, `AddressPolling`, etc.) still have "Zomato" logic hardcoded in them.

**1. Fix the API Routes:**
You must run a global search across the backend microservices. Everywhere `axios` fetches `http://localhost:5000/api/partners/zomato-login`, you must change it to fetch `http://localhost:5000/api/captains/rapido-login` to talk to your new `DummyRapido` engine.

**2. The Big Algorithm Shift (Event Triggers):**
This is the most critical part we discussed. 
* *The Old Way (Zomato):* The algorithm gave an insurance payout if a worker was stuck at a restaurant and delivered `0 orders` during a rain block. 
* *The New Way (Rapido):* Ride-hailing is different. You need to open `Backend/MainService/index.js` and change the payout parameters. 
  * **Trigger 1:** A Captain goes online, but "Trips Accepted = 0" during a severe weather alert (meaning they parked their bike for safety).
  * **Trigger 2:** A Captain is stuck in a highly congested water-logged zone, taking 2 hours to complete a 5km trip. 
  * The code needs to pull the `ridesAccepted` and `hourlyActivity` arrays from your new `DummyRapido/DailyLog.js` schema and calculate parametric triggers based on passenger metrics, not food.

### Phase 4: The Database & Cloud Handover

Right now, your backend boot sequences are patched to survive without crashing, but they still contain the original developer's cloud keys.

**1. The RabbitMQ Purge:**
Open `PolicyService/index.js`, `MainService/index.js`, and `AddressPolling/index.js`. You will see a hardcoded URL: `amqps://anbqwtzw:FVgZHA...`. You need to delete this. You will create a free **CloudAMQP** account, get your own URL, and place it in a `.env` file.

**2. The MongoDB Atlas Purge:**
Your services will need persistence. When you return, create a free **MongoDB Atlas cluster**. We will connect `MONGO_URI` to your database so you can actually see the Rapido Captains signing up in real-time.

**3. The Stripe Integration:**
In `PaymentService`, there is a dummy test key masking the crashes. You will need to create a free **Stripe Developer Account** when you return to get a true `sk_test_...` key. This will allow the `UserDashboard` to process the fake ₹149 weekly premium deductions beautifully.

---
## 💡 How To Resume
1. Open VSCode. 
2. Open this chat.
3. Tell me: **"Hey, read PROJECT_HANDOVER.md. I am back from exams. Let's start Phase 3 and rewire the MainService constraints for Rapido."**

*Rest easy. Your architecture, APIs, and grand vision are safely locked in this document. Go crush your semester!*
