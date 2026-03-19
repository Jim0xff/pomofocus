import winston from 'winston';
import { ENV } from '../config/env.js';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, requestId }) => {
  const rid = requestId ? `[rid:${requestId}] ` : '';
  return `${timestamp} ${level}: ${rid}${message}`;
});

export const logger = winston.createLogger({
  level: ENV.nodeEnv === 'development' ? 'debug' : 'info',
  format: combine(timestamp(), logFormat),
  transports: [new winston.transports.Console({ format: combine(colorize(), timestamp(), logFormat) })],
});
