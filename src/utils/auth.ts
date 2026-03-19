import type { Request } from 'express';
import { UnauthorizedError } from '../middlewares/errorHandler.js';

export const requireUser = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
};
