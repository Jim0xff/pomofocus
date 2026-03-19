import { recordTimerStats } from '../services/stats.service.js';

export type TimerCompletedJob = {
  sessionId: string;
  userId: string;
  taskId?: string | null;
  phase: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  actualElapsedSeconds: number;
  completedAt?: string;
};

export const processStatsJob = async (payload: TimerCompletedJob) => {
  await recordTimerStats({
    userId: payload.userId,
    phase: payload.phase,
    durationSeconds: payload.actualElapsedSeconds,
    completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
  });
};
