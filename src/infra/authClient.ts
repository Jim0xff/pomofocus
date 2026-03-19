import { ENV } from '../config/env.js';
import { HttpError } from '../middlewares/errorHandler.js';

export type ExternalUser = {
  id: string;
  email?: string;
  ethAddress?: string;
};

export const decodeAuthToken = async (token: string): Promise<ExternalUser> => {
  if (ENV.testAuth) {
    return { id: token, email: `${token}@dev.local` };
  }

  if (!ENV.authServiceUrl) {
    throw new HttpError(500, 'AUTH_SERVICE_URL is not configured');
  }

  const response = await fetch(`${ENV.authServiceUrl}/api/jwt/decode`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new HttpError(401, 'Invalid authorization token');
  }

  const payload = (await response.json()) as { userId?: string; email?: string; ethAddress?: string };
  if (!payload.userId) {
    throw new HttpError(401, 'Invalid authorization payload');
  }

  return { id: payload.userId, email: payload.email, ethAddress: payload.ethAddress };
};
