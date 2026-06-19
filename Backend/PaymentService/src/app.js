require('dotenv').config();
const express = require('express');
const { connectDB } = require('./utils/db');
const { connectRedis } = require('./utils/redis');
const { connectRabbitMQ, registerReconnectCallback } = require('./utils/rabbitmq');

const { startPaymentConsumer } = require('./consumers/payment.consumer');
const { startClaimConsumer } = require('./consumers/claim.consumer');
const { startDisruptionConsumer } = require('./consumers/disruption.consumer');

async function startServer() {
  try {
    // Register reconnect callback first so it can handle any future connection drops
    registerReconnectCallback(async () => {
      console.log('🔄 Reconnected to RabbitMQ. Restarting consumers...');
      try {
        await startPaymentConsumer();
        await startClaimConsumer();
        await startDisruptionConsumer();
      } catch (e) {
        console.warn("⚠️ Could not restart consumers after reconnect:", e.message);
      }
    });

    // 1. Core Infrastructure Initialization
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();

    // 2. Start Message Consumers
    try {
      await startPaymentConsumer();
      await startClaimConsumer();
      await startDisruptionConsumer();
    } catch (e) {
      console.warn("⚠️ Could not start consumers due to missing message queue:", e.message);
    }

    // 3. Start Express App
    const app = express();
    const cors = require('cors');
    const Payment = require('./models/payment.model');
    const DisruptionPayout = require('./models/disruption_payout.model');

    app.use(cors());
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', service: 'Payment Service' });
    });

    // Payment status API
    app.get('/api/payments/status/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const record = await Payment.findOne({ userId, status: { $in: ['SUCCESS', 'PAUSED'] } });

        if (record) {
          res.status(200).json({ hasPlan: true, plan: record.plan, status: record.status });
        } else {
          res.status(200).json({ hasPlan: false });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to check payment status' });
      }
    });

    // Update status API (to support pause/unpause)
    app.post('/api/payments/update-status', async (req, res) => {
      try {
        const { userId, status } = req.body;
        if (!userId || !status) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        const record = await Payment.findOneAndUpdate(
          { userId, status: { $in: ['SUCCESS', 'PAUSED'] } },
          { status },
          { new: true }
        );
        if (record) {
          res.status(200).json({ success: true, record });
        } else {
          res.status(404).json({ error: 'No active plan found to update' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to update policy status' });
      }
    });

    // Update premium amount API
    app.post('/api/payments/update-premium', async (req, res) => {
      try {
        const { userId, amount } = req.body;
        if (!userId || amount === undefined) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        const record = await Payment.findOneAndUpdate(
          { userId, status: { $in: ['SUCCESS', 'PAUSED'] } },
          { amount },
          { new: true }
        );
        if (record) {
          res.status(200).json({ success: true, record });
        } else {
          res.status(404).json({ error: 'No active plan found to update premium' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to update premium' });
      }
    });

    // ✅ Disruption payout history (kept from final)
    app.get('/api/disruption-payouts/:userId', async (req, res) => {
      try {
        const { userId } = req.params;

        const payouts = await DisruptionPayout
          .find({ userId })
          .sort({ date: -1, createdAt: -1 })
          .limit(20);

        const total = payouts.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
          payouts,
          totalAmount: total
        });

      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch disruption payouts' });
      }
    });

    // Get active users for inactivity checks
    app.get('/api/payments/active-users', async (req, res) => {
      try {
        const records = await Payment.find({ status: 'SUCCESS' });
        const userIds = records.map(r => r.userId);
        res.status(200).json({ userIds });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    const port = process.env.PORT || 3000;

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Payment Service running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // 4. Graceful Shutdown
    const shutdown = async () => {
      console.log('Graceful shutdown initiated...');
      server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();