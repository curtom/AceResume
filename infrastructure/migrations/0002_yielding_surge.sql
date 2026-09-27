CREATE TYPE "public"."export_job_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."template_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"resume_version" integer NOT NULL,
	"template_version_id" varchar(100) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" "export_job_status" DEFAULT 'queued' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"object_key" varchar(500),
	"file_name" varchar(180) NOT NULL,
	"diagnostics" jsonb,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"template_id" varchar(60) NOT NULL,
	"version" integer NOT NULL,
	"status" "template_version_status" DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" varchar(60) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(240) NOT NULL,
	"category" varchar(30) NOT NULL,
	"layout" varchar(30) NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "export_jobs_user_idempotency_unique" ON "export_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "export_jobs_user_created_idx" ON "export_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "export_jobs_resume_version_idx" ON "export_jobs" USING btree ("resume_id","resume_version");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_version_unique" ON "template_versions" USING btree ("template_id","version");