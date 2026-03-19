import { AppDataSource } from '../infra/datasource.js';
import { In } from 'typeorm';
import { TimerSessionEntity, TimerPhase, TimerStatus } from '../entities/timer-session.entity.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { auditLog } from '../infra/audit.js';
import { redis } from '../infra/redis.js';
import { TaskEntity } from '../entities/task.entity.js';
import { timerQueue, statsQueue } from '../infra/bullmq.js';
import { recordTimerStats } from './stats.service.js';
import { randomUUID } from 'crypto';

const timerRepo = () => AppDataSource.getRepository(TimerSessionEntity);
const taskRepo = () => AppDataSource.getRepository(TaskEntity);

const ACTIVE_STATUSES: TimerStatus[] = ['RUNNING', 'PAUSED'];

const activeKey = (userId: string) => `active_timer:${userId}`;
const lockKey = (userId: string) => `timer_lock:${userId}`;
const etaCacheKey = (userId: string) => `eta_cache:${userId}`;
const TIMER_LOCK_TTL_MS = 5000;
const ETA_CACHE_TTL_MS = 60_000;

const writeActiveFlag = async (userId: string, session?: TimerSessionEntity | null) => {
  if (!session || session.status !== 'RUNNING') {
    await redis.del(activeKey(userId));
    return;
  }
  await redis.set(activeKey(userId), JSON.stringify({ id: session.id, phase: session.phase, startedAt: session.startedAt }), 'PX', session.plannedDurationSeconds * 1000);
};

const loadActiveSession = async (userId: string) => {
  return timerRepo().findOne({ where: { userId, status: 'RUNNING' } });
};

export type StartTimerInput = {
  phase: TimerPhase;
  durationSeconds: number;
  taskId: string;
};

export const startTimer = async (userId: string, input: StartTimerInput) => {
  return withTimerLock(userId, async () => {
    if (input.durationSeconds < 60 || input.durationSeconds > 3600) {
      throw new HttpError(400, 'Duration must be between 60 and 3600 seconds');
    }
    if (!input.taskId) {
      throw new HttpError(400, 'taskId is required');
    }
    const task = await taskRepo().findOne({ where: { id: input.taskId, userId, status: In(['PENDING', 'ACTIVE']) } });
    if (!task) {
      throw new HttpError(400, 'Task is not available for timer');
    }
    const existing = await loadActiveSession(userId);
    if (existing) {
      throw new HttpError(409, 'Active timer already running');
    }
    const entity = timerRepo().create({
      userId,
      taskId: input.taskId,
      phase: input.phase,
      status: 'RUNNING',
      plannedDurationSeconds: input.durationSeconds,
      startedAt: new Date(),
    });
    const saved = await timerRepo().save(entity);
    await writeActiveFlag(userId, saved);
    await enqueueTimerJob(saved);
    await setEtaCache(userId, buildEtaPayload(saved));
    auditLog('TIMER_START', userId, { id: saved.id, phase: saved.phase, taskId: saved.taskId });
    return saved;
  });
};

const getSessionOrThrow = async (userId: string, sessionId: string) => {
  const session = await timerRepo().findOne({ where: { id: sessionId, userId } });
  if (!session) {
    throw new HttpError(404, 'Timer session not found');
  }
  return session;
};

export const pauseTimer = async (userId: string, sessionId: string) => {
  return withTimerLock(userId, async () => {
    const session = await getSessionOrThrow(userId, sessionId);
    if (session.status !== 'RUNNING') {
      throw new HttpError(409, 'Timer is not running');
    }
    session.status = 'PAUSED';
    session.pausedAt = new Date();
    session.elapsedSeconds = Math.min(session.plannedDurationSeconds, session.elapsedSeconds + durationSince(session.startedAt));
    const saved = await timerRepo().save(session);
    await writeActiveFlag(userId, null);
    await removeTimerJob(saved.id);
    await clearEtaCache(userId);
    auditLog('TIMER_PAUSE', userId, { id: saved.id });
    return saved;
  });
};

export const resumeTimer = async (userId: string, sessionId: string) => {
  return withTimerLock(userId, async () => {
    const session = await getSessionOrThrow(userId, sessionId);
    if (session.status !== 'PAUSED') {
      throw new HttpError(409, 'Timer is not paused');
    }
    session.status = 'RUNNING';
    session.startedAt = new Date();
    session.pausedAt = null;
    const saved = await timerRepo().save(session);
    await writeActiveFlag(userId, saved);
    await enqueueTimerJob(saved);
    await setEtaCache(userId, buildEtaPayload(saved));
    auditLog('TIMER_RESUME', userId, { id: saved.id });
    return saved;
  });
};

