import { Router } from 'express';
import { requireUser } from '../utils/auth.js';
import { archiveTask, completeTaskAction, createTask, getTaskById, listTasks, updateTask } from '../services/task.service.js';
import type { TaskPriority, TaskStatus } from '../entities/task.entity.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tasksRouter = Router();

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const status = req.query.status ? (req.query.status as TaskStatus) : undefined;
    const tasks = await listTasks(user.id, status);
    res.json({ data: tasks });
  })
);

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const payload = {
      title: req.body.title,
      note: req.body.note,
      estimatedPomodoros: Number(req.body.estimatedPomodoros ?? 1),
      priority: req.body.priority as TaskPriority | undefined,
    };
    const task = await createTask(user.id, payload);
    res.status(201).json({ data: task });
  })
);

tasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const task = await getTaskById(user.id, req.params.id);
    res.json({ data: task });
  })
);

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const task = await updateTask(user.id, req.params.id, req.body);
    res.json({ data: task });
  })
);

tasksRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const task = await archiveTask(user.id, req.params.id);
    res.json({ data: task });
  })
);

tasksRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const task = await completeTaskAction(user.id, req.params.id);
    res.json({ data: task });
  })
);
