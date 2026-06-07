const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://localhost:5672';
const EXCHANGE_NAME = 'notification_exchange';

const publishEvent = async (routingKey, messagePayload) => {
  let connection;
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Ensure the exchange exists
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Publish the message
    const msgBuffer = Buffer.from(JSON.stringify(messagePayload));
    channel.publish(EXCHANGE_NAME, routingKey, msgBuffer, { persistent: true });

    console.log(`✅ [Publisher] Sent event '${routingKey}':\n`, messagePayload);
  } catch (error) {
    console.error('❌ [Publisher] Error:', error.message);
  } finally {
    if (connection) {
      setTimeout(() => connection.close(), 500);
    }
  }
};


// Example 1: Publish PAYMENT_SUCCESS
const simulatePaymentSuccess = () => {
  publishEvent('PAYMENT_SUCCESS', {
    userId: 'U-123',
    email: 'sniperafroz@gmail.com',
    amount: 150.00,
    transactionId: 'TXN-987654321',
  });
};

// Example 2: Publish FLOOD_ALERT
const simulateFloodAlert = () => {
  publishEvent('FLOOD_ALERT', {
    region: 'Florida Coast',
    severity: 'High',
    users: [
      { email: 'support@rideshield.com', phone: '+1234567890' },
      { email: 'support@rideshield.com' } // No phone
    ]
  });
};

// Example 3: Publish CLAIM_APPROVED
const simulateClaimApproved = () => {
  publishEvent('CLAIM_APPROVED', {
    email: 'claimant@example.com',
    claimId: 'CLM-55555',
    amount: 2500.00
  });
};

simulatePaymentSuccess();
simulateFloodAlert();
simulateClaimApproved();
