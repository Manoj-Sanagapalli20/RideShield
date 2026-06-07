require('dotenv').config();
const app = require('./src/app');
const { connectRabbitMQ } = require('./src/config/rabbitmq');
const { startConsumer } = require('./src/consumer/notificationConsumer');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  const { registerReconnectCallback } = require('./src/config/rabbitmq');
  
  registerReconnectCallback(async () => {
    console.log('🔄 Reconnected to RabbitMQ. Restarting consumer...');
    await startConsumer();
  });

  // Try to connect RabbitMQ but don't crash if unavailable (local dev)
  try {
    await connectRabbitMQ();
    await startConsumer();
    console.log('✅ RabbitMQ connected and consumer started');
  } catch (error) {
    console.warn('⚠️  RabbitMQ unavailable — notification service running in degraded mode (no queue consumer):', error.message);
  }

  // Always start the HTTP server regardless of RabbitMQ status
  app.listen(PORT, () => {
    console.log(`🚀 Notification Service running on port ${PORT}`);
  });
};

// Handle basic uncaught errors gracefully without crashing wildly
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

startServer();
