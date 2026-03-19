import dayjs from 'dayjs';
import { AppDataSource } from '../infra/datasource.js';
import { TimerSessionEntity } from '../entities/timer-session.entity.js';
import { redis } from '../infra/redis.js';
import * as timerService from '../services/timer.service.js';
import { logger } from '../infra/logger.js';

export const guardStaleTimers = async (thresholdMinutes = 5) => {
  const repo = AppDataSource.getRepository(TimerSessionEntity);
  const threshold = dayjs().subtract(thresholdMinutes, 'minute').toDate();
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
      await timerService.completeTimer(session.userId, session.id);
      logger.info('guardian completed stale timer', { sessionId: session.id });
    } catch (err) {
      logger.warn('guardian failed to complete stale timer, cancelling', { sessionId: session.id, err: (err as Error).message });
      await timerService.cancelTimer(session.userId, session.id);
    }
  }
};
