import dayjs from 'dayjs';
import { AppDataSource } from '../infra/datasource.js';
import { TimerSessionEntity } from '../entities/timer-session.entity.js';
import { verifyRedis, redis } from '../infra/redis.js';
import { completeTimer, cancelTimer } from '../services/timer.service.js';
import { logger } from '../infra/logger.js';

const STALE_MINUTES = 5;

const runGuardian = async () => {
  await AppDataSource.initialize();
  await verifyRedis();

  const repo = AppDataSource.getRepository(TimerSessionEntity);
  const threshold = dayjs().subtract(STALE_MINUTES, 'minute').toDate();
  const staleSessions = await repo
    .createQueryBuilder('timer')
    .where('timer.status = :status', { status: 'RUNNING' })
    .andWhere('timer.startedAt < :threshold', { threshold })
    .getMany();

  for (const session of staleSessions) {
    const activeKey = `active_timer:${session.userId}`;
    const hasActiveFlag = await redis.get(activeKey);
    if (hasActiveFlag) continue;
    try {
      await completeTimer(session.userId, session.id);
      logger.info('guardian completed stale timer', { sessionId: session.id });
    } catch (err) {
      logger.warn('guardian failed to complete stale timer, cancelling', { sessionId: session.id, err: (err as Error).message });
      await cancelTimer(session.userId, session.id);
    }
  }

  await AppDataSource.destroy();
  logger.info('timer guardian finished');
};

runGuardian().catch((err) => {
  logger.error(`guardian job failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
