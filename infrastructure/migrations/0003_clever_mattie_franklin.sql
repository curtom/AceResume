CREATE TYPE "public"."document_file_type" AS ENUM('docx', 'pdf', 'txt', 'md');--> statement-breakpoint
CREATE TYPE "public"."document_import_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."document_purpose" AS ENUM('material', 'resume');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('queued', 'parsing', 'ready', 'failed', 'deleting');--> statement-breakpoint
ALTER TYPE "public"."resume_source" ADD VALUE 'import';--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"page_number" integer,
	"paragraph_start" integer,
	"paragraph_end" integer,
	"section_path" varchar(300),
	"chunk_index" integer NOT NULL,
	"token_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "document_import_status" DEFAULT 'pending' NOT NULL,
	"candidates" jsonb NOT NULL,
	"confirmed_selection" jsonb,
	"destination" varchar(20),
	"resume_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" "document_file_type" NOT NULL,
	"purpose" "document_purpose" DEFAULT 'material' NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"status" "document_status" DEFAULT 'queued' NOT NULL,
	"page_count" integer,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_imports" ADD CONSTRAINT "document_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_imports" ADD CONSTRAINT "document_imports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_imports" ADD CONSTRAINT "document_imports_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_document_index_unique" ON "document_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "document_chunks_user_document_idx" ON "document_chunks" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_imports_document_unique" ON "document_imports" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_imports_user_created_idx" ON "document_imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_user_created_idx" ON "documents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_user_status_idx" ON "documents" USING btree ("user_id","status");