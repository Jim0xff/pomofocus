import 'reflect-metadata';
import http from 'http';
import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { GraphQLError } from 'graphql';
import { ZodError } from 'zod';
import { logger } from './infra/logger.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { authMiddleware } from './middlewares/auth.js';
import { errorHandler, HttpError } from './middlewares/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { tasksRouter } from './routes/tasks.js';
import { settingsRouter } from './routes/settings.js';
import { timerRouter } from './routes/timer.js';
import { statsRouter } from './routes/stats.js';
import { initializeDatabase } from './infra/datasource.js';
import { typeDefs, resolvers } from './graphql/schema.js';
import { verifyRedis } from './infra/redis.js';
import { statsQueue, timerQueue } from './infra/bullmq.js';
import { getRequestContext } from './infra/requestContext.js';

export const createServer = async () => {
  await initializeDatabase();
  logger.info('Postgres connected');
  await verifyRedis();
  logger.info('Redis connected');
  await statsQueue.waitUntilReady();
  await timerQueue.waitUntilReady();
  logger.info('BullMQ ready');

  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (formattedError, error: GraphQLError) => {
      const requestId = getRequestContext()?.requestId;
      let code = formattedError.extensions?.code ?? 'INTERNAL_SERVER_ERROR';
      let details: unknown;
      const original = error.originalError;
      if (original instanceof HttpError) {
        code = `HTTP_${original.status}`;
        details = original.details;
      } else if (original instanceof ZodError) {
        code = 'VALIDATION_ERROR';
        details = original.errors;
      }
      return {
        message: formattedError.message,
        locations: formattedError.locations,
        path: formattedError.path,
        extensions: {
          ...formattedError.extensions,
          code,
          requestId,
          details,
        },
      };
    },
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(requestIdMiddleware);
  app.use(cors());
  app.use(helmet());
  app.use(express.json());
  app.use(authMiddleware);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/timer', timerRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use(
    '/api/v1/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => ({ user: (req as Request).user }),
    })
  );

  app.use(errorHandler);

  return { app, httpServer, apolloServer: server };
};
