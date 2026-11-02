export { parse } from '../../shared/pipes/zod-parse.js';

export type AuthedRequest = {
  user: { sub: string; role?: 'USER' | 'CREATOR' | 'ADMIN' };
  ip?: string;
};
export type OptionalAuthedRequest = Omit<AuthedRequest, 'user'> & {
  user?: AuthedRequest['user'];
};
