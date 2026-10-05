import type { AdminRole } from "@/db/schema/enums";

/**
 * Permission-based access control. Code checks permissions, never roles, so
 * new roles only require a new entry in ROLE_PERMISSIONS.
 */
export const PERMISSIONS = [
  "applications.view",
  "applications.review",
  "notes.create",
  "communications.send",
  "documents.view",
  "account_details.view_masked",
  "account_details.reveal",
  "identity.reveal",
  "loans.manage",
  "payments.void",
  "admins.manage",
  "products.manage",
  "documents.configure",
  "audit.view",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const REVIEWER: Permission[] = [
  "applications.view",
  "applications.review",
  "notes.create",
  "communications.send",
  "documents.view",
  "account_details.view_masked",
  "identity.reveal",
  "loans.manage",
];

export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(REVIEWER),
  SUPER_ADMIN: new Set(PERMISSIONS),
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};
