import { logger } from './logger.js';

export type AuditAction =
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'TASK_ARCHIVE'
  | 'SETTINGS_UPDATE'
  | 'TIMER_START'
  | 'TIMER_PAUSE'
  | 'TIMER_RESUME'
  | 'TIMER_COMPLETE'
  | 'TIMER_CANCEL';

export const auditLog = (action: AuditAction, userId: string, payload: unknown) => {
  logger.info('audit', { action, userId, payload });
};
