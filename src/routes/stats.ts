import { Router } from 'express';
import { requireUser } from '../utils/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDailyStatsSeries, getStatsSummary, getWeeklySummary } from '../services/stats.service.js';

export const statsRouter = Router();

statsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const stats = await getStatsSummary(user.id, req.query.rangeStart as string | undefined, req.query.rangeEnd as string | undefined);
    res.json({ data: stats });
  })
);

statsRouter.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const days = req.query.days ? Number(req.query.days) : undefined;
    const data = await getDailyStatsSeries(user.id, days ?? 7);
    res.json({ data });
  })
);

statsRouter.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const summary = await getWeeklySummary(user.id, req.query.weekStart as string | undefined);
    res.json({ data: summary });
  })
);
