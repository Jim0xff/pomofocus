import dayjs from 'dayjs';
import { Between } from 'typeorm';
import { AppDataSource } from '../infra/datasource.js';
import { UserDailyStatsEntity } from '../entities/user-daily-stats.entity.js';
import { WeeklySummaryEntity } from '../entities/weekly-summary.entity.js';

const repo = () => AppDataSource.getRepository(UserDailyStatsEntity);
const weeklyRepo = () => AppDataSource.getRepository(WeeklySummaryEntity);

type TimerStatPayload = {
  userId: string;
  phase: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  durationSeconds: number;
  completedAt?: Date | null;
};

export const recordTimerStats = async ({ userId, phase, durationSeconds, completedAt }: TimerStatPayload) => {
  const eventDate = dayjs(completedAt ?? new Date());
  const statDate = eventDate.format('YYYY-MM-DD');
  let entity = await repo().findOne({ where: { userId, statDate } });
  if (!entity) {
    entity = repo().create({ userId, statDate, focusSessions: 0, focusSeconds: 0, breakSeconds: 0 });
  }
  if (phase === 'FOCUS') {
    entity.focusSessions += 1;
    entity.focusSeconds += durationSeconds;
  } else {
    entity.breakSeconds += durationSeconds;
  }
  await repo().save(entity);
  const weekStart = eventDate.startOf('week').format('YYYY-MM-DD');
  let weekly = await weeklyRepo().findOne({ where: { userId, weekStart } });
  if (!weekly) {
    weekly = weeklyRepo().create({ userId, weekStart, focusSessions: 0, focusSeconds: 0, breakSeconds: 0 });
  }
  if (phase === 'FOCUS') {
    weekly.focusSessions += 1;
    weekly.focusSeconds += durationSeconds;
  } else {
    weekly.breakSeconds += durationSeconds;
  }
  await weeklyRepo().save(weekly);
};

export const getStatsSummary = async (userId: string, from?: string, to?: string) => {
  const qb = repo()
    .createQueryBuilder('stats')
    .select('COALESCE(SUM(stats.focusSessions), 0)', 'focusSessions')
    .addSelect('COALESCE(SUM(stats.focusSeconds), 0)', 'focusSeconds')
    .addSelect('COALESCE(SUM(stats.breakSeconds), 0)', 'breakSeconds')
    .where('stats.userId = :userId', { userId });

  if (from) {
    qb.andWhere('stats.statDate >= :from', { from });
  }
  if (to) {
    qb.andWhere('stats.statDate <= :to', { to });
  }

  const raw = await qb.getRawOne<{ focusSessions: string; focusSeconds: string; breakSeconds: string }>();
  return {
    focusSessions: Number(raw?.focusSessions ?? 0),
    focusSeconds: Number(raw?.focusSeconds ?? 0),
    breakSeconds: Number(raw?.breakSeconds ?? 0),
  };
};

export const getWeeklySummary = async (userId: string, weekStart?: string) => {
  const start = weekStart ?? dayjs().startOf('week').format('YYYY-MM-DD');
  const weekly = await weeklyRepo().findOne({ where: { userId, weekStart: start } });
  return {
    weekStart: start,
    focusSessions: weekly?.focusSessions ?? 0,
    focusSeconds: weekly?.focusSeconds ?? 0,
    breakSeconds: weekly?.breakSeconds ?? 0,
  };
};

export const getDailyStatsSeries = async (userId: string, days = 7, startDate?: string) => {
  const normalizedDays = Math.max(1, Math.min(days, 30));
  const startBase = startDate ? dayjs(startDate) : dayjs().subtract(normalizedDays - 1, 'day');
  const start = startBase.format('YYYY-MM-DD');
  const end = startBase.add(normalizedDays - 1, 'day').format('YYYY-MM-DD');
  const rows = await repo().find({
    where: {
      userId,
      statDate: Between(start, end),
    },
    order: { statDate: 'ASC' },
  });

  const series: Array<{ statDate: string; focusSessions: number; focusSeconds: number; breakSeconds: number }> = [];
  for (let i = 0; i < normalizedDays; i += 1) {
    const current = startBase.add(i, 'day').format('YYYY-MM-DD');
    const row = rows.find((r) => r.statDate === current);
    series.push({
      statDate: current,
      focusSessions: row?.focusSessions ?? 0,
      focusSeconds: row?.focusSeconds ?? 0,
      breakSeconds: row?.breakSeconds ?? 0,
    });
  }
  return series;
};
