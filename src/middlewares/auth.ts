import { NextFunction, Request, Response } from 'express';
import { getRequestContext } from '../infra/requestContext.js';
import { decodeToken } from '../infra/taskPointClient.js';

export type AuthUser = { id: string; name?: string; ethAddress?: string; token?: string };

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return next();
  }
  const token = header.replace('Bearer ', '');
  decodeToken(token)
    .then((payload) => {
      req.user = payload;
      const ctx = getRequestContext();
      if (ctx) {
        ctx.user = payload;
      }
      next();
    })
    .catch((err) => next(err));
};
