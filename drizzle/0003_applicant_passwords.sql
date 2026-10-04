CREATE TABLE "applicant_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "password_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applicant_tokens" ADD CONSTRAINT "applicant_tokens_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_tokens_hash_idx" ON "applicant_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "applicant_tokens_applicant_idx" ON "applicant_tokens" USING btree ("applicant_id");