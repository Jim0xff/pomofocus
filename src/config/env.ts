import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, key: string, fallback?: string) => {
  if (value && value.length > 0) {
    return value;
  }
  if (fallback) {
    return fallback;
  }
  throw new Error(`Missing required env var ${key}`);
};

const dbType = (process.env.DB_TYPE ?? 'postgres') as 'postgres' | 'sqlite';

export const ENV = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    dbType === 'postgres'
      ? required(process.env.DATABASE_URL, 'DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/pomofocus')
      : undefined,
  sqlitePath: process.env.SQLITE_PATH ?? ':memory:',
  dbType,
  redisUrl: required(process.env.REDIS_URL, 'REDIS_URL', 'redis://localhost:6379'),
  bullQueuePrefix: process.env.BULLMQ_PREFIX ?? 'pomofocus',
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET', 'dev-secret'),
};
