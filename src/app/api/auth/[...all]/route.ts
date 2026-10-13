import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/libs/auth/auth';

export const { GET, POST } = toNextJsHandler(auth.handler);
