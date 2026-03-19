import { Router } from 'express';
import { requireUser } from '../utils/auth.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const settings = await getSettings(user.id);
    res.json({ data: settings });
  })
);

settingsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const settings = await updateSettings(user.id, req.body);
    res.json({ data: settings });
  })
);
