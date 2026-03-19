import { ENV } from '../config/env.js';
import { HttpError } from '../middlewares/errorHandler.js';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type TaskPointUser = {
  id: string;
  name?: string;
  ethAddress: string;
};

export type DecodedUser = TaskPointUser & { token?: string };

export const decodeToken = async (token: string): Promise<DecodedUser> => {
  if (ENV.testAuth && ETH_ADDRESS_REGEX.test(token)) {
    const lower = token.toLowerCase();
    return { id: lower, name: `test-${lower.slice(-4)}`, ethAddress: lower, token };
  }

  if (!ENV.taskPointUrl) {
    throw new HttpError(500, 'TASK_POINT_URL is not configured; enable TEST_AUTH for local runs');
  }

  const response = await fetch(`${ENV.taskPointUrl}/user/decodeToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new HttpError(401, 'Invalid authentication token');
  }

  const { userInfo } = (await response.json()) as { userInfo: TaskPointUser };
  if (!userInfo?.id || !userInfo.ethAddress) {
    throw new HttpError(401, 'Malformed auth payload');
  }

  return { ...userInfo, ethAddress: userInfo.ethAddress.toLowerCase(), token };
};
