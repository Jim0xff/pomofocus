import { Router } from 'express';
import { AppDataSource } from '../infra/datasource.js';
import { verifyRedis } from '../infra/redis.js';

export const healthRouter = Router();

healthRouter.get('/healthz', async (_req, res) => {
  await AppDataSource.query('SELECT 1');
  await verifyRedis();
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
