const { checkIdempotency, markIdempotencySuccess } = require('../utils/redis');
const Payment = require('../models/payment.model');
const stripeService = require('./stripe.service');
const eventService = require('./event.service');

const processSubscription = async (event) => {
  try {
    const { eventId, userId, plan, amount, email } = event;

    console.log(`Processing subscription purchase for user: ${userId}`, { eventId });

    // 2. Check Idempotency
    const isNew = await checkIdempotency(`payment:${eventId}`);
    if (!isNew) {
      console.log(`Duplicate subscription event detected, skipping`, { eventId });
      return;
    }

    // 3. Create initial Payment Record
    const paymentRecord = new Payment({
      eventId,
      userId,
      email,
      plan,
      amount,
      status: 'PENDING'
    });
    await paymentRecord.save();

    // 4. Create Stripe Order / Payment Intent
    // Simulating the actual purchase execution since there's no frontend callback
    const order = await stripeService.createOrder(amount, `receipt_${eventId}`);
    paymentRecord.orderId = order.id;
    
    // Simulate successful payment instantly
    paymentRecord.status = 'SUCCESS';
    await paymentRecord.save();
    
    // 5. Mark idempotent completion
    await markIdempotencySuccess(`payment:${eventId}`);

    // 6. Publish Success Event
    await eventService.publishPaymentSuccess(userId, plan, amount, email, paymentRecord.orderId);
    
    console.log(`Successfully processed subscription purchase for user: ${userId}`, { eventId });

  } catch (error) {
    console.error('Error processing subscription purchase', error);
    
    // Publish Failure Event if event schema had userId
    if (event && event.userId) {
      await eventService.publishPaymentFailed(event.userId, error.message);
    }
    
    // Update DB if possible
    if (event && event.eventId) {
      try {
        await Payment.findOneAndUpdate({ eventId: event.eventId }, { status: 'FAILED' });
      } catch (dbErr) {
        console.error('Failed to update payment status to FAILED', dbErr);
      }
    }
    
    throw error; // Re-throw for RabbitMQ nack/retry
  }
};

module.exports = { processSubscription };
