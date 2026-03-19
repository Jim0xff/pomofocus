import { AppDataSource } from '../infra/datasource.js';
import { TaskEntity, TaskPriority, TaskStatus } from '../entities/task.entity.js';
import { Not } from 'typeorm';
import { HttpError } from '../middlewares/errorHandler.js';
import { parseTaskInput, parseTaskUpdate } from '../validation/task.js';
import { auditLog } from '../infra/audit.js';
import { TimerSessionEntity } from '../entities/timer-session.entity.js';

export type TaskInput = {
  title: string;
  note?: string | null;
  estimatedPomodoros: number;
  priority?: TaskPriority;
};

export type TaskUpdateInput = Partial<Omit<TaskInput, 'estimatedPomodoros'>> & {
  estimatedPomodoros?: number;
  status?: Extract<TaskStatus, 'PENDING' | 'ACTIVE' | 'DONE'>;
};

const repo = () => AppDataSource.getRepository(TaskEntity);
const timerRepo = () => AppDataSource.getRepository(TimerSessionEntity);

const activeTaskWhere = (userId: string, id?: string) => ({
  userId,
  ...(id ? { id } : {}),
  status: Not<TaskStatus>('ARCHIVED'),
});

const hasRunningTimerForTask = async (userId: string, taskId: string) => {
  return timerRepo().exist({ where: { userId, taskId, status: 'RUNNING' } });
};

export const listTasks = async (userId: string, status?: TaskStatus) => {
  return repo().find({
    where: status ? { userId, status } : activeTaskWhere(userId),
    order: { createdAt: 'DESC' },
  });
};

export const getTaskById = async (userId: string, id: string) => {
  return repo().findOne({ where: { userId, id } });
};

export const createTask = async (userId: string, input: unknown) => {
  const payload = parseTaskInput(input);
  const entity = repo().create({
    userId,
    title: payload.title,
    note: payload.note ?? null,
    estimatedPomodoros: payload.estimatedPomodoros,
    priority: (payload.priority ?? 'NORMAL') as TaskPriority,
  });
  const saved = await repo().save(entity);
  auditLog('TASK_CREATE', userId, { id: saved.id, title: saved.title });
  return saved;
};

export const updateTask = async (userId: string, id: string, input: unknown) => {
  const payload = parseTaskUpdate(input);
  const entity = await repo().findOne({ where: activeTaskWhere(userId, id) });
  if (!entity) {
    throw new HttpError(404, 'Task not found');
  }
  const activeTimer = await hasRunningTimerForTask(userId, entity.id);
  if (activeTimer) {
    const forbiddenMutation = payload.title !== undefined || payload.estimatedPomodoros !== undefined || payload.status !== undefined;
    if (forbiddenMutation) {
      throw new HttpError(409, 'Task is in an active timer; only note/priority can change');
    }
  }
  if (payload.title !== undefined) entity.title = payload.title;
  if (payload.note !== undefined) entity.note = payload.note ?? null;
  if (payload.estimatedPomodoros !== undefined) entity.estimatedPomodoros = payload.estimatedPomodoros;
  if (payload.priority) entity.priority = payload.priority as TaskPriority;
  if (payload.status) {
    if (payload.status === 'ARCHIVED') {
      throw new HttpError(400, 'Use archiveTask for soft delete');
    }
    entity.status = payload.status as TaskStatus;
    if (payload.status === 'DONE') {
      entity.completedAt = new Date();
    }
  }
  const saved = await repo().save(entity);
  auditLog('TASK_UPDATE', userId, { id: saved.id, status: saved.status, priority: saved.priority });
  return saved;
};

export const archiveTask = async (userId: string, id: string) => {
  const entity = await repo().findOne({ where: activeTaskWhere(userId, id) });
  if (!entity) {
    throw new HttpError(404, 'Task not found');
  }
  const activeTimer = await hasRunningTimerForTask(userId, entity.id);
  if (activeTimer) {
    throw new HttpError(409, 'Cannot archive task with active timer');
  }
  entity.status = 'ARCHIVED';
  const saved = await repo().save(entity);
  auditLog('TASK_ARCHIVE', userId, { id: saved.id });
  return saved;
};

export const completeTaskAction = async (userId: string, id: string) => {
  const entity = await repo().findOne({ where: activeTaskWhere(userId, id) });
  if (!entity) {
    throw new HttpError(404, 'Task not found');
  }
  entity.status = 'DONE';
  entity.completedAt = new Date();
  const saved = await repo().save(entity);
  auditLog('TASK_UPDATE', userId, { id: saved.id, status: saved.status });
  return saved;
};
