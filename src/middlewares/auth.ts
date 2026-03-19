import { NextFunction, Request, Response } from 'express';
import { getRequestContext } from '../infra/requestContext.js';
import { decodeAuthToken } from '../infra/authClient.js';

export type AuthUser = { id: string; email?: string; ethAddress?: string };

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
  decodeAuthToken(token)
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
