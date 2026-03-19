import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../src/server.ts';
import { AppDataSource } from '../src/infra/datasource.ts';
import { TaskEntity } from '../src/entities/task.entity.ts';
import { TimerSessionEntity } from '../src/entities/timer-session.entity.ts';

const TEST_TOKEN = process.env.E2E_AUTH_TOKEN ?? '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const authHeaders = { Authorization: `Bearer ${TEST_TOKEN}` };

const graphRequest = (app: Application, query: string, variables?: Record<string, unknown>) =>
  request(app)
    .post('/api/v1/graphql')
    .set(authHeaders)
    .send({ query, variables });

describe('GraphQL mutations', () => {
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
    await AppDataSource.getRepository(TimerSessionEntity).clear();
  });

  it('runs timer lifecycle mutations (start → pause → resume → cancel)', async () => {
    const createTaskMutation = `mutation($input: TaskInput!){ createTask(input: $input){ id title } }`;
    const created = await graphRequest(app, createTaskMutation, {
      input: { title: 'gql-timer', estimatedPomodoros: 2 },
    });
    expect(created.status).toBe(200);
    const taskId = created.body.data.createTask.id as string;

    const startMutation = `mutation($input: StartTimerInput!){ startTimer(input: $input){ id status taskId } }`;
    const startRes = await graphRequest(app, startMutation, {
      input: { taskId, phase: 'FOCUS', durationSeconds: 900 },
    });
    expect(startRes.status).toBe(200);
    const sessionId = startRes.body.data.startTimer.id as string;

    const pauseMutation = `mutation($id: ID!){ pauseTimer(id: $id){ id status } }`;
    const pauseRes = await graphRequest(app, pauseMutation, { id: sessionId });
    expect(pauseRes.body.data.pauseTimer.status).toBe('PAUSED');

    const resumeMutation = `mutation($id: ID!){ resumeTimer(id: $id){ id status } }`;
    const resumeRes = await graphRequest(app, resumeMutation, { id: sessionId });
    expect(resumeRes.body.data.resumeTimer.status).toBe('RUNNING');

    const cancelMutation = `mutation($id: ID!){ cancelTimer(id: $id){ id status } }`;
    const cancelRes = await graphRequest(app, cancelMutation, { id: sessionId });
    expect(cancelRes.body.data.cancelTimer.status).toBe('CANCELLED');
  });

  it('completes task and skip break via GraphQL mutations', async () => {
    const createTaskMutation = `mutation($input: TaskInput!){ createTask(input: $input){ id } }`;
    const created = await graphRequest(app, createTaskMutation, {
      input: { title: 'gql-complete', estimatedPomodoros: 1 },
    });
    const taskId = created.body.data.createTask.id as string;

    const startBreak = await graphRequest(
      app,
      `mutation($input: StartTimerInput!){ startTimer(input: $input){ id status } }`,
      { input: { taskId, phase: 'SHORT_BREAK', durationSeconds: 300 } }
    );
    const breakSession = startBreak.body.data.startTimer.id as string;

    const skipBreakMutation = `mutation($id: ID!){ skipBreak(id: $id){ id status } }`;
    const skipRes = await graphRequest(app, skipBreakMutation, { id: breakSession });
    expect(skipRes.body.data.skipBreak.status).toBe('COMPLETED');

    const completeTaskMutation = `mutation($id: ID!){ completeTask(id: $id){ id status } }`;
    const completeTaskRes = await graphRequest(app, completeTaskMutation, { id: taskId });
    expect(completeTaskRes.body.data.completeTask.status).toBe('DONE');
  });
});
