import { AppDataSource } from '../infra/datasource.js';
import { UserSettingsEntity } from '../entities/user-settings.entity.js';
import { parseSettingsInput } from '../validation/settings.js';
import { auditLog } from '../infra/audit.js';

const repo = () => AppDataSource.getRepository(UserSettingsEntity);

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  alarmSound: 'classic',
  backgroundSound: 'none',
  volume: 80,
  options: null as Record<string, unknown> | null,
};

export const getSettings = async (userId: string) => {
  const existing = await repo().findOne({ where: { userId } });
  if (existing) {
    return existing;
  }
  const created = repo().create({ userId, ...DEFAULT_SETTINGS });
  return repo().save(created);
};

export const updateSettings = async (userId: string, input: unknown) => {
  const payload = parseSettingsInput(input);
  const current = await getSettings(userId);
  Object.assign(current, payload);
  const saved = await repo().save(current);
  auditLog('SETTINGS_UPDATE', userId, payload);
  return saved;
};
