import { z } from 'zod';

const TASK_STATUS_VALUES = ['PENDING', 'ACTIVE', 'DONE', 'ARCHIVED'] as const;
const TASK_PRIORITY_VALUES = ['LOW', 'NORMAL', 'HIGH'] as const;

type TaskStatusEnum = typeof TASK_STATUS_VALUES[number];
type TaskPriorityEnum = typeof TASK_PRIORITY_VALUES[number];

const BaseTaskSchema = z.object({
  title: z.string().min(1).max(160),
  note: z.string().max(2000).optional().nullable(),
  estimatedPomodoros: z.coerce.number().int().min(1).max(48),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
});

const TaskUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  note: z.string().max(2000).optional().nullable(),
  estimatedPomodoros: z.coerce.number().int().min(1).max(48).optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
});

export const parseTaskInput = (raw: unknown) => BaseTaskSchema.parse(raw) as {
  title: string;
  note?: string | null;
  estimatedPomodoros: number;
  priority?: TaskPriorityEnum;
};

export const parseTaskUpdate = (raw: unknown) => TaskUpdateSchema.parse(raw) as {
  title?: string;
  note?: string | null;
  estimatedPomodoros?: number;
  priority?: TaskPriorityEnum;
  status?: TaskStatusEnum;
};
