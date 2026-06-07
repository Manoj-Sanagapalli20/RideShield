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
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            console.log(`AddressPolling connecting to RabbitMQ (Attempt ${attempt + 1}/${maxRetries})...`);
            const conn = await amqp.connect(url);
            
            conn.on("error", (err) => {
                console.error("AddressPolling RabbitMQ connection error:", err.message);
            });
            conn.on("close", () => {
                console.log("AddressPolling RabbitMQ connection closed. Reconnecting in 5 seconds...");
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
            attempt++;
            console.warn(`⚠️ AddressPolling RabbitMQ connection attempt ${attempt} failed: ${err.message}. Retrying in 3 seconds...`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('❌ AddressPolling failed to connect to RabbitMQ after max retries.');
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
        date: req.body.date || "2026-03-18",
        extraData: data || {}
    };

    if (channel) {
        channel.sendToQueue('location.update', Buffer.from(JSON.stringify(payload)), { persistent: true });
        console.log(`📍 Location queued to ML service for user ${userId}`);
        res.status(200).json({ success: true, message: "Location updated to ML Queue" });
    } else {
        res.status(500).json({ error: "Message Queue is offline" });
    }
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
    console.log(`🚀 AddressPolling Service running on port ${PORT}`);
});
