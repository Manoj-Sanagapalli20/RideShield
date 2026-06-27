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

    const { hasPlan, plan, status, amount, explanation } = paymentRes.data;

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

    const basePriceMap = {
      'Basic': 20,
      'Standard': 35,
      'Pro': 49,
      'Pro Shield': 49
    };

    const dailyWage = wageMap[plan] || 600;
    const premiumAmount = amount || basePriceMap[plan] || 35;

    res.status(200).json({
      planName: plan,
      dailyWage,
      status: status === 'PAUSED' ? 'Paused' : 'Active',
      premiumAmount,
      explanation: explanation || ''
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
    let explanation = "";
    try {
      const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

      // 1. Fetch Partner's City/Address
      const profileRes = await axios.get(`${dummyRapidoUrl}/api/partners/profile/${partnerId}`);
      if (profileRes.data && profileRes.data.partner) {
        const city = profileRes.data.partner.address;
        if (!city) {
          throw new Error(`Partner profile for ${partnerId} is missing address.`);
        }
        
        // 2. Resolve geocode
        const geocodeRes = await axios.get(`${mlServiceUrl}/api/ml/geocode?city=${encodeURIComponent(city)}`);
        const pincode = geocodeRes.data && geocodeRes.data.pincode;
        if (!pincode) {
          throw new Error(`Pincode could not be resolved for city: ${city}`);
        }
        
        // 3. Query ML-Service risk-score
        const riskRes = await axios.post(`${mlServiceUrl}/api/ml/risk-score`, {
          pincode: pincode,
          season: 'monsoon',
          zoneType: 'urban',
          city: city
        });
        
        if (riskRes.data && riskRes.data.premiumAdjustment !== undefined) {
          riskAdjustment = riskRes.data.premiumAdjustment;
          finalAmount += riskAdjustment;
          if (riskAdjustment > 0) {
            explanation = `₹${riskAdjustment} zone surcharge applied because your registered city (${city}) has a historical average of ${riskRes.data.avg_rain_days_per_month} rain days/month in monsoon and is classified as a ${riskRes.data.riskLevel}-risk zone by our Random Forest model.`;
          } else {
            explanation = `Standard base rate active. Your registered city (${city}) is classified as a low-risk zone for flood and strike disruptions.`;
          }
          console.log(`[PolicyService] Signup Risk Adjustment for ${partnerId} in ${city}: +₹${riskAdjustment}. Final premium: ₹${finalAmount}`);
        }
      }
    } catch (riskErr) {
      console.warn(`[PolicyService] Dynamic risk pricing failed, falling back to base premium:`, riskErr.message);
      explanation = "Standard weekly rate active.";
    }

    const event = {
      eventId: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: partnerId,
      email: email || 'driver@rideshield.com',
      plan: planName,
      amount: finalAmount,
      explanation: explanation
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

// ✅ Pre-calculate/simulate premium adjustment before purchasing (Random Forest)
app.post('/api/policy/preview-premium', async (req, res) => {
  try {
    const { partnerId, planName, amount } = req.body;
    if (!partnerId || !planName || amount === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let finalAmount = parseFloat(amount);
    let riskAdjustment = 0;
    let city = "";
    let pincode = "";
    let riskScore = 0;
    let riskLevel = "low";
    let explanation = "";
    let resolvedData = {};

    try {
      const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

      // 1. Fetch Partner's City/Address
      const profileRes = await axios.get(`${dummyRapidoUrl}/api/partners/profile/${partnerId}`);
      if (profileRes.data && profileRes.data.partner) {
        city = profileRes.data.partner.address;
        
        if (city) {
          // 2. Resolve geocode
          const geocodeRes = await axios.get(`${mlServiceUrl}/api/ml/geocode?city=${encodeURIComponent(city)}`);
          pincode = geocodeRes.data && geocodeRes.data.pincode;
          
          // 3. Query ML-Service risk-score
          const riskRes = await axios.post(`${mlServiceUrl}/api/ml/risk-score`, {
            pincode: pincode || "",
            season: 'monsoon',
            zoneType: 'urban',
            city: city
          });
          
          if (riskRes.data) {
            riskAdjustment = riskRes.data.premiumAdjustment || 0;
            riskScore = riskRes.data.riskScore || 0;
            riskLevel = riskRes.data.riskLevel || "low";
            finalAmount += riskAdjustment;
            resolvedData = riskRes.data;

            if (riskAdjustment > 0) {
              explanation = `₹${riskAdjustment} zone surcharge applied because your registered city (${city}) has a historical average of ${riskRes.data.avg_rain_days_per_month} rain days/month in monsoon and is classified as a ${riskLevel}-risk zone by our Random Forest model.`;
            } else {
              explanation = `Standard base rate active. Your registered city (${city}) is classified as a low-risk zone for flood and strike disruptions.`;
            }
          }
        }
      }
    } catch (riskErr) {
      console.warn(`[PolicyService] Dynamic risk pricing preview failed:`, riskErr.message);
      explanation = "Standard base rate active (using default zone parameters).";
    }

    res.status(200).json({
      planName,
      baseAmount: parseFloat(amount),
      adjustedAmount: finalAmount,
      premiumAdjustment: riskAdjustment,
      city: city || "Default",
      pincode: pincode || "000000",
      riskScore,
      riskLevel,
      explanation,
      resolvedData
    });
  } catch (error) {
    console.error("Failed to preview premium:", error);
    res.status(500).json({ message: "Failed to preview premium" });
  }
});


// ✅ Cron Job Endpoint: Inactivity auto-pause checks (2 weeks zero activity)
app.post('/api/policy/cron/inactivity-check', async (req, res) => {
  try {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';

    // 1. Get all active users
    const usersRes = await axios.get(`${paymentServiceUrl}/api/payments/active-users`);
    const { userIds, activeDrivers } = usersRes.data;

    const driversToCheck = activeDrivers || (userIds || []).map(id => ({ userId: id, createdAt: new Date() }));

    if (driversToCheck.length === 0) {
      return res.status(200).json({ message: "No active users to check for inactivity." });
    }

    console.log(`[PolicyService] Running inactivity checks on ${driversToCheck.length} users...`);
    const pausedUsers = [];
    let skippedNewPoliciesCount = 0;

    // Helper to get past dates list
    const getPast14Dates = () => {
      const dates = [];
      for (let i = 1; i <= 14; i++) {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        d.setDate(d.getDate() - i);
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        dates.push(dStr);
      }
      return dates;
    };
    const pastDates = getPast14Dates();

    for (const driver of driversToCheck) {
      const { userId, createdAt } = driver;

      // Skip checking policies that are less than 14 days old
      const policyAgeMs = Date.now() - new Date(createdAt).getTime();
      const policyAgeDays = policyAgeMs / (1000 * 60 * 60 * 24);
      if (policyAgeDays < 14) {
        console.log(`[PolicyService] Skipping inactivity check for user ${userId} — policy is only ${policyAgeDays.toFixed(1)} days old.`);
        skippedNewPoliciesCount++;
        continue;
      }

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
      message: `Checked ${driversToCheck.length} users (skipped ${skippedNewPoliciesCount} new policies). Paused ${pausedUsers.length} inactive policies.`,
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
        const city = profileRes.data.partner.address;
        if (!city) {
          throw new Error(`Driver profile is missing address`);
        }

        // B. Fetch geocode coordinates
        const geocodeRes = await axios.get(`${mlServiceUrl}/api/ml/geocode?city=${encodeURIComponent(city)}`);
        const lat = geocodeRes.data && geocodeRes.data.lat;
        const lng = geocodeRes.data && geocodeRes.data.lng;
        const pincode = geocodeRes.data && geocodeRes.data.pincode;

        if (lat === undefined || lng === undefined || !pincode) {
          throw new Error(`Could not resolve coordinates or pincode for city: ${city}`);
        }

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
        finalWeeklyPremium = Math.max(10, Math.min(100, Math.round(finalWeeklyPremium)));
        const finalAdjustment = finalWeeklyPremium - basePrice;

        // Construct dynamic explanation based on active weather metrics
        let weeklyExplanation = "";
        if (finalAdjustment > 0) {
          const reasons = [];
          if (weatherForecast.condition === 'rain') reasons.push("rain forecast");
          if (weatherForecast.temp >= 45) reasons.push("heatwave warning");
          if (peakAqi >= 300) reasons.push("severe air pollution");
          if (payouts.length > 2) reasons.push("high claims frequency");
          
          if (reasons.length === 0) reasons.push("upcoming weather risks");
          weeklyExplanation = `₹${finalAdjustment} weather surcharge applied due to ${reasons.join(", ")} in your zone.`;
        } else if (finalAdjustment < 0) {
          weeklyExplanation = `₹${Math.abs(finalAdjustment)} clear weather discount applied due to safe forecast conditions and low claim velocity.`;
        } else {
          weeklyExplanation = "Standard weekly rate active (standard weather and clear road conditions).";
        }

        // G. Update PaymentService database
        await axios.post(`${paymentServiceUrl}/api/payments/update-premium`, {
          userId,
          amount: finalWeeklyPremium,
          explanation: weeklyExplanation
        });

        console.log(`[PolicyService] Adjusted premium for ${userId} (${plan}): Base ₹${basePrice} -> New weekly premium ₹${finalWeeklyPremium} (adjustment: ₹${premiumAdjustment.toFixed(2)})`);
        adjustedUsers.push({ userId, plan, basePrice, newPremium: finalWeeklyPremium, adjustment: premiumAdjustment, explanation: weeklyExplanation });

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