import { boolean, char, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import {
  actorTypeEnum,
  communicationTypeEnum,
  deliveryStatusEnum,
  documentStatusEnum,
  infoRequestStatusEnum,
} from "./enums";
import { applications } from "./applications";
import { admins } from "./auth";

export const informationRequests = pgTable(
  "information_requests",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    requestedByAdminId: uuid("requested_by_admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    /** Document type keys and/or "other". */
    requestedItems: text("requested_items").array().notNull().default([]),
    message: text("message").notNull(),
    status: infoRequestStatusEnum("status").notNull().default("OPEN"),
    responseText: text("response_text"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("info_requests_application_idx").on(t.applicationId)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    /** Null until the draft upload is attached at submission. */
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "cascade",
    }),
    /** Hash of the pre-submission upload-draft token (cleared on attach). */
    draftTokenHash: text("draft_token_hash"),
    informationRequestId: uuid("information_request_id").references(() => informationRequests.id, {
      onDelete: "set null",
    }),
    documentType: text("document_type").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    cloudinaryResourceType: text("cloudinary_resource_type").notNull(),
    cloudinaryFormat: text("cloudinary_format"),
    cloudinaryVersion: integer("cloudinary_version").notNull(),
    status: documentStatusEnum("status").notNull().default("PENDING"),
    uploadedBy: actorTypeEnum("uploaded_by").notNull().default("APPLICANT"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("documents_application_idx").on(t.applicationId),
    index("documents_draft_idx").on(t.draftTokenHash),
    uniqueIndex("documents_public_id_idx").on(t.cloudinaryPublicId),
  ],
);

/**
 * Highly sensitive. Bank identifiers live only inside `encryptedPayload`
 * (AES-256-GCM). Plain columns hold display-safe values only.
 */
export const accountDetails = pgTable(
  "account_details",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    accountHolderName: text("account_holder_name").notNull(),
    bankName: text("bank_name").notNull(),
    country: char("country", { length: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    /** e.g. "••••4821" — the only identifier fragment stored in plain text. */
    maskedIdentifier: text("masked_identifier").notNull(),
    /** Which identifier the mask was derived from, e.g. "IBAN". */
    maskedIdentifierType: text("masked_identifier_type").notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    /** Encryption key version, to support rotation. */
    keyVersion: integer("key_version").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    /** Retention: purge encrypted payload after this date. */
    purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("account_details_application_idx").on(t.applicationId)],
);

/** Application timeline (shown to admins). */
export const applicationEvents = pgTable(
  "application_events",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorAdminId: uuid("actor_admin_id").references(() => admins.id, { onDelete: "set null" }),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("application_events_application_idx").on(t.applicationId, t.createdAt)],
);

/** Private reviewer notes. Never exposed to applicants. */
export const adminNotes = pgTable(
  "admin_notes",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => admins.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_notes_application_idx").on(t.applicationId)],
);

export const communications = pgTable(
  "communications",
  {
    id: id(),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "cascade",
    }),
    type: communicationTypeEnum("type").notNull(),
    senderAdminId: uuid("sender_admin_id").references(() => admins.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    /** Plain-text message body shown in the portal (no sensitive data). */
    body: text("body"),
    visibleToApplicant: boolean("visible_to_applicant").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** Which email provider delivered it (resend | zoho). */
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("QUEUED"),
    errorCode: text("error_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("communications_application_idx").on(t.applicationId, t.createdAt),
    index("communications_recipient_idx").on(t.recipientEmail),
  ],
);

/** System-wide security audit trail. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorAdminId: uuid("actor_admin_id").references(() => admins.id, { onDelete: "set null" }),
    actorApplicantId: uuid("actor_applicant_id"),
    action: text("action").notNull(),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_application_idx").on(t.applicationId),
    index("audit_logs_actor_admin_idx").on(t.actorAdminId),
    index("audit_logs_action_idx").on(t.action),
  ],
);
