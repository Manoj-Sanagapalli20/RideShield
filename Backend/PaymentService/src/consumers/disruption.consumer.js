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

      // Save to database
      const payoutEntry = new DisruptionPayout({
        userId: data.userId,
        email: data.email,
        amount: parseFloat(data.amount),
        disruptedHours: data.disruptedHours,
        date: data.date,
        reason: data.reason,
        timestamp: data.timestamp || new Date()
      });

      await payoutEntry.save();
      
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
