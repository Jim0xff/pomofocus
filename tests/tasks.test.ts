import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../src/server.ts';
import { AppDataSource } from '../src/infra/datasource.ts';
import { TaskEntity } from '../src/entities/task.entity.ts';
import { UserSettingsEntity } from '../src/entities/user-settings.entity.ts';
import { TimerSessionEntity } from '../src/entities/timer-session.entity.ts';

const TEST_TOKEN = process.env.E2E_AUTH_TOKEN ?? '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const signToken = () => TEST_TOKEN;

const createTask = async (app: Application, token: string, title = 'Task for timer') => {
  const res = await request(app)
    .post('/api/v1/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, estimatedPomodoros: 1 });
  return res.body.data.id as string;
};

describe('Task & Settings APIs', () => {
  let app: Application;
  let server: import('http').Server;

  beforeAll(async () => {
    const created = await createServer();
    app = created.app;
    server = created.httpServer;
  });

  afterAll(async () => {
    await AppDataSource.destroy();
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(TaskEntity).clear();
    await AppDataSource.getRepository(UserSettingsEntity).clear();
    await AppDataSource.getRepository(TimerSessionEntity).clear();
  });

  it('rejects unauthenticated task creation', async () => {
    const response = await request(app).post('/api/v1/tasks').send({ title: 'Sample', estimatedPomodoros: 2 });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/Unauthorized/i);
  });

  it('creates and lists tasks', async () => {
    const token = signToken();
    const createRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Write tests', estimatedPomodoros: 3 });
    expect(createRes.status).toBe(201);
    const listRes = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].title).toBe('Write tests');
  });

  it('updates settings', async () => {
    const token = signToken();
    const updateRes = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ focusMinutes: 30, volume: 50 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.focusMinutes).toBe(30);
    expect(updateRes.body.data.volume).toBe(50);
  });

  it('prevents starting concurrent timers', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'first');
    await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    const secondTaskId = await createTask(app, token, 'second');
    const secondStart = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId: secondTaskId });
    expect(secondStart.status).toBe(409);
  });

  it('starts and completes a timer session', async () => {
    const token = signToken();
    const taskId = await createTask(app, token);
    const startRes = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    expect(startRes.status).toBe(201);
    expect(startRes.body.data.remainingSeconds).toBeGreaterThan(0);
    const etaRes = await request(app).get('/api/v1/timer/eta').set('Authorization', `Bearer ${token}`);
    expect(etaRes.status).toBe(200);
    expect(etaRes.body.data.remainingSeconds).toBeGreaterThan(0);
    const timerId = startRes.body.data.id as string;
    const completeRes = await request(app)
      .post(`/api/v1/timer/${timerId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');
    const { statsQueue } = await import('../src/infra/bullmq.js');
    expect(statsQueue.add).toHaveBeenCalledWith(
      'timer_completed',
      expect.objectContaining({ sessionId: timerId }),
      expect.any(Object)
    );
    const statsRes = await request(app)
      .get('/api/v1/stats/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.focusSessions).toBeGreaterThanOrEqual(1);
    const dailyRes = await request(app)
      .get('/api/v1/stats/daily?days=3')
      .set('Authorization', `Bearer ${token}`);
    expect(dailyRes.status).toBe(200);
    expect(dailyRes.body.data.length).toBe(3);
    const weeklyRes = await request(app)
      .get('/api/v1/stats/weekly')
      .set('Authorization', `Bearer ${token}`);
    expect(weeklyRes.status).toBe(200);
    expect(weeklyRes.body.data.focusSessions).toBeGreaterThanOrEqual(1);
    const sessionsRes = await request(app)
      .get('/api/v1/timer/sessions?limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects timer start without a valid task', async () => {
    const token = signToken();
    const res = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId: 'fake-task' });
    expect(res.status).toBe(400);
  });

  it('blocks risky task edits when timer running', async () => {
    const token = signToken();
    const taskId = await createTask(app, token);
    const startRes = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    expect(startRes.status).toBe(201);
    const updateRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' });
    expect(updateRes.status).toBe(409);
    const noteRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'only note allowed' });
    expect(noteRes.status).toBe(200);
  });

  it('blocks archiving task with running timer', async () => {
    const token = signToken();
    const taskId = await createTask(app, token);
    await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('pauses, resumes, and cancels a timer via REST', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'pause-flow');
    const startRes = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    const sessionId = startRes.body.data.id as string;

    const pauseRes = await request(app)
      .post(`/api/v1/timer/${sessionId}/pause`)
      .set('Authorization', `Bearer ${token}`);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('PAUSED');

    const resumeRes = await request(app)
      .post(`/api/v1/timer/${sessionId}/resume`)
      .set('Authorization', `Bearer ${token}`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.status).toBe('RUNNING');

    const cancelRes = await request(app)
      .post(`/api/v1/timer/${sessionId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  it('completes a task via REST', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'complete-me');
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
  });

  it('skips break sessions via REST', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'break-me');
    const startBreak = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'SHORT_BREAK', durationSeconds: 300, taskId });
    expect(startBreak.status).toBe(201);
    const skipRes = await request(app)
      .post(`/api/v1/timer/${startBreak.body.data.id}/skip-break`)
      .set('Authorization', `Bearer ${token}`);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.data.status).toBe('COMPLETED');
  });

  it('serves timer ETA from cache when subsequent calls happen within TTL', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'eta-cache');
    const startRes = await request(app)
      .post('/api/v1/timer/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'FOCUS', durationSeconds: 1500, taskId });
    const sessionId = startRes.body.data.id as string;

    const firstEta = await request(app)
      .get('/api/v1/timer/eta')
      .set('Authorization', `Bearer ${token}`);
    expect(firstEta.status).toBe(200);
    expect(firstEta.body.data.sessionId).toBe(sessionId);

    await AppDataSource.getRepository(TimerSessionEntity).update({ id: sessionId }, { status: 'COMPLETED' });

    const secondEta = await request(app)
      .get('/api/v1/timer/eta')
      .set('Authorization', `Bearer ${token}`);
    expect(secondEta.status).toBe(200);
    expect(secondEta.body.data.sessionId).toBe(sessionId);
  });

  it('serves GraphQL task query', async () => {
    const token = signToken();
    const taskId = await createTask(app, token, 'graphql');
    const query = `query($id: ID!){ task(id: $id){ id title } weeklySummary { weekStart focusSessions } }`;
    const res = await request(app)
      .post('/api/v1/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables: { id: taskId } });
    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe(taskId);
  });
});
