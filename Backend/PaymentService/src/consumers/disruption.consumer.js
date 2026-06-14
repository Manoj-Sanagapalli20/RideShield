const { getChannel } = require('../utils/rabbitmq');
const DisruptionPayout = require('../models/disruption_payout.model');

const startDisruptionConsumer = async () => {
  const channel = getChannel();
  const queue = 'payment.disruption';

  await channel.assertQueue(queue, { durable: true });

  console.log(`🎧 Payment Service Listening for Disruption Payouts in [${queue}]`);

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      console.log(`📥 Received disruption payout for storage: User ${data.userId} - ₹${data.amount}`);

      // Save or update to database (upsert by userId and date to prevent duplicate records)
      await DisruptionPayout.findOneAndUpdate(
        { userId: data.userId, date: data.date },
        {
          email: data.email || 'driver@rideshield.com',
          amount: parseFloat(data.amount),
          disruptedHours: data.disruptedHours,
          reason: data.reason,
          status: data.status || 'PROCESSED',
          timestamp: data.timestamp || new Date()
        },
        { upsert: true, new: true }
      );
      
      console.log(`✅ Disruption payout record saved for user ${data.userId}. Total Payout: ₹${data.amount}`);
      
      channel.ack(msg);
    } catch (error) {
      console.error('❌ Failed to store disruption payout record:', error.message);
      // Nack but don't requeue to move it out of the way or send to DLQ
      channel.nack(msg, false, false);
    }
  }, { noAck: false });
};

module.exports = { startDisruptionConsumer };
