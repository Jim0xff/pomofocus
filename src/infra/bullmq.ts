import { Queue } from 'bullmq';
import { ENV } from '../config/env.js';

export const statsQueue = new Queue('stats_refresh', {
  connection: { url: ENV.redisUrl },
  prefix: ENV.bullQueuePrefix,
});

export const timerQueue = new Queue('timer_events', {
  connection: { url: ENV.redisUrl },
  prefix: ENV.bullQueuePrefix,
});
