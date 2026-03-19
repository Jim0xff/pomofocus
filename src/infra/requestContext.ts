import { AsyncLocalStorage } from 'async_hooks';
import type { Request } from 'express';

export type RequestContext = {
  requestId: string;
  req: Request;
  user?: { id: string };
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const withRequestContext = <T>(ctx: RequestContext, fn: () => T) => {
  return requestContext.run(ctx, fn);
};

export const getRequestContext = () => requestContext.getStore();
