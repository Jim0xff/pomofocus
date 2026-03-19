import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = ':memory:';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.TEST_AUTH = 'true';
process.env.TASK_POINT_URL = '';

const redisStore = new Map<string, string>();

jest.mock('../src/infra/redis.ts', () => ({
  verifyRedis: jest.fn().mockResolvedValue(undefined as never),
  redis: {
    ping: jest.fn(),
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      const flags = args.map(String);
      if (flags.includes('NX') && redisStore.has(key)) {
        return null;
      }
      redisStore.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
    eval: jest.fn(async (_script: string, _keys: number, key: string, token: string) => {
      if (redisStore.get(key) === token) {
        redisStore.delete(key);
        return 1;
      }
      return 0;
    }),
  },
}));

jest.mock('../src/infra/bullmq.ts', () => ({
  statsQueue: {
    waitUntilReady: jest.fn().mockResolvedValue(undefined as never),
    add: jest.fn().mockResolvedValue(undefined as never),
  },
  timerQueue: {
    waitUntilReady: jest.fn().mockResolvedValue(undefined as never),
    add: jest.fn().mockResolvedValue(undefined as never),
    remove: jest.fn().mockResolvedValue(undefined as never),
  },
}));
