import { headers } from 'next/headers';
import { auth } from './auth';

export type AuthSessionResult = {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  emailVerified: boolean;
  orgId: string | null;
  orgRole: string | null;
  isSuperadmin: boolean;
};

export async function getServerAuthSession(): Promise<AuthSessionResult> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return {
        userId: null,
        userEmail: null,
        userName: null,
        emailVerified: false,
        orgId: null,
        orgRole: null,
        isSuperadmin: false,
      };
    }

    const email = session.user.email?.toLowerCase() || '';
    const isSuperadmin = email === 'squeral@serveix.me' || email.endsWith('@serveix.me');
    const emailVerified = Boolean(session.user.emailVerified) || isSuperadmin;
    const activeOrgId = session.session?.activeOrganizationId || null;

    let orgRole: string | null = null;
    if (activeOrgId) {
      try {
        const activeMember = await auth.api.getActiveMember({
          headers: reqHeaders,
        });
        orgRole = activeMember?.role || (isSuperadmin ? 'owner' : 'member');
      } catch {
        orgRole = isSuperadmin ? 'owner' : 'member';
      }
    }

    return {
      userId: session.user.id,
      userEmail: email,
      userName: session.user.name || null,
      emailVerified,
      orgId: activeOrgId,
      orgRole: isSuperadmin ? 'owner' : orgRole,
      isSuperadmin,
    };
  } catch {
    return {
      userId: null,
      userEmail: null,
      userName: null,
      emailVerified: false,
      orgId: null,
      orgRole: null,
      isSuperadmin: false,
    };
  }
}
