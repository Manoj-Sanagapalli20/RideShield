const amqp = require('amqplib');

let connection;
let channel;
const onReconnectCallbacks = [];

const registerReconnectCallback = (cb) => {
  onReconnectCallbacks.push(cb);
};

const connectRabbitMQ = async () => {
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      console.log(`Connecting to RabbitMQ (Attempt ${attempt})...`);
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      
      connection.on("error", (err) => {
        console.error("PaymentService RabbitMQ connection error:", err.message);
      });
      connection.on("close", () => {
        console.log("PaymentService RabbitMQ connection closed. Reconnecting in 5 seconds...");
        channel = null;
        connection = null;
        setTimeout(async () => {
          try {
            await connectRabbitMQ();
            // Trigger all registered reconnect callbacks (like starting the consumer again)
            for (const cb of onReconnectCallbacks) {
              await cb();
            }
          } catch (reconnectErr) {
            console.error("Error during RabbitMQ reconnection callback execution:", reconnectErr.message);
          }
        }, 5000);
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
      console.warn(`⚠️ RabbitMQ connection attempt ${attempt} failed: ${error.message}. Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
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

module.exports = { connectRabbitMQ, getChannel, publishEvent, registerReconnectCallback };
