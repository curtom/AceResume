CREATE TYPE "public"."resume_section_type" AS ENUM('basic', 'target', 'education', 'experience', 'project', 'campus', 'skill', 'award', 'summary', 'custom');--> statement-breakpoint
CREATE TYPE "public"."resume_source" AS ENUM('blank', 'profile');--> statement-breakpoint
CREATE TYPE "public"."resume_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "resume_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"section_type" "resume_section_type" NOT NULL,
	"title" varchar(80) NOT NULL,
	"content" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"style_override" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"target_role" varchar(120),
	"locale" varchar(10) DEFAULT 'zh-CN' NOT NULL,
	"template_version_id" varchar(100) NOT NULL,
	"theme" jsonb NOT NULL,
	"status" "resume_status" DEFAULT 'active' NOT NULL,
	"source" "resume_source" NOT NULL,
	"thumbnail_status" varchar(20) DEFAULT 'placeholder' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_save_key" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_sections" ADD CONSTRAINT "resume_sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_sections" ADD CONSTRAINT "resume_sections_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resume_sections_resume_order_unique" ON "resume_sections" USING btree ("resume_id","sort_order");--> statement-breakpoint
CREATE INDEX "resume_sections_user_resume_idx" ON "resume_sections" USING btree ("user_id","resume_id");--> statement-breakpoint
CREATE INDEX "resumes_user_status_updated_idx" ON "resumes" USING btree ("user_id","status","updated_at");