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
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let channel;

const setupRabbitMQ = async () => {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    let attempt = 0;

    while (true) {
        try {
            attempt++;
            console.log(`AddressPolling connecting to RabbitMQ (Attempt ${attempt})...`);
            const conn = await amqp.connect(url);
            
            conn.on("error", (err) => {
                console.error("AddressPolling RabbitMQ connection error:", err.message);
            });
            conn.on("close", () => {
                console.log("AddressPolling RabbitMQ connection closed. Reconnecting in 5 seconds...");
                channel = null;
                setTimeout(setupRabbitMQ, 5000);
            });
            
            channel = await conn.createChannel();
            channel.on("error", (err) => {
                console.error("AddressPolling RabbitMQ channel error:", err.message);
            });
            
            await channel.assertQueue('location.update', { durable: true });
            console.log('✅ AddressPolling connected to RabbitMQ (CloudAMQP)');
            return;
        } catch (err) {
            console.warn(`⚠️ AddressPolling RabbitMQ connection attempt ${attempt} failed: ${err.message}. Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
};
setupRabbitMQ();

// Endpoint to receive tracking/location data securely
app.post('/api/address/update', (req, res) => {
    const { userId, lat, lng, pincode, data } = req.body;
    
    if (!userId || !lat || !lng) {
        return res.status(400).json({ error: "Missing required location data" });
    }

    const payload = {
        userId,
        lat,
        lng,
        pincode: pincode || "000000",
        date: req.body.date || new Date().toISOString().split('T')[0],
        extraData: data || {}
    };

    if (channel) {
        try {
            channel.sendToQueue('location.update', Buffer.from(JSON.stringify(payload)), { persistent: true });
            console.log(`📍 Location queued to ML service for user ${userId}`);
            res.status(200).json({ success: true, message: "Location updated to ML Queue" });
        } catch (err) {
            console.error("Failed to send location update to queue:", err.message);
            res.status(503).json({ error: "Message Queue is offline or channel closed" });
        }
    } else {
        res.status(503).json({ error: "Message Queue is offline" });
    }
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
    console.log(`🚀 AddressPolling Service running on port ${PORT}`);
});
