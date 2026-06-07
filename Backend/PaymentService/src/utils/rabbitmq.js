const amqp = require('amqplib');

let connection;
let channel;

const connectRabbitMQ = async () => {
  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`Connecting to RabbitMQ (Attempt ${attempt + 1}/${maxRetries})...`);
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      
      connection.on("error", (err) => {
        console.error("PaymentService RabbitMQ connection error:", err.message);
      });
      connection.on("close", () => {
        console.log("PaymentService RabbitMQ connection closed.");
      });
      
      channel = await connection.createChannel();
      channel.on("error", (err) => {
        console.error("PaymentService RabbitMQ channel error:", err.message);
      });
      channel.on("close", () => {
        console.log("PaymentService RabbitMQ channel closed.");
      });
      
      console.log('🐇 RabbitMQ Connected successfully!');
      
      // Setup Exchange
      const exchange = 'events';
      await channel.assertExchange(exchange, 'topic', { durable: true });

      // Setup Dead Letter Exchange
      const dlxExchange = 'events.dlx';
      await channel.assertExchange(dlxExchange, 'topic', { durable: true });

      // Setup Queues with DLQ binding
      const setupQueue = async (queueName, routingKey) => {
        const dlqName = `${queueName}.dlq`;
        
        // Assert DLQ
        await channel.assertQueue(dlqName, { durable: true });
        await channel.bindQueue(dlqName, dlxExchange, routingKey);

        // Assert Main Queue
        await channel.assertQueue(queueName, { 
          durable: true,
          deadLetterExchange: dlxExchange,
          deadLetterRoutingKey: routingKey
        });
        await channel.bindQueue(queueName, exchange, routingKey);
      };

      await setupQueue('subscription.purchase.queue', 'subscription.purchase');
      await setupQueue('claim.approved.queue', 'claim.approved');
      
      return; // Connection successful!

    } catch (error) {
      attempt++;
      console.warn(`⚠️ RabbitMQ connection attempt ${attempt} failed: ${error.message}. Retrying in 3 seconds...`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  throw new Error('Could not establish RabbitMQ channel after retries');
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

const publishEvent = async (routingKey, message) => {
  try {
    const ch = getChannel();
    // Default exchange used by Notification Service
    const exchange = 'notification_exchange';
    
    // Assert the exchange just in case Notification Service hasn't yet
    await ch.assertExchange(exchange, 'topic', { durable: true });

    // Map internal keys to Notification Service keys if necessary
    let finalRoutingKey = routingKey;
    if (routingKey === 'payment.success') finalRoutingKey = 'PAYMENT_SUCCESS';
    if (routingKey === 'payment.failed') finalRoutingKey = 'PAYMENT_FAILED';
    if (routingKey === 'payout.success') finalRoutingKey = 'PAYOUT_SUCCESS';
    if (routingKey === 'payout.failed') finalRoutingKey = 'PAYOUT_FAILED';

    const msgString = JSON.stringify(message);
    const published = ch.publish(exchange, finalRoutingKey, Buffer.from(msgString), {
      persistent: true
    });
    
    if (published) {
      console.log(`📤 Published event to ${finalRoutingKey}`, { eventId: message.eventId || message.type });
    } else {
      console.error(`Failed to publish event to ${finalRoutingKey}`);
    }
  } catch (error) {
    console.error(`Error publishing event to ${routingKey}`, error);
  }
};

module.exports = { connectRabbitMQ, getChannel, publishEvent };
