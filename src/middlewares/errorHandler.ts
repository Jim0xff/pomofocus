import { NextFunction, Request, Response } from 'express';
import { logger } from '../infra/logger.js';
import { getRequestContext } from '../infra/requestContext.js';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = getRequestContext()?.requestId;
  let status = 500;
  let payload: unknown;

  if (err instanceof HttpError) {
    status = err.status;
    payload = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    payload = err.errors;
  }

  logger.error(`request failed (${status}): ${err.message}`, { requestId, stack: err.stack });
  res.status(status).json({ requestId, error: { message: err.message, details: payload } });
};
