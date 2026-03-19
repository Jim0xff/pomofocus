import { Worker } from 'bullmq';
import { timerQueue } from '../infra/bullmq.js';
import { ENV } from '../config/env.js';
import { completeTimer } from '../services/timer.service.js';
import { initializeDatabase } from '../infra/datasource.js';
import { verifyRedis } from '../infra/redis.js';
import { logger } from '../infra/logger.js';

const bootstrap = async () => {
  await initializeDatabase();
  await verifyRedis();

  const worker = new Worker(
    timerQueue.name,
    async (job) => {
      const { sessionId, userId } = job.data as { sessionId: string; userId: string };
      try {
        await completeTimer(userId, sessionId);
        logger.info('timer auto-complete', { sessionId, userId });
      } catch (err) {
        if (err instanceof Error) {
          logger.warn(`timer worker skipped job: ${err.message}`, { sessionId, userId });
        }
      }
    },
    {
      connection: { url: ENV.redisUrl },
      prefix: timerQueue.opts.prefix,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('timer worker job failed', { jobId: job?.id, err: err.message });
  });
};

bootstrap().catch((err) => {
  logger.error(`Timer worker failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
