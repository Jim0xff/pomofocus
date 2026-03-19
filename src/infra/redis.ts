import { Redis } from 'ioredis';
import { ENV } from '../config/env.js';

export const redis = new Redis(ENV.redisUrl, {
  maxRetriesPerRequest: null,
});

export const verifyRedis = async () => {
  await redis.ping();
};
