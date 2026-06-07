import redis
import json
import logging

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        try:
            import os
            redis_url = os.getenv("REDIS_URL")
            if redis_url:
                self.client = redis.Redis.from_url(
                    redis_url,
                    decode_responses=True
                )
            else:
                host = os.getenv("REDIS_HOST", 'redis-13328.crce206.ap-south-1-1.ec2.cloud.redislabs.com')
                port = int(os.getenv("REDIS_PORT", 13328))
                password = os.getenv("REDIS_PASSWORD", 'DgspaWb4Pe7IKzaMq1M96YEMJ6tpsbSH')
                
                self.client = redis.Redis(
                    host=host, 
                    port=port, 
                    password=password,
                    db=0, 
                    decode_responses=True
                )
            self.client.ping()
        except Exception as e:
            logger.warning(f"Redis not available ({e}). Running in fallback (in-memory) mode.")
            self.client = None
            self._fallback_cache = {}

    def keys(self, pattern: str):
        try:
            if self.client:
                return self.client.keys(pattern)
            else:
                import fnmatch
                return [k for k in self._fallback_cache.keys() if fnmatch.fnmatch(k, pattern)]
        except Exception as e:
            logger.error(f"Redis keys error: {e}")
            return []

    def get(self, key: str):
        try:
            if self.client:
                data = self.client.get(key)
                return json.loads(data) if data else None
            else:
                return self._fallback_cache.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set(self, key: str, value: dict, ttl: int = 1800):
        try:
            if self.client:
                self.client.setex(key, ttl, json.dumps(value))
            else:
                self._fallback_cache[key] = value
        except Exception as e:
            logger.error(f"Redis set error: {e}")

redis_client = RedisService()
