import { Worker } from 'bullmq';
import { statsQueue } from '../infra/bullmq.js';
import { initializeDatabase } from '../infra/datasource.js';
import { verifyRedis } from '../infra/redis.js';
import { logger } from '../infra/logger.js';
import { processStatsJob, type TimerCompletedJob } from './statsHandler.js';
import { ENV } from '../config/env.js';

const bootstrap = async () => {
  await initializeDatabase();
  await verifyRedis();

  const worker = new Worker(
    statsQueue.name,
    async (job) => {
      const payload = job.data as TimerCompletedJob;
      await processStatsJob(payload);
      logger.info('stats drain processed', { sessionId: payload.sessionId });
    },
    {
      connection: { url: ENV.redisUrl },
      prefix: statsQueue.opts.prefix,
    }
  );

  await new Promise<void>((resolve, reject) => {
    worker.on('drained', async () => {
      await worker.close();
      resolve();
    });
    worker.on('failed', (job, err) => {
      logger.error('stats drain job failed', { jobId: job?.id, err: err.message });
      reject(err);
    });
  });

  logger.info('stats queue drained');
};

bootstrap().catch((err) => {
  logger.error(`Stats drain failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
