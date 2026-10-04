CREATE TYPE "public"."actor_type" AS ENUM('ADMIN', 'APPLICANT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ELIGIBLE', 'NOT_ELIGIBLE', 'ACCOUNT_DETAILS_REQUESTED', 'FINAL_REVIEW', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."communication_type" AS ENUM('APPLICATION_CONFIRMATION', 'ADMIN_NOTIFICATION', 'STATUS_UPDATE', 'INFORMATION_REQUEST', 'ELIGIBILITY_DECISION', 'ACCOUNT_DETAILS_REQUEST', 'CUSTOM_MESSAGE', 'VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('PENDING', 'ATTACHED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('EMPLOYED_FULL_TIME', 'EMPLOYED_PART_TIME', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'CONTRACTOR', 'STUDENT', 'RETIRED', 'UNEMPLOYED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."income_frequency" AS ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ANNUALLY');--> statement-breakpoint
CREATE TYPE "public"."info_request_status" AS ENUM('OPEN', 'FULFILLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."repayment_frequency" AS ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TABLE "document_types" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_product_id" uuid,
	"rule_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"purpose_key" text NOT NULL,
	"min_amount" numeric(14, 2) NOT NULL,
	"max_amount" numeric(14, 2) NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"supported_currencies" text[] DEFAULT '{}' NOT NULL,
	"supported_countries" text[] DEFAULT '{}' NOT NULL,
	"term_options_months" integer[] DEFAULT '{}' NOT NULL,
	"required_document_types" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"country" char(2) NOT NULL,
	"region" text,
	"city" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"postal_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"phone" text NOT NULL,
	"country_of_residence" char(2) NOT NULL,
	"nationality" char(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"applicant_id" uuid NOT NULL,
	"loan_product_id" uuid,
	"status" "application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"country" char(2) NOT NULL,
	"idempotency_key" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"consent_type" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "employment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"employment_status" "employment_status" NOT NULL,
	"employer_name" text,
	"job_title" text,
	"income_amount" numeric(14, 2) NOT NULL,
	"income_currency" char(3) NOT NULL,
	"income_frequency" "income_frequency" NOT NULL,
	"monthly_income" numeric(14, 2) NOT NULL,
	"months_in_role" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"has_existing_loans" boolean NOT NULL,
	"existing_loan_count" integer,
	"monthly_debt_payments" numeric(14, 2) NOT NULL,
	"monthly_expenses" numeric(14, 2) NOT NULL,
	"dependents" integer,
	"other_commitments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"purpose_details" text,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"term_months" integer NOT NULL,
	"repayment_frequency" "repayment_frequency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"link_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" DEFAULT 'ADMIN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"link_token_hash" text NOT NULL,
	"redirect_path" text,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"account_holder_name" text NOT NULL,
	"bank_name" text NOT NULL,
	"country" char(2) NOT NULL,
	"currency" char(3) NOT NULL,
	"masked_identifier" text NOT NULL,
	"masked_identifier_type" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"admin_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_admin_id" uuid,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_admin_id" uuid,
	"actor_applicant_id" uuid,
	"action" text NOT NULL,
	"application_id" uuid,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"type" "communication_type" NOT NULL,
	"sender_admin_id" uuid,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"visible_to_applicant" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"provider_message_id" text,
	"delivery_status" "delivery_status" DEFAULT 'QUEUED' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"draft_token_hash" text,
	"information_request_id" uuid,
	"document_type" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_resource_type" text NOT NULL,
	"cloudinary_format" text,
	"cloudinary_version" integer NOT NULL,
	"status" "document_status" DEFAULT 'PENDING' NOT NULL,
	"uploaded_by" "actor_type" DEFAULT 'APPLICANT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "information_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"requested_by_admin_id" uuid,
	"requested_items" text[] DEFAULT '{}' NOT NULL,
	"message" text NOT NULL,
	"status" "info_request_status" DEFAULT 'OPEN' NOT NULL,
	"response_text" text,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_profiles" ADD CONSTRAINT "employment_profiles_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_verification_codes" ADD CONSTRAINT "admin_verification_codes_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_sessions" ADD CONSTRAINT "applicant_sessions_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_verification_codes" ADD CONSTRAINT "applicant_verification_codes_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_details" ADD CONSTRAINT "account_details_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_actor_admin_id_admins_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_admins_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_sender_admin_id_admins_id_fk" FOREIGN KEY ("sender_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_information_request_id_information_requests_id_fk" FOREIGN KEY ("information_request_id") REFERENCES "public"."information_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_requested_by_admin_id_admins_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eligibility_rules_product_idx" ON "eligibility_rules" USING btree ("loan_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_products_slug_idx" ON "loan_products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_application_idx" ON "addresses" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applicants_email_idx" ON "applicants" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_reference_idx" ON "applications" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_idempotency_idx" ON "applications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "applications_applicant_idx" ON "applications" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_country_idx" ON "applications" USING btree ("country");--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consents_application_idx" ON "consents" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_profiles_application_idx" ON "employment_profiles" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_profiles_application_idx" ON "financial_profiles" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_requests_application_idx" ON "loan_requests" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_codes_admin_idx" ON "admin_verification_codes" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_codes_link_idx" ON "admin_verification_codes" USING btree ("link_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_sessions_token_idx" ON "applicant_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "applicant_sessions_applicant_idx" ON "applicant_sessions" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "applicant_codes_applicant_idx" ON "applicant_verification_codes" USING btree ("applicant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_codes_link_idx" ON "applicant_verification_codes" USING btree ("link_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "account_details_application_idx" ON "account_details" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "admin_notes_application_idx" ON "admin_notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_application_idx" ON "audit_logs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_admin_idx" ON "audit_logs" USING btree ("actor_admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "communications_application_idx" ON "communications" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "communications_recipient_idx" ON "communications" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "documents_application_idx" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "documents_draft_idx" ON "documents" USING btree ("draft_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_public_id_idx" ON "documents" USING btree ("cloudinary_public_id");--> statement-breakpoint
CREATE INDEX "info_requests_application_idx" ON "information_requests" USING btree ("application_id");