export const completeTimer = async (userId: string, sessionId: string) => {
  return withTimerLock(userId, async () => {
    const session = await getSessionOrThrow(userId, sessionId);
    if (!ACTIVE_STATUSES.includes(session.status)) {
      throw new HttpError(409, 'Timer already closed');
    }
    session.status = 'COMPLETED';
    session.completedAt = new Date();
    session.elapsedSeconds = session.plannedDurationSeconds;
    session.completedPomodoros += session.phase === 'FOCUS' ? 1 : 0;
    const saved = await timerRepo().save(session);
    await writeActiveFlag(userId, null);
    await removeTimerJob(saved.id);
    if (session.taskId && session.phase === 'FOCUS') {
      await taskRepo().increment({ id: session.taskId, userId }, 'actualPomodoros', 1);
    }
    await clearEtaCache(userId);
    auditLog('TIMER_COMPLETE', userId, { id: saved.id, taskId: saved.taskId });
    await statsQueue.add(
      'timer_completed',
      {
        sessionId: saved.id,
        userId,
        taskId: saved.taskId,
        phase: saved.phase,
        durationSeconds: saved.plannedDurationSeconds,
        actualElapsedSeconds: saved.elapsedSeconds,
        completedAt: saved.completedAt?.toISOString(),
      },
      { removeOnComplete: true, removeOnFail: true }
    );
    if (process.env.NODE_ENV === 'test') {
      await recordTimerStats({
        userId,
        phase: saved.phase,
        durationSeconds: saved.elapsedSeconds,
        completedAt: saved.completedAt,
      });
    }
    return saved;
  });
};

export const cancelTimer = async (userId: string, sessionId: string) => {
  return withTimerLock(userId, async () => {
    const session = await getSessionOrThrow(userId, sessionId);
    if (!ACTIVE_STATUSES.includes(session.status)) {
      return session;
    }
    session.status = 'CANCELLED';
    const saved = await timerRepo().save(session);
    await writeActiveFlag(userId, null);
    await removeTimerJob(saved.id);
    await clearEtaCache(userId);
    auditLog('TIMER_CANCEL', userId, { id: saved.id });
    return saved;
  });
};

export const activeTimer = async (userId: string) => {
  return timerRepo().findOne({ where: { userId, status: 'RUNNING' } });
};

export const getTimerEta = async (userId: string) => {
  const cached = await redis.get(etaCacheKey(userId));
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { ...parsed, estimatedEndTime: new Date(parsed.estimatedEndTime) };
    } catch {
      // fall back to recompute
    }
  }
  const session = await activeTimer(userId);
  if (!session) return null;
  const payload = buildEtaPayload(session);
  await setEtaCache(userId, payload);
  return { ...payload, estimatedEndTime: new Date(payload.estimatedEndTime) };
};

export const getRecentSessions = async (userId: string, limit = 10) => {
  return timerRepo().find({
    where: { userId },
    order: { updatedAt: 'DESC' },
    take: limit,
  });
};

export const skipBreak = async (userId: string, sessionId: string) => {
  const session = await getSessionOrThrow(userId, sessionId);
  if (session.phase === 'FOCUS') {
    throw new HttpError(400, 'Cannot skip focus phase');
  }
  return completeTimer(userId, sessionId);
};

const durationSince = (since?: Date | null) => {
  if (!since) return 0;
  return Math.floor((Date.now() - since.getTime()) / 1000);
};

const runtimeElapsed = (session: TimerSessionEntity) => {
  if (session.status !== 'RUNNING' || !session.startedAt) {
    return 0;
  }
  return durationSince(session.startedAt);
};

export const getRemainingSeconds = (session: TimerSessionEntity) => {
  return Math.max(session.plannedDurationSeconds - session.elapsedSeconds - runtimeElapsed(session), 0);
};

export const presentTimerSession = (session: TimerSessionEntity) => ({
  ...session,
  remainingSeconds: getRemainingSeconds(session),
});

const buildEtaPayload = (session: TimerSessionEntity) => {
  const remaining = getRemainingSeconds(session);
  return {
    sessionId: session.id,
    remainingSeconds: remaining,
    estimatedEndTime: new Date(Date.now() + remaining * 1000).toISOString(),
  };
};

const acquireTimerLock = async (userId: string) => {
  const token = randomUUID();
  const acquired = await redis.set(lockKey(userId), token, 'PX', TIMER_LOCK_TTL_MS, 'NX');
  if (!acquired) {
    throw new HttpError(409, 'Timer is busy');
  }
  return token;
};

const releaseTimerLock = async (userId: string, token: string) => {
  const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  await redis.eval(script, 1, lockKey(userId), token);
};

const withTimerLock = async <T>(userId: string, fn: () => Promise<T>) => {
  const token = await acquireTimerLock(userId);
  try {
    return await fn();
  } finally {
    await releaseTimerLock(userId, token);
  }
};

const setEtaCache = async (userId: string, payload: { sessionId: string; remainingSeconds: number; estimatedEndTime: string }) => {
  await redis.set(etaCacheKey(userId), JSON.stringify(payload), 'PX', ETA_CACHE_TTL_MS);
};

const clearEtaCache = async (userId: string) => {
  await redis.del(etaCacheKey(userId));
};

const enqueueTimerJob = async (session: TimerSessionEntity) => {
  const remaining = Math.max(session.plannedDurationSeconds - session.elapsedSeconds, 0);
  if (remaining <= 0) return;
  await timerQueue.add(
    'timer:complete',
    { sessionId: session.id, userId: session.userId },
    { delay: remaining * 1000, removeOnComplete: true, removeOnFail: true, jobId: session.id }
  );
};

const removeTimerJob = async (sessionId: string) => {
  try {
    await timerQueue.remove(sessionId);
  } catch (err) {
    // noop if job not found
  }
};
