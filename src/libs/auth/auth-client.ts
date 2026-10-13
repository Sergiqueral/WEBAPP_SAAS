import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
  ],
  baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
