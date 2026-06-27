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
          res.status(200).json({ hasPlan: true, plan: record.plan, status: record.status, amount: record.amount, explanation: record.explanation });
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
        const { userId, amount, explanation } = req.body;
        if (!userId || amount === undefined) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        const updateData = { amount };
        if (explanation !== undefined) {
          updateData.explanation = explanation;
        }
        const record = await Payment.findOneAndUpdate(
          { userId, status: { $in: ['SUCCESS', 'PAUSED'] } },
          updateData,
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

    // Admin: Fetch all disruption payouts
    app.get('/api/admin/payouts', async (req, res) => {
      try {
        const { status } = req.query;
        const filter = {};
        if (status) {
          filter.status = status.toUpperCase();
        }
        const payouts = await DisruptionPayout.find(filter).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ payouts });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch administrative payouts list: ' + error.message });
      }
    });

    // Admin: Update payout status (approve/reject review claims)
    app.post('/api/admin/payouts/update-status', async (req, res) => {
      try {
        const { id, status } = req.body;
        if (!id || !status) {
          return res.status(400).json({ error: 'Missing required fields (id, status)' });
        }
        
        const normalizedStatus = status.toUpperCase();
        if (normalizedStatus !== 'PROCESSED' && normalizedStatus !== 'REJECTED') {
          return res.status(400).json({ error: 'Invalid status. Must be PROCESSED or REJECTED' });
        }

        const payout = await DisruptionPayout.findByIdAndUpdate(
          id,
          { status: normalizedStatus },
          { new: true }
        );

        if (!payout) {
          return res.status(404).json({ error: 'Payout record not found' });
        }

        console.log(`[Admin] Claim ${id} for User ${payout.userId} updated to ${normalizedStatus}`);

        // If approved (PROCESSED), publish the event to notify the driver via NotificationService
        if (normalizedStatus === 'PROCESSED') {
          try {
            const { getChannel } = require('./utils/rabbitmq');
            const channel = getChannel();
            const payload = {
              userId: payout.userId,
              email: payout.email || 'driver@rideshield.com',
              amount: payout.amount,
              disruptedHours: payout.disruptedHours,
              date: payout.date,
              status: normalizedStatus,
              reason: payout.reason,
              priority: payout.priority || 'normal',
              timestamp: new Date().toISOString()
            };
            
            await channel.assertExchange('disruption_payout_fanout', 'fanout', { durable: true });
            channel.publish('disruption_payout_fanout', '', Buffer.from(JSON.stringify(payload)), {
              persistent: true
            });
            console.log(`📡 [Admin] Published approved payout event to disruption_payout_fanout for user ${payout.userId}`);
          } catch (rabbitErr) {
            console.error('[Admin] Failed to publish RabbitMQ notification for approved payout:', rabbitErr.message);
          }
        }

        res.status(200).json({ success: true, payout });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update payout status: ' + error.message });
      }
    });

    // Admin: Get system-wide analytics (loss ratio, total collected, total paid)
    app.get('/api/admin/analytics', async (req, res) => {
      try {
        const activeUsersCount = await Payment.distinct('userId', { status: { $in: ['SUCCESS', 'PAUSED'] } });
        const allPayments = await Payment.find({ status: { $in: ['SUCCESS', 'PAUSED'] } });
        const totalPremiums = allPayments.reduce((sum, p) => sum + p.amount, 0);

        const allPayouts = await DisruptionPayout.find({ status: 'PROCESSED' });
        const totalClaimsPaid = allPayouts.reduce((sum, p) => sum + p.amount, 0);

        const pendingReviewsCount = await DisruptionPayout.countDocuments({ status: 'REVIEW' });

        const lossRatio = totalPremiums > 0 ? (totalClaimsPaid / totalPremiums) * 100 : 0;

        res.status(200).json({
          activeDriversCount: activeUsersCount.length,
          totalPremiumsCollected: parseFloat(totalPremiums.toFixed(2)),
          totalClaimsPaid: parseFloat(totalClaimsPaid.toFixed(2)),
          lossRatio: parseFloat(lossRatio.toFixed(2)),
          pendingReviewsCount
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin analytics: ' + error.message });
      }
    });

    // Admin: Fetch NewsAPI strike/curfew alerts for operational cities
    app.get('/api/admin/news-alerts', async (req, res) => {
      try {
        const { date } = req.query;
        const getIstToday = () => {
          const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          return istTime.getFullYear() + '-' + String(istTime.getMonth() + 1).padStart(2, '0') + '-' + String(istTime.getDate()).padStart(2, '0');
        };
        const targetDate = date || getIstToday();
        const cities = ['Vijayawada', 'Guntur', 'Visakhapatnam'];
        const axios = require('axios');
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        
        const allAlerts = [];
        for (const city of cities) {
          try {
            const newsRes = await axios.get(`${mlServiceUrl}/api/ml/news-alerts?city=${city}&date=${targetDate}`);
            if (newsRes.data && newsRes.data.success && newsRes.data.alerts) {
              newsRes.data.alerts.forEach(article => {
                allAlerts.push({
                  city,
                  ...article
                });
              });
            }
          } catch (cityErr) {
            console.warn(`[Admin News] Failed to fetch news for ${city}:`, cityErr.message);
          }
        }
        
        res.status(200).json({ success: true, alerts: allAlerts });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news alerts: ' + error.message });
      }
    });

    // Admin: Fetch all driver subscriptions
    app.get('/api/admin/drivers', async (req, res) => {
      try {
        const drivers = await Payment.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, drivers });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch driver policies list: ' + error.message });
      }
    });

    // Get active users for inactivity checks
    app.get('/api/payments/active-users', async (req, res) => {
      try {
        const records = await Payment.find({ status: 'SUCCESS' });
        const userIds = records.map(r => r.userId);
        const activeDrivers = records.map(r => ({
          userId: r.userId,
          createdAt: r.createdAt
        }));
        res.status(200).json({ userIds, activeDrivers });
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