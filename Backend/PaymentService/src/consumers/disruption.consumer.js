const { getChannel } = require('../utils/rabbitmq');
const DisruptionPayout = require('../models/disruption_payout.model');

const startDisruptionConsumer = async () => {
  const channel = getChannel();
  const queue = 'payment.disruption_priority';

  // Set prefetch to 1 so RabbitMQ delivers messages one-by-one,
  // allowing priority queue ordering to take effect.
  channel.prefetch(1);

  await channel.assertQueue(queue, { 
    durable: true,
    arguments: { 'x-max-priority': 10 }
  });

  console.log(`🎧 Payment Service Listening for Disruption Payouts in [${queue}] (Priority Enabled)`);

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      console.log(`📥 Received disruption payout: User ${data.userId} - ₹${data.amount} (Priority: ${data.priority || 'normal'})`);

      // Simulate real-world transaction/payout processing latency (2 seconds)
      // This also allows visual inspection of priority queue behavior.
      console.log(`⏳ Processing payout for User ${data.userId}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if a record already exists for this user and date
      const existing = await DisruptionPayout.findOne({ userId: data.userId, date: data.date });
      
      let statusToSave = data.status || 'PROCESSED';
      
      if (existing) {
        // If already PROCESSED or REJECTED, do not alter it (terminal state)
        if (existing.status === 'PROCESSED' || existing.status === 'REJECTED') {
          console.log(`ℹ️ Disruption payout for User ${data.userId} on ${data.date} is already in a terminal state (${existing.status}). Skipping update.`);
          channel.ack(msg);
          return;
        }
        
        // If the existing record is in REVIEW, preserve the REVIEW status
        // so that subsequent automated checks do not auto-approve or overwrite it.
        if (existing.status === 'REVIEW') {
          statusToSave = 'REVIEW';
        }
      }

      // Save or update to database (upsert by userId and date to prevent duplicate records)
      await DisruptionPayout.findOneAndUpdate(
        { userId: data.userId, date: data.date },
        {
          email: data.email || 'driver@rideshield.com',
          amount: parseFloat(data.amount),
          disruptedHours: data.disruptedHours,
          reason: data.reason,
          status: statusToSave,
          priority: data.priority || 'normal',
          timestamp: data.timestamp || new Date()
        },
        { upsert: true, new: true }
      );
      
      console.log(`✅ Disruption payout record saved for user ${data.userId}. Total Payout: ₹${data.amount} (Status: ${statusToSave})`);
      
      channel.ack(msg);
    } catch (error) {
      console.error('❌ Failed to store disruption payout record:', error.message);
      // Nack but don't requeue to move it out of the way or send to DLQ
      channel.nack(msg, false, false);
    }
  }, { noAck: false });
};

module.exports = { startDisruptionConsumer };
