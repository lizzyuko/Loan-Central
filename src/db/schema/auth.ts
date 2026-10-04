import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { adminRoleEnum } from "./enums";
import { applicants } from "./applications";

export const admins = pgTable(
  "admins",
  {
    id: id(),
    email: text("email").notNull(), // always lower-cased
    name: text("name").notNull(),
    role: adminRoleEnum("role").notNull().default("ADMIN"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admins_email_idx").on(t.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: id(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_idx").on(t.tokenHash),
    index("admin_sessions_admin_idx").on(t.adminId),
  ],
);

export const adminVerificationCodes = pgTable(
  "admin_verification_codes",
  {
    id: id(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    linkTokenHash: text("link_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("admin_codes_admin_idx").on(t.adminId),
    uniqueIndex("admin_codes_link_idx").on(t.linkTokenHash),
  ],
);

export const applicantSessions = pgTable(
  "applicant_sessions",
  {
    id: id(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("applicant_sessions_token_idx").on(t.tokenHash),
    index("applicant_sessions_applicant_idx").on(t.applicantId),
  ],
);

export const applicantVerificationCodes = pgTable(
  "applicant_verification_codes",
  {
    id: id(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    linkTokenHash: text("link_token_hash").notNull(),
    /** Where the magic link lands after sign-in (relative path, validated). */
    redirectPath: text("redirect_path"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("applicant_codes_applicant_idx").on(t.applicantId),
    uniqueIndex("applicant_codes_link_idx").on(t.linkTokenHash),
  ],
);
