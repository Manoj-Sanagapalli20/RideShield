const fs = require('fs');
const path = require('path');
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.warn('Failed to load local .env file manually:', e.message);
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const amqp = require('amqplib');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// RabbitMQ publisher setup
let channel;

const connectRabbitMQ = async () => {
  const amqpServer = process.env.RABBITMQ_URL || "amqp://localhost:5672";
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      console.log(`PolicyService connecting to RabbitMQ (Attempt ${attempt})...`);
      const connection = await amqp.connect(amqpServer);
      
      connection.on("error", (err) => {
        console.error("PolicyService RabbitMQ connection error:", err.message);
      });
      
      connection.on("close", () => {
        console.log("PolicyService RabbitMQ connection closed. Reconnecting in 5 seconds...");
        channel = null;
        setTimeout(connectRabbitMQ, 5000);
      });
      
      channel = await connection.createChannel();
      channel.on("error", (err) => {
        console.error("PolicyService RabbitMQ channel error:", err.message);
      });
      channel.on("close", () => {
        console.log("PolicyService RabbitMQ channel closed. Closing connection to trigger reconnect...");
        if (connection) {
          connection.close().catch(() => {});
        }
      });
      
      await channel.assertQueue('subscription.purchase.queue', {
        durable: true,
        deadLetterExchange: 'events.dlx',
        deadLetterRoutingKey: 'subscription.purchase'
      });

      console.log('✅ Connected to RabbitMQ on CloudAMQP from Policy Service');
      return; // Connection successful!

    } catch (error) {
      console.warn(`⚠️ PolicyService RabbitMQ connection attempt ${attempt} failed: ${error.message}. Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};

connectRabbitMQ();

// ✅ Fetch Driver Profile
app.get('/api/policy/profile/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;

    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
    const rapidoResponse = await axios.get(
      `${dummyRapidoUrl}/api/partners/profile/${partnerId}`
    );

    res.status(200).json(rapidoResponse.data);

  } catch (error) {
    console.error("PolicyService Profile Error:", error.response?.data || error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ message: "Internal Policy Service Error" });
    }
  }
});

// ✅ Get user's active insurance plan (kept from final)
app.get('/api/policy/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
    const paymentRes = await axios.get(
      `${paymentServiceUrl}/api/payments/status/${userId}`
    );

    const { hasPlan, plan, status } = paymentRes.data;

    if (!hasPlan) {
      return res.status(404).json({ message: 'No active policy found' });
    }

    // Map plan → daily wage
    const wageMap = {
      'Basic': 400,
      'Standard': 600,
      'Pro Shield': 800,
      'Pro': 800,
      'Premium': 1000
    };

    const dailyWage = wageMap[plan] || 600;

    res.status(200).json({
      planName: plan,
      dailyWage,
      status: status === 'PAUSED' ? 'Paused' : 'Active'
    });

  } catch (error) {
    console.error("PolicyService User Policy Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch policy" });
  }
});

app.post('/api/policy/select-plan', async (req, res) => {
  try {
    const { partnerId, planName, amount, email } = req.body;

    if (!partnerId || !planName || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // --- Dynamic Risk Scoring Premium Adjustment ---
    let finalAmount = parseFloat(amount);
    let riskAdjustment = 0;
    try {
      const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

      // 1. Fetch Partner's City/Address
      const profileRes = await axios.get(`${dummyRapidoUrl}/api/partners/profile/${partnerId}`);
      if (profileRes.data && profileRes.data.partner) {
        const city = profileRes.data.partner.address || 'Vijayawada';
        
        // 2. Resolve geocode
        const geocodeRes = await axios.get(`${mlServiceUrl}/api/ml/geocode?city=${encodeURIComponent(city)}`);
        const pincode = (geocodeRes.data && geocodeRes.data.pincode) || '520001';
        
        // 3. Query ML-Service risk-score
        const riskRes = await axios.post(`${mlServiceUrl}/api/ml/risk-score`, {
          pincode: pincode,
          season: 'monsoon',
          zoneType: 'urban'
        });
        
        if (riskRes.data && riskRes.data.premiumAdjustment !== undefined) {
          riskAdjustment = riskRes.data.premiumAdjustment;
          finalAmount += riskAdjustment;
          console.log(`[PolicyService] Signup Risk Adjustment for ${partnerId} in ${city}: +₹${riskAdjustment}. Final premium: ₹${finalAmount}`);
        }
      }
    } catch (riskErr) {
      console.warn(`[PolicyService] Dynamic risk pricing failed, falling back to base premium:`, riskErr.message);
    }

    const event = {
      eventId: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: partnerId,
      email: email || 'driver@rideshield.com',
      plan: planName,
      amount: finalAmount
    };

    if (channel) {
      try {
        channel.sendToQueue(
          'subscription.purchase.queue',
          Buffer.from(JSON.stringify(event)),
          { persistent: true }
        );

        console.log(`📡 Event pushed to Payment Queue for user: ${partnerId}`);

        res.status(200).json({
          message: "Plan selected successfully, payment initiated.",
          eventId: event.eventId,
          adjustedAmount: finalAmount,
          premiumAdjustment: riskAdjustment
        });
      } catch (err) {
        console.error("Failed to select plan (queue offline/closed):", err.message);
        res.status(503).json({ message: "Message Queue is offline or channel closed." });
      }
    } else {
      res.status(503).json({ message: "Message Queue is unavailable." });
    }

  } catch (error) {
    console.error("Failed to select plan:", error);
    res.status(500).json({ message: "Failed to process plan selection" });
  }
});

// ✅ Cron Job Endpoint: Inactivity auto-pause checks (2 weeks zero activity)
app.post('/api/policy/cron/inactivity-check', async (req, res) => {
  try {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';

    // 1. Get all active users
    const usersRes = await axios.get(`${paymentServiceUrl}/api/payments/active-users`);
    const { userIds } = usersRes.data;

    if (!userIds || userIds.length === 0) {
      return res.status(200).json({ message: "No active users to check for inactivity." });
    }

    console.log(`[PolicyService] Running inactivity checks on ${userIds.length} users...`);
    const pausedUsers = [];

    // Helper to get past dates list
    const getPast14Dates = () => {
      const dates = [];
      for (let i = 1; i <= 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      return dates;
    };
    const pastDates = getPast14Dates();

    for (const userId of userIds) {
      let totalLogins = 0;

      // Check logins for past 14 days
      for (const dStr of pastDates) {
        try {
          const logRes = await axios.get(`${dummyRapidoUrl}/api/partners/daily-logs/${userId}/${dStr}`);
          const log = logRes.data.log;
          if (log && log.hourlyActivity && log.hourlyActivity.some(h => h.isOnline === true)) {
            totalLogins++;
            break; // Active in last 14 days, no need to check further
          }
        } catch (e) {
          // If 404, count as no activity
        }
      }

      if (totalLogins === 0) {
        // Driver was completely inactive for 14 consecutive days. Trigger auto-pause.
        console.log(`[PolicyService] Auto-pausing policy for inactive driver: ${userId}`);
        try {
          await axios.post(`${paymentServiceUrl}/api/payments/update-status`, {
            userId,
            status: 'PAUSED'
          });
          pausedUsers.push(userId);
        } catch (updateErr) {
          console.error(`[PolicyService] Failed to auto-pause driver ${userId}:`, updateErr.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Checked ${userIds.length} users for inactivity. Paused ${pausedUsers.length} inactive policies.`,
      pausedUsers
    });

  } catch (error) {
    console.error("[PolicyService] Inactivity check cron failed:", error.message);
    res.status(500).json({ error: "Inactivity check execution failed." });
  }
});

