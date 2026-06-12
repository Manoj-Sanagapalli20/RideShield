const amqp = require('amqplib');

let connection = null;
let channel = null;
const onReconnectCallbacks = [];

const registerReconnectCallback = (cb) => {
  onReconnectCallbacks.push(cb);
};

const connectRabbitMQ = async () => {
  const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      console.log(`NotificationService connecting to RabbitMQ (Attempt ${attempt})...`);
      connection = await amqp.connect(rabbitMQUrl);
      
      connection.on("error", (err) => {
        console.error("NotificationService RabbitMQ connection error:", err.message);
      });
      
      connection.on("close", () => {
        console.log("NotificationService RabbitMQ connection closed. Reconnecting in 5 seconds...");
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
        console.error("NotificationService RabbitMQ channel error:", err.message);
      });

      // Assert exactly what we need
      await channel.assertExchange('notification_exchange', 'topic', { durable: true });
      console.log('✅ Connected to RabbitMQ & Exchange asserted');
      return channel;

    } catch (error) {
      console.warn(`⚠️ NotificationService RabbitMQ connection attempt ${attempt} failed: ${error.message}. Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ Channel is not initialized');
  }
  return channel;
};

module.exports = {
  connectRabbitMQ,
  getChannel,
  registerReconnectCallback,
};

