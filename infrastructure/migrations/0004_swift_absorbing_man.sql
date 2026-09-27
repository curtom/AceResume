CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."ai_generation_decision" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_source_type" AS ENUM('profile', 'document');--> statement-breakpoint
CREATE TYPE "public"."ai_task_event_type" AS ENUM('started', 'progress', 'delta', 'suggestion', 'completed', 'failed', 'heartbeat');--> statement-breakpoint
CREATE TYPE "public"."ai_task_status" AS ENUM('queued', 'processing', 'awaiting_confirmation', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_citations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"generation_id" uuid NOT NULL,
	"source_type" "ai_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_id" uuid,
	"label" varchar(255) NOT NULL,
	"excerpt" varchar(800) NOT NULL,
	"quote_range" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"suggestion" jsonb NOT NULL,
	"decision" "ai_generation_decision" DEFAULT 'pending' NOT NULL,
	"edited_text" text,
	"decided_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"applied_resume_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" "ai_task_event_type" NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"base_version" integer NOT NULL,
	"status" "ai_task_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"provider" varchar(20) NOT NULL,
	"model" varchar(120) NOT NULL,
	"prompt_version" varchar(80) NOT NULL,
	"input" jsonb NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"consented_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "embedding_model" varchar(120);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_task_id_ai_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ai_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_task_events" ADD CONSTRAINT "ai_task_events_task_id_ai_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ai_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_task_events" ADD CONSTRAINT "ai_task_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_citations_generation_idx" ON "ai_citations" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "ai_citations_user_source_idx" ON "ai_citations" USING btree ("user_id","source_id");--> statement-breakpoint
CREATE INDEX "ai_generations_task_created_idx" ON "ai_generations" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_user_created_idx" ON "ai_generations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_task_events_task_sequence_unique" ON "ai_task_events" USING btree ("task_id","sequence");--> statement-breakpoint
CREATE INDEX "ai_task_events_user_task_idx" ON "ai_task_events" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "ai_tasks_user_created_idx" ON "ai_tasks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_tasks_resume_created_idx" ON "ai_tasks" USING btree ("resume_id","created_at");
