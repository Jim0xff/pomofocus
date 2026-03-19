import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createServer } from '../src/server.ts';
import { AppDataSource } from '../src/infra/datasource.ts';
import { processStatsJob } from '../src/jobs/statsHandler.ts';
import { guardStaleTimers } from '../src/jobs/guardianService.ts';
import { UserDailyStatsEntity } from '../src/entities/user-daily-stats.entity.ts';
import { WeeklySummaryEntity } from '../src/entities/weekly-summary.entity.ts';
import { TimerSessionEntity } from '../src/entities/timer-session.entity.ts';
import { TaskEntity } from '../src/entities/task.entity.ts';
import * as timerService from '../src/services/timer.service.ts';
import dayjs from 'dayjs';

const TEST_USER = '0xcccccccccccccccccccccccccccccccccccccccc';

describe('Background jobs', () => {
  let server: import('http').Server;

  beforeAll(async () => {
    const created = await createServer();
    server = created.httpServer;
  });

  afterAll(async () => {
    await AppDataSource.destroy();
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  });

  beforeEach(async () => {
    await Promise.all([
      AppDataSource.getRepository(UserDailyStatsEntity).clear(),
      AppDataSource.getRepository(WeeklySummaryEntity).clear(),
      AppDataSource.getRepository(TimerSessionEntity).clear(),
      AppDataSource.getRepository(TaskEntity).clear(),
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('aggregates stats via stats:drain handler', async () => {
    await processStatsJob({
      sessionId: 's-1',
      userId: TEST_USER,
      phase: 'FOCUS',
      actualElapsedSeconds: 1500,
      completedAt: '2026-03-19T10:00:00Z',
    });
    await processStatsJob({
      sessionId: 's-2',
      userId: TEST_USER,
      phase: 'SHORT_BREAK',
      actualElapsedSeconds: 300,
      completedAt: '2026-03-19T10:30:00Z',
    });

    const daily = await AppDataSource.getRepository(UserDailyStatsEntity).find();
    expect(daily).toHaveLength(1);
    expect(daily[0].focusSessions).toBe(1);
    expect(daily[0].breakSeconds).toBe(300);

    const weekly = await AppDataSource.getRepository(WeeklySummaryEntity).find();
    expect(weekly).toHaveLength(1);
    expect(weekly[0].focusSessions).toBe(1);
    expect(weekly[0].breakSeconds).toBe(300);
  });

  it('completes stale timers without active redis flags', async () => {
    const task = await AppDataSource.getRepository(TaskEntity).save(
      AppDataSource.getRepository(TaskEntity).create({
        userId: TEST_USER,
        title: 'stale-task',
        estimatedPomodoros: 1,
      })
    );
    const session = await AppDataSource.getRepository(TimerSessionEntity).save(
      AppDataSource.getRepository(TimerSessionEntity).create({
        userId: TEST_USER,
        taskId: task.id,
        phase: 'FOCUS',
        status: 'RUNNING',
        plannedDurationSeconds: 1500,
        startedAt: dayjs().subtract(10, 'minute').toDate(),
      })
    );

    await guardStaleTimers(0.1);

    const updated = await AppDataSource.getRepository(TimerSessionEntity).findOneBy({ id: session.id });
    expect(updated?.status).toBe('COMPLETED');
  });

  it('cancels stale timers when completion fails', async () => {
    const taskRepo = AppDataSource.getRepository(TaskEntity);
    const timerRepo = AppDataSource.getRepository(TimerSessionEntity);
    const task = await taskRepo.save(taskRepo.create({ userId: TEST_USER, title: 'fail-complete', estimatedPomodoros: 1 }));
    const session = await timerRepo.save(
      timerRepo.create({
        userId: TEST_USER,
        taskId: task.id,
        phase: 'FOCUS',
        status: 'RUNNING',
        plannedDurationSeconds: 1200,
        startedAt: dayjs().subtract(6, 'minute').toDate(),
      })
    );

    jest.spyOn(timerService, 'completeTimer').mockRejectedValueOnce(new Error('boom'));
    const cancelSpy = jest.spyOn(timerService, 'cancelTimer');

    await guardStaleTimers(0.1);

    expect(cancelSpy).toHaveBeenCalledWith(TEST_USER, session.id);
  });
});
