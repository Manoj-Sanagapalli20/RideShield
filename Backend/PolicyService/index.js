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
  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`PolicyService connecting to RabbitMQ (Attempt ${attempt + 1}/${maxRetries})...`);
      const connection = await amqp.connect(amqpServer);
      
      connection.on("error", (err) => {
        console.error("PolicyService RabbitMQ connection error:", err.message);
      });
      
      connection.on("close", () => {
        console.log("PolicyService RabbitMQ connection closed. Reconnecting in 5 seconds...");
        setTimeout(connectRabbitMQ, 5000);
      });
      
      channel = await connection.createChannel();
      channel.on("error", (err) => {
        console.error("PolicyService RabbitMQ channel error:", err.message);
      });
      
      await channel.assertQueue('subscription.purchase.queue', {
        durable: true,
        deadLetterExchange: 'events.dlx',
        deadLetterRoutingKey: 'subscription.purchase'
      });

      console.log('✅ Connected to RabbitMQ on CloudAMQP from Policy Service');
      return; // Connection successful!

    } catch (error) {
      attempt++;
      console.warn(`⚠️ PolicyService RabbitMQ connection attempt ${attempt} failed: ${error.message}. Retrying in 3 seconds...`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  console.error('❌ PolicyService failed to connect to RabbitMQ after max retries.');
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

    const { hasPlan, plan } = paymentRes.data;

    if (!hasPlan) {
      return res.status(404).json({ message: 'No active policy found' });
    }

    // Map plan → daily wage
    const wageMap = {
      'Basic': 400,
      'Standard': 600,
      'Pro Shield': 800,
      'Premium': 1000
    };

    const dailyWage = wageMap[plan] || 600;

    res.status(200).json({
      planName: plan,
      dailyWage,
      status: 'Active'
    });

  } catch (error) {
    console.error("PolicyService User Policy Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch policy" });
  }
});

// ✅ Select plan → push to RabbitMQ
app.post('/api/policy/select-plan', async (req, res) => {
  try {
    const { partnerId, planName, amount, email } = req.body;

    if (!partnerId || !planName || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = {
      eventId: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: partnerId,
      email: email || 'driver@rideshield.com',
      plan: planName,
      amount: amount
    };

    if (channel) {
      channel.sendToQueue(
        'subscription.purchase.queue',
        Buffer.from(JSON.stringify(event)),
        { persistent: true }
      );

      console.log(`📡 Event pushed to Payment Queue for user: ${partnerId}`);

      res.status(200).json({
        message: "Plan selected successfully, payment initiated.",
        eventId: event.eventId
      });

    } else {
      res.status(500).json({ message: "Message Queue is unavailable." });
    }

  } catch (error) {
    console.error("Failed to select plan:", error);
    res.status(500).json({ message: "Failed to process plan selection" });
  }
});

app.listen(PORT, () => {
  console.log(`🛡️ Policy Service is running on port ${PORT}`);
});