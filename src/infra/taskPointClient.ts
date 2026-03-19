import axios from 'axios';
import { HttpError } from '../middlewares/errorHandler.js';
import { ENV } from '../config/env.js';

export type TaskPointUser = {
  id: string;
  name?: string;
  ethAddress: string;
};

const isEthAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const taskPointPost = async <T>(path: string, payload: Record<string, unknown>) => {
  if (!ENV.taskPointUrl) {
    throw new HttpError(500, 'TASK_POINT_URL not configured');
  }
  const url = `${ENV.taskPointUrl}${path}`;
  const { data } = await axios.post<T>(url, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return data;
};

export const decodeToken = async (token: string) => {
  if (ENV.testAuth && isEthAddress(token)) {
    const lower = token.toLowerCase();
    return { id: lower, name: `test-${lower.slice(-4)}`, ethAddress: lower, token };
  }

  try {
    const { userInfo } = (await taskPointPost<{ userInfo: TaskPointUser }>('/user/decodeToken', { token })) ?? {};
    if (!userInfo?.id || !userInfo.ethAddress) {
      throw new HttpError(401, 'Invalid token');
    }
    return { ...userInfo, ethAddress: userInfo.ethAddress.toLowerCase(), token };
  } catch (error) {
    throw new HttpError(401, 'Invalid token', error instanceof Error ? { message: error.message } : undefined);
  }
};
