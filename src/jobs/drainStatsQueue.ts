import { Worker } from 'bullmq';
import { statsQueue } from '../infra/bullmq.js';
import { initializeDatabase } from '../infra/datasource.js';
import { verifyRedis } from '../infra/redis.js';
import { logger } from '../infra/logger.js';
import { recordTimerStats } from '../services/stats.service.js';
import { ENV } from '../config/env.js';

type TimerCompletedJob = {
  sessionId: string;
  userId: string;
  taskId?: string | null;
  phase: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  actualElapsedSeconds: number;
  completedAt?: string;
};

const bootstrap = async () => {
  await initializeDatabase();
  await verifyRedis();

  const worker = new Worker(
    statsQueue.name,
    async (job) => {
      const payload = job.data as TimerCompletedJob;
      await recordTimerStats({
        userId: payload.userId,
        phase: payload.phase,
        durationSeconds: payload.actualElapsedSeconds,
        completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
      });
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
