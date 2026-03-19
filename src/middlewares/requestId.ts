import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { withRequestContext } from '../infra/requestContext.js';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  res.setHeader('x-request-id', requestId);
  withRequestContext({ requestId, req }, next);
};
