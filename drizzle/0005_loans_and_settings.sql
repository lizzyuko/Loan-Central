CREATE TYPE "public"."installment_status" AS ENUM('PENDING', 'PARTIAL', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('PENDING_DISBURSEMENT', 'ACTIVE', 'PAID_OFF', 'DEFAULTED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'APPROVED' BEFORE 'COMPLETED';--> statement-breakpoint
ALTER TYPE "public"."communication_type" ADD VALUE 'LOAN_APPROVED';--> statement-breakpoint
ALTER TYPE "public"."communication_type" ADD VALUE 'PAYMENT_RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."communication_type" ADD VALUE 'PAYMENT_REMINDER';--> statement-breakpoint
ALTER TYPE "public"."communication_type" ADD VALUE 'PAYMENT_OVERDUE';--> statement-breakpoint
ALTER TYPE "public"."communication_type" ADD VALUE 'LOAN_PAID_OFF';--> statement-breakpoint
CREATE TABLE "loan_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"due_date" date NOT NULL,
	"principal_due" numeric(14, 2) NOT NULL,
	"interest_due" numeric(14, 2) NOT NULL,
	"amount_due" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "installment_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by_admin_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_admin_id" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"status" "loan_status" DEFAULT 'PENDING_DISBURSEMENT' NOT NULL,
	"principal" numeric(14, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"interest_rate" numeric(7, 4) NOT NULL,
	"total_interest" numeric(14, 2) NOT NULL,
	"total_repayable" numeric(14, 2) NOT NULL,
	"term_months" integer NOT NULL,
	"repayment_frequency" "repayment_frequency" NOT NULL,
	"installment_count" integer NOT NULL,
	"first_due_date" date NOT NULL,
	"approved_by_admin_id" uuid,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disbursed_at" timestamp with time zone,
	"paid_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_admin_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_recorded_by_admin_id_admins_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_voided_by_admin_id_admins_id_fk" FOREIGN KEY ("voided_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_reminders" ADD CONSTRAINT "loan_reminders_installment_id_loan_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."loan_installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_approved_by_admin_id_admins_id_fk" FOREIGN KEY ("approved_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_admin_id_admins_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loan_installments_seq_idx" ON "loan_installments" USING btree ("loan_id","sequence");--> statement-breakpoint
CREATE INDEX "loan_installments_due_idx" ON "loan_installments" USING btree ("due_date","status");--> statement-breakpoint
CREATE INDEX "loan_payments_loan_idx" ON "loan_payments" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_reminders_unique_idx" ON "loan_reminders" USING btree ("installment_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_application_idx" ON "loans" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "loans_applicant_idx" ON "loans" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");