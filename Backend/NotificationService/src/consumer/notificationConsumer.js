const { getChannel } = require('../config/rabbitmq');
const handlePaymentSuccess = require('../handlers/paymentHandler');
const handleFloodAlert = require('../handlers/floodAlertHandler');
const handleClaimApproved = require('../handlers/claimHandler');
const handleDisruptionPayout = require('../handlers/disruptionPayoutHandler');

const QUEUE_NAME = 'notification_queue';
const DISRUPTION_QUEUE = 'notification.disruption';
const EXCHANGE_NAME = 'notification_exchange';

const startConsumer = async () => {
  try {
    const channel = getChannel();

    // 1. Setup Standard Notifications (Existing topic-based)
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'PAYMENT_SUCCESS');
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'FLOOD_ALERT');
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'CLAIM_APPROVED');

    // 2. Setup Disruption Payout Consumer (New Pub/Sub)
    // We assert both the exchange and the queue here to be safe
    const PAYOUT_EXCHANGE = 'disruption_payout_fanout';
    await channel.assertExchange(PAYOUT_EXCHANGE, 'fanout', { durable: true });
    await channel.assertQueue(DISRUPTION_QUEUE, { durable: true });
    await channel.bindQueue(DISRUPTION_QUEUE, PAYOUT_EXCHANGE, '');

    console.log(`✅ [INIT] Consumer Active for standard [${QUEUE_NAME}]`);
    console.log(`✅ [INIT] Consumer Active for payout Pub/Sub [${DISRUPTION_QUEUE}]`);

    // Main Notification Consumer
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const routingKey = msg.fields.routingKey;
        const data = JSON.parse(msg.content.toString());
        try {
          switch (routingKey) {
            case 'PAYMENT_SUCCESS': await handlePaymentSuccess(data); break;
            case 'FLOOD_ALERT': await handleFloodAlert(data); break;
            case 'CLAIM_APPROVED': await handleClaimApproved(data); break;
          }
          channel.ack(msg);
        } catch (err) {
          console.error(`❌ Error notification_queue:`, err.message);
          channel.nack(msg, false, false);
        }
      }
    });

    // Disruption Payout Consumer
    channel.consume(DISRUPTION_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log(`📩 Received Disruption Payout Notification for ${data.userId}`);
          await handleDisruptionPayout(data);
          channel.ack(msg);
        } catch (err) {
          console.error(`❌ Error disruption_queue:`, err.message);
          channel.nack(msg, false, false);
        }
      }
    });

  } catch (error) {
    console.error('❌ Failed to start consumer:', error.message);
  }
};

module.exports = {
  startConsumer,
};
