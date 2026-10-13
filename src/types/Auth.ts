import type { EnumValues } from './Enum';

export const ORG_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  ORG_ADMIN: 'org:admin',
  ORG_MEMBER: 'org:member',
} as const;

export type OrgRole = EnumValues<typeof ORG_ROLE>;

export const ORG_PERMISSION = {
  // Add Organization Permissions here
} as const;

export type OrgPermission = EnumValues<typeof ORG_PERMISSION>;
