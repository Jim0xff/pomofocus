import { Router } from 'express';
import { requireUser } from '../utils/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  cancelTimer,
  completeTimer,
  getTimerEta,
  pauseTimer,
  resumeTimer,
  startTimer,
  presentTimerSession,
  getRecentSessions,
  skipBreak,
} from '../services/timer.service.js';
import type { TimerPhase } from '../entities/timer-session.entity.js';

export const timerRouter = Router();

timerRouter.get(
  '/eta',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const eta = await getTimerEta(user.id);
    res.json({ data: eta });
  })
);

timerRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const sessions = await getRecentSessions(user.id, limit);
    res.json({ data: sessions.map(presentTimerSession) });
  })
);

timerRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await startTimer(user.id, {
      phase: req.body.phase as TimerPhase,
      durationSeconds: Number(req.body.durationSeconds),
      taskId: req.body.taskId,
    });
    res.status(201).json({ data: presentTimerSession(session) });
  })
);

timerRouter.post(
  '/:id/pause',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await pauseTimer(user.id, req.params.id);
    res.json({ data: presentTimerSession(session) });
  })
);

timerRouter.post(
  '/:id/resume',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await resumeTimer(user.id, req.params.id);
    res.json({ data: presentTimerSession(session) });
  })
);

timerRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await completeTimer(user.id, req.params.id);
    res.json({ data: presentTimerSession(session) });
  })
);

timerRouter.post(
  '/:id/skip-break',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await skipBreak(user.id, req.params.id);
    res.json({ data: presentTimerSession(session) });
  })
);

timerRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const session = await cancelTimer(user.id, req.params.id);
    res.json({ data: presentTimerSession(session) });
  })
);
