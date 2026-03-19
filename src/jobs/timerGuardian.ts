import { AppDataSource } from '../infra/datasource.js';
import { verifyRedis } from '../infra/redis.js';
import { logger } from '../infra/logger.js';
import { guardStaleTimers } from './guardianService.js';

const STALE_MINUTES = 5;

const runGuardian = async () => {
  await AppDataSource.initialize();
  await verifyRedis();
  await guardStaleTimers(STALE_MINUTES);
  await AppDataSource.destroy();
  logger.info('timer guardian finished');
};

runGuardian().catch((err) => {
  logger.error(`guardian job failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
