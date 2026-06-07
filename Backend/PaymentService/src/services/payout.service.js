const { checkIdempotency, markIdempotencySuccess } = require('../utils/redis');
const Payout = require('../models/payout.model');
const stripeService = require('./stripe.service');
const eventService = require('./event.service');

const processPayout = async (event) => {
  try {
    const { claimId, userId, payoutAmount } = event;

    console.log(`Processing claim payout for claim: ${claimId}`, { claimId });

    // 2. Check Idempotency (For payouts -> use claimId based on requirements)
    const isNew = await checkIdempotency(`payout:${claimId}`);
    if (!isNew) {
      console.log(`Duplicate claim processing detected, skipping`, { claimId });
      return; // Already processed
    }

    // 3. Create initial Payout Record
    const payoutRecord = new Payout({
      claimId,
      userId,
      amount: payoutAmount,
      status: 'PENDING'
    });
    // Check if it exists due to race conditions (claimId is unique)
    try {
      await payoutRecord.save();
    } catch(err) {
      if (err.code === 11000) {
         console.log(`Payout record already exists for claim: ${claimId}, skipping`);
         return;
      }
      throw err;
    }

    // 4. Execute Payout
    const payoutResult = await stripeService.createPayout(payoutAmount, claimId);
    
    payoutRecord.payoutId = payoutResult.id;
    payoutRecord.status = 'SUCCESS';
    await payoutRecord.save();
    
    // 5. Mark idempotent completion
    await markIdempotencySuccess(`payout:${claimId}`);

    // 6. Publish Success Event
    await eventService.publishPayoutSuccess(claimId, userId, payoutAmount);
    
    console.log(`Successfully processed payout for claim: ${claimId}`);

  } catch (error) {
    console.error('Error processing claim payout', error);
    
    if (event && event.claimId && event.userId) {
      await eventService.publishPayoutFailed(event.claimId, event.userId, error.message);
    }
    
    if (event && event.claimId) {
      try {
        await Payout.findOneAndUpdate({ claimId: event.claimId }, { status: 'FAILED' });
      } catch (dbErr) {
        console.error('Failed to update payout status to FAILED', dbErr);
      }
    }
    
    throw error; // Re-throw for RabbitMQ manual ack
  }
};

module.exports = { processPayout };
