const { getChannel } = require('../utils/rabbitmq');
const { processSubscription } = require('../services/payment.service');

const startPaymentConsumer = async () => {
  const channel = getChannel();
  const queue = 'subscription.purchase.queue';

  channel.prefetch(1); // Process one message at a time

  console.log(`🎧 Waiting for messages in ${queue}`);

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const eventContent = JSON.parse(msg.content.toString());
      console.log(`📥 Received subscription event: ${eventContent.eventId}`);

      await processSubscription(eventContent);

      // Manual Ack
      channel.ack(msg);
      console.log(`✅ Successfully processed & acknowledged event: ${eventContent.eventId}`);
    } catch (error) {
      console.error('❌ Failed to process subscription message', error);
      
      // Rejecting with requeue: false forwards it to DLQ since we setup a DLX for this queue
      channel.reject(msg, false);
      console.log(`📨 Message routed to DLQ`);
    }
  }, { noAck: false }); // Manual acknowledgement
};

module.exports = { startPaymentConsumer };
