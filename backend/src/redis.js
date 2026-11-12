const Redis = require("ioredis");

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });
}

module.exports = redis;
