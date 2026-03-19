import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENV } from '../config/env.js';
import { TaskEntity } from '../entities/task.entity.js';
import { UserSettingsEntity } from '../entities/user-settings.entity.js';
import { TimerSessionEntity } from '../entities/timer-session.entity.js';
import { UserDailyStatsEntity } from '../entities/user-daily-stats.entity.js';
import { WeeklySummaryEntity } from '../entities/weekly-summary.entity.js';

const baseOptions: DataSourceOptions =
  ENV.dbType === 'postgres'
    ? {
        type: 'postgres',
        url: ENV.databaseUrl,
        synchronize: true,
      }
    : {
        type: 'sqlite',
        database: ENV.sqlitePath,
        synchronize: true,
      };

export const AppDataSource = new DataSource({
  ...baseOptions,
  logging: false,
  entities: [TaskEntity, UserSettingsEntity, TimerSessionEntity, UserDailyStatsEntity, WeeklySummaryEntity],
});

export const initializeDatabase = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
};
