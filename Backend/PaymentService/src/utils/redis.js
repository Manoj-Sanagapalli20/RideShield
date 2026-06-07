const { createClient } = require('redis');

let client = null;

const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("⚠️ REDIS_URL not configured. Running PaymentService without Redis.");
    return;
  }

  try {
    client = createClient({ url: redisUrl });
    client.on('error', (err) => console.error('PaymentService Redis Client Error:', err));
    await client.connect();
    console.log('🔗 Connected to Redis on Upstash / Cloud!');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    client = null; // Fallback to mock
  }
};

const getRedisClient = () => {
  return client;
};

// Check Idempotency: returns true if key is successfully set (i.e. is new), false if it already exists
const checkIdempotency = async (key, expirationInSeconds = 86400) => {
  if (!client) {
    console.log(`[Idempotency Mock] checkIdempotency key: ${key}`);
    return true;
  }

  try {
    // NX: Set only if it does not exist. EX: set expiration in seconds.
    const result = await client.set(key, 'PENDING', {
      NX: true,
      EX: expirationInSeconds
    });
    // If set succeeds, result is "OK" (returns true). If it fails (exists), result is null (returns false).
    return result === 'OK';
  } catch (err) {
    console.error(`Error checking idempotency for key ${key}:`, err.message);
    return true; // Fallback to allow processing
  }
};

const markIdempotencySuccess = async (key) => {
  if (!client) return;
  try {
    // Upstash / standard Redis: we can update the value
    await client.set(key, 'SUCCESS', {
      XX: true // Update only if it already exists
    });
  } catch (err) {
    console.error(`Error marking idempotency success for key ${key}:`, err.message);
  }
};

const clearIdempotency = async (key) => {
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error(`Error clearing idempotency for key ${key}:`, err.message);
  }
};

module.exports = { 
  connectRedis, 
  getRedisClient, 
  checkIdempotency, 
  markIdempotencySuccess,
  clearIdempotency
};
