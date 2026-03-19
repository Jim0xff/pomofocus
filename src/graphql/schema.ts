import { gql } from 'graphql-tag';
import { GraphQLScalarType, Kind } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import dayjs from 'dayjs';
import type { GraphQLContext } from './context.js';
import { archiveTask, createTask, listTasks, updateTask } from '../services/task.service.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import type { TaskPriority, TaskStatus } from '../entities/task.entity.js';
import { HttpError } from '../middlewares/errorHandler.js';
import {
  activeTimer,
  cancelTimer,
  completeTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  getTimerEta,
  getRecentSessions,
  skipBreak,
} from '../services/timer.service.js';
import { getStatsSummary, getDailyStatsSeries, getWeeklySummary } from '../services/stats.service.js';
import { getTaskById, completeTaskAction } from '../services/task.service.js';
import type { TimerPhase } from '../entities/timer-session.entity.js';
import { TimerSessionEntity } from '../entities/timer-session.entity.js';
import { getRemainingSeconds } from '../services/timer.service.js';

export const typeDefs = gql`
  scalar Timestamp
  scalar JSON

  enum TaskStatus {
    PENDING
    ACTIVE
    DONE
    ARCHIVED
  }

  enum TaskPriority {
    LOW
    NORMAL
    HIGH
  }

  type Task {
    """任务 ID（示例：1286）""" id: ID!
    """任务标题（示例：撰写周报）""" title: String!
    """备注""" note: String
    """状态：PENDING/ACTIVE/DONE/ARCHIVED""" status: TaskStatus!
    """优先级""" priority: TaskPriority!
    """预计番茄数""" estimatedPomodoros: Int!
    """已完成番茄数""" actualPomodoros: Int!
    """完成时间""" completedAt: Timestamp
    createdAt: Timestamp!
    updatedAt: Timestamp!
  }

  input TaskInput {
    title: String!
    note: String
    estimatedPomodoros: Int!
    priority: TaskPriority
  }

  input TaskUpdateInput {
    title: String
    note: String
    estimatedPomodoros: Int
    priority: TaskPriority
    status: TaskStatus
  }

  type UserSettings {
    focusMinutes: Int!
    shortBreakMinutes: Int!
    longBreakMinutes: Int!
    longBreakInterval: Int!
    alarmSound: String!
    backgroundSound: String!
    volume: Int!
    options: JSON
    updatedAt: Timestamp!
  }

  input SettingsInput {
    focusMinutes: Int
    shortBreakMinutes: Int
    longBreakMinutes: Int
    longBreakInterval: Int
    alarmSound: String
    backgroundSound: String
    volume: Int
    options: JSON
  }

  enum TimerPhase {
    FOCUS
    SHORT_BREAK
    LONG_BREAK
  }

  enum TimerStatus {
    RUNNING
    PAUSED
    COMPLETED
    CANCELLED
  }

  type TimerSession {
    id: ID!
    phase: TimerPhase!
    status: TimerStatus!
    taskId: ID
    plannedDurationSeconds: Int!
    elapsedSeconds: Int!
    remainingSeconds: Int!
    startedAt: Timestamp
    pausedAt: Timestamp
    completedAt: Timestamp
  }

  input StartTimerInput {
    phase: TimerPhase!
    durationSeconds: Int!
    taskId: ID!
  }

  type TimerStatsSummary {
    focusSessions: Int!
    focusSeconds: Int!
    breakSeconds: Int!
  }

  type TimerEta {
    sessionId: ID!
    remainingSeconds: Int!
    estimatedEndTime: Timestamp!
  }

  type DailyStatPoint {
    statDate: String!
    focusSessions: Int!
    focusSeconds: Int!
    breakSeconds: Int!
  }

  type WeeklySummary {
    weekStart: String!
    focusSessions: Int!
    focusSeconds: Int!
    breakSeconds: Int!
  }

  type Query {
    tasks(status: TaskStatus): [Task!]!
    task(id: ID!): Task
    userSettings: UserSettings!
    activeTimer: TimerSession
    recentSessions(limit: Int): [TimerSession!]!
    timerEta: TimerEta
    timerStats(rangeStart: String, rangeEnd: String): TimerStatsSummary!
    timerStatsSeries(days: Int): [DailyStatPoint!]!
    dailySummary(rangeStart: String, rangeEnd: String): [DailyStatPoint!]!
    weeklySummary(weekStart: String): WeeklySummary!
  }

  type Mutation {
    createTask(input: TaskInput!): Task!
    updateTask(id: ID!, input: TaskUpdateInput!): Task!
    archiveTask(id: ID!): Task!
    completeTask(id: ID!): Task!
    updateSettings(input: SettingsInput!): UserSettings!
    startTimer(input: StartTimerInput!): TimerSession!
    pauseTimer(id: ID!): TimerSession!
    resumeTimer(id: ID!): TimerSession!
    completeTimer(id: ID!): TimerSession!
    cancelTimer(id: ID!): TimerSession!
    skipBreak(id: ID!): TimerSession!
  }
`;

