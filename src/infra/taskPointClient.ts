import { HttpError } from '../middlewares/errorHandler.js';
import { ENV } from '../config/env.js';
import { getRequestContext } from './requestContext.js';
import { logger } from './logger.js';

export type TaskPointUser = {
  id: string;
  name?: string;
  ethAddress: string;
};

const isEthAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const objectToQueryParams = (params?: Record<string, unknown>) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
};

export const taskPointGet = async <T>(uri: string, params?: Record<string, unknown>, headers?: Record<string, string> | null, needAuth = false) => {
  if (!ENV.taskPointUrl) {
    throw new HttpError(500, 'TASK_POINT_URL not configured');
  }

  logger.info('%s params: %j', uri, params ?? {});
  const ctx = getRequestContext();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-server-call': 'true',
    ...(headers ?? {}),
  };
  if (ctx?.requestId) {
    requestHeaders.traceId = ctx.requestId;
  }
  if (needAuth && ctx?.req?.headers.authorization) {
    requestHeaders.Authorization = ctx.req.headers.authorization as string;
  }

  const query = objectToQueryParams(params);
  const response = await fetch(`${ENV.taskPointUrl}${uri}${query}`, {
    method: 'GET',
    headers: requestHeaders,
  });
  const data = await response.json();
  logger.info('%s result: %j', uri, data);
  if (data?.code !== 200) {
    if (data?.code === 401) {
      throw new HttpError(401, 'Invalid token');
    }
    throw new HttpError(502, `${uri} biz error`, { code: data?.code });
  }
  return data.data as T;
};

export const decodeToken = async (token: string) => {
  if (ENV.testAuth && isEthAddress(token)) {
    const lower = token.toLowerCase();
    return { id: lower, name: `test-${lower.slice(-4)}`, ethAddress: lower, token };
  }

  const payload = await taskPointGet<{ exp: number; userInfo: TaskPointUser }>('/user/decodeToken', { token }, null, true);
  if (!payload?.userInfo?.id) {
    throw new HttpError(401, 'Invalid token');
  }
  const normalized = { ...payload.userInfo, ethAddress: payload.userInfo.ethAddress.toLowerCase(), token };
  return normalized;
};
