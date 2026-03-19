import type { AuthUser } from '../middlewares/auth.js';

export type GraphQLContext = {
  user?: AuthUser;
};