const TimestampScalar = new GraphQLScalarType({
  name: 'Timestamp',
  serialize(value: unknown) {
    return new Date(value as string | number | Date).toISOString();
  },
  parseValue(value) {
    return new Date(value as string);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const requireUser = (ctx: GraphQLContext) => {
  if (!ctx.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return ctx.user;
};

export const resolvers = {
  Timestamp: TimestampScalar,
  JSON: GraphQLJSON,
  Query: {
    tasks: async (_: unknown, args: { status?: TaskStatus }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return listTasks(user.id, args.status);
    },
    task: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getTaskById(user.id, args.id);
    },
    userSettings: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getSettings(user.id);
    },
    activeTimer: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return activeTimer(user.id);
    },
    recentSessions: async (_: unknown, args: { limit?: number }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getRecentSessions(user.id, args.limit ?? 10);
    },
    timerEta: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getTimerEta(user.id);
    },
    timerStats: async (_: unknown, args: { rangeStart?: string; rangeEnd?: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getStatsSummary(user.id, args.rangeStart, args.rangeEnd);
    },
    timerStatsSeries: async (_: unknown, args: { days?: number }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getDailyStatsSeries(user.id, args.days ?? 7);
    },
    dailySummary: async (_: unknown, args: { rangeStart?: string; rangeEnd?: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      if (args.rangeStart && args.rangeEnd) {
        const start = dayjs(args.rangeStart);
        const end = dayjs(args.rangeEnd);
        const days = Math.max(1, end.diff(start, 'day') + 1);
        return getDailyStatsSeries(user.id, days, start.format('YYYY-MM-DD'));
      }
      return getDailyStatsSeries(user.id, 7);
    },
    weeklySummary: async (_: unknown, args: { weekStart?: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return getWeeklySummary(user.id, args.weekStart);
    },
  },
  Mutation: {
    createTask: async (_: unknown, { input }: { input: { title: string; note?: string | null; estimatedPomodoros: number; priority?: TaskPriority } }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return createTask(user.id, input);
    },
    updateTask: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return updateTask(user.id, id, input);
    },
    archiveTask: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return archiveTask(user.id, id);
    },
    completeTask: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return completeTaskAction(user.id, id);
    },
    updateSettings: async (_: unknown, { input }: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return updateSettings(user.id, input);
    },
    startTimer: async (_: unknown, { input }: { input: { phase: TimerPhase; durationSeconds: number; taskId: string } }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return startTimer(user.id, input);
    },
    pauseTimer: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return pauseTimer(user.id, id);
    },
    resumeTimer: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return resumeTimer(user.id, id);
    },
    completeTimer: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return completeTimer(user.id, id);
    },
    cancelTimer: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return cancelTimer(user.id, id);
    },
    skipBreak: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return skipBreak(user.id, id);
    },
  },
  TimerSession: {
    remainingSeconds: (parent: TimerSessionEntity) => getRemainingSeconds(parent),
  },
};
