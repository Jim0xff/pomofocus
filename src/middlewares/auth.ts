import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { getRequestContext } from '../infra/requestContext.js';

export type AuthUser = { id: string };

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
  try {
    const payload = jwt.verify(token, ENV.jwtSecret) as AuthUser;
    req.user = payload;
    const ctx = getRequestContext();
    if (ctx) {
      ctx.user = payload;
    }
  } catch (err) {
    return next(err);
  }
  next();
};
