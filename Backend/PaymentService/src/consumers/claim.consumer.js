const { getChannel } = require('../utils/rabbitmq');
const { processPayout } = require('../services/payout.service');

const startClaimConsumer = async () => {
  const channel = getChannel();
  const queue = 'claim.approved.queue';

  channel.prefetch(1);

  console.log(`🎧 Waiting for messages in ${queue}`);

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const eventContent = JSON.parse(msg.content.toString());
      console.log(`📥 Received claim approved event: ${eventContent.claimId}`);

      await processPayout(eventContent);

      channel.ack(msg);
      console.log(`✅ Successfully processed & acknowledged claim: ${eventContent.claimId}`);
    } catch (error) {
      console.error('❌ Failed to process claim message', error);
      
      channel.reject(msg, false);
      console.log(`📨 Message routed to DLQ`);
    }
  }, { noAck: false });
};

module.exports = { startClaimConsumer };
