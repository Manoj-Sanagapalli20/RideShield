require('dotenv').config();
const amqp = require('amqplib');

const publishTestEvent = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    const channel = await connection.createChannel();
    
    const exchange = 'events';

    // 1. Test Subscription Purchase Event
    const subscriptionEvent = {
        eventId: "evt_sub_" + Date.now(),
        type: "SUBSCRIPTION_PURCHASE",
        userId: "user_123",
        plan: "PRO",
        amount: 500 // Note: amount is 500 (will be multiplied by 100 to 50000 paise/cents in Stripe)
    };

    channel.publish(
      exchange, 
      'subscription.purchase', 
      Buffer.from(JSON.stringify(subscriptionEvent)), 
      { persistent: true }
    );
    console.log("📤 Published Test Subscription Event:", subscriptionEvent.eventId);

    // 2. Test Claim Approved Event
    const claimEvent = {
        eventId: "evt_clm_" + Date.now(),
        type: "CLAIM_APPROVED",
        claimId: "clm_id_" + Date.now(),
        userId: "user_456",
        payoutAmount: 1500,
        reason: "Medical Emergency"
    };

    channel.publish(
      exchange, 
      'claim.approved', 
      Buffer.from(JSON.stringify(claimEvent)), 
      { persistent: true }
    );
    console.log("📤 Published Test Claim Event:", claimEvent.eventId);

    // Close connection after half a second to ensure messages are sent
    setTimeout(() => {
        connection.close();
        console.log("✅ Test messages published successfully.");
        process.exit(0);
    }, 500);
    
  } catch (error) {
    console.error("❌ Failed to publish test events:", error);
    process.exit(1);
  }
};

publishTestEvent();
