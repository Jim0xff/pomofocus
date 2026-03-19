import { z } from 'zod';

const SettingsSchema = z.object({
  focusMinutes: z.coerce.number().int().min(10).max(120).optional(),
  shortBreakMinutes: z.coerce.number().int().min(3).max(30).optional(),
  longBreakMinutes: z.coerce.number().int().min(10).max(60).optional(),
  longBreakInterval: z.coerce.number().int().min(2).max(12).optional(),
  alarmSound: z.string().max(32).optional(),
  backgroundSound: z.string().max(32).optional(),
  volume: z.coerce.number().int().min(0).max(100).optional(),
  options: z.record(z.any()).nullable().optional(),
});

export const parseSettingsInput = (raw: unknown) => SettingsSchema.parse(raw);