// ✅ Cron Job Endpoint: Weekly premium adjustments via XGBoost model
app.post('/api/policy/cron/weekly-premium-adjustment', async (req, res) => {
  try {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

    // 1. Get all active users
    const usersRes = await axios.get(`${paymentServiceUrl}/api/payments/active-users`);
    const { userIds } = usersRes.data;

    if (!userIds || userIds.length === 0) {
      return res.status(200).json({ message: "No active users to adjust weekly premiums." });
    }

    console.log(`[PolicyService] Running weekly premium adjustments for ${userIds.length} users...`);
    const adjustedUsers = [];

    for (const userId of userIds) {
      try {
        // A. Fetch driver profile to resolve city
        const profileRes = await axios.get(`${dummyRapidoUrl}/api/partners/profile/${userId}`);
        if (!profileRes.data || !profileRes.data.partner) continue;
        const city = profileRes.data.partner.address || 'Vijayawada';

        // B. Fetch geocode coordinates
        const geocodeRes = await axios.get(`${mlServiceUrl}/api/ml/geocode?city=${encodeURIComponent(city)}`);
        const lat = (geocodeRes.data && geocodeRes.data.lat) || 16.0145;
        const lng = (geocodeRes.data && geocodeRes.data.lng) || 80.7828;
        const pincode = (geocodeRes.data && geocodeRes.data.pincode) || '520001';

        // C. Fetch weather advisory for forecasts
        const advisoryRes = await axios.get(`${mlServiceUrl}/api/ml/smart-advisory?lat=${lat}&lng=${lng}&pincode=${pincode}`);
        const metrics = advisoryRes.data.metrics || {};
        const peakPrecip = metrics.peakPrecipitation || 0.0;
        const peakTemp = metrics.peakTemperature || 28.0;
        const peakAqi = metrics.peakAqi || 100.0;

        // D. Fetch driver's past payouts
        const payoutsRes = await axios.get(`${paymentServiceUrl}/api/disruption-payouts/${userId}`);
        const payouts = payoutsRes.data.payouts || [];

        // E. Call XGBoost Premium Predictor
        const weatherForecast = {
          condition: peakPrecip >= 0.5 ? 'rain' : 'clear',
          temp: peakTemp
        };

        const premiumRes = await axios.post(`${mlServiceUrl}/api/ml/premium-predict`, {
          weatherForecast,
          aqi: peakAqi,
          pastClaims: payouts
        });

        const basePremiumAdjusted = premiumRes.data.basePremiumAdjusted; // around 35 (20 to 50)
        const premiumAdjustment = basePremiumAdjusted - 35.0; // standard price baseline is 35

        // F. Resolve current base plan price
        const statusRes = await axios.get(`${paymentServiceUrl}/api/payments/status/${userId}`);
        const plan = statusRes.data.plan;
        
        const basePriceMap = {
          'Basic': 20,
          'Standard': 35,
          'Pro': 49,
          'Pro Shield': 49
        };
        const basePrice = basePriceMap[plan] || 35;
        let finalWeeklyPremium = basePrice + premiumAdjustment;

        // Ensure minimum weekly premium is 10 and max is 100
        finalWeeklyPremium = Math.max(10, Math.min(100, Math.round(finalWeeklyPremium)));

        // G. Update PaymentService database
        await axios.post(`${paymentServiceUrl}/api/payments/update-premium`, {
          userId,
          amount: finalWeeklyPremium
        });

        console.log(`[PolicyService] Adjusted premium for ${userId} (${plan}): Base ₹${basePrice} -> New weekly premium ₹${finalWeeklyPremium} (adjustment: ₹${premiumAdjustment.toFixed(2)})`);
        adjustedUsers.push({ userId, plan, basePrice, newPremium: finalWeeklyPremium, adjustment: premiumAdjustment });

      } catch (userErr) {
        console.error(`[PolicyService] Failed to calculate weekly premium adjustment for user ${userId}:`, userErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Weekly premium adjustments completed for ${adjustedUsers.length} users.`,
      adjustedUsers
    });

  } catch (error) {
    console.error("[PolicyService] Weekly premium adjustment cron failed:", error.message);
    res.status(500).json({ error: "Weekly premium adjustment execution failed." });
  }
});

app.listen(PORT, () => {
  console.log(`🛡️ Policy Service is running on port ${PORT}`);
});