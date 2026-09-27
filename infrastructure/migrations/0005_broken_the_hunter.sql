CREATE TYPE "public"."audit_result" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prompt_version_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"admin_email" varchar(254) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" varchar(120) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"result" "audit_result" NOT NULL,
	"request_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_configs" (
	"id" varchar(60) PRIMARY KEY NOT NULL,
	"provider" varchar(20) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"chat_model" varchar(120) NOT NULL,
	"embedding_model" varchar(120) NOT NULL,
	"embedding_dimension" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"temperature_permille" integer NOT NULL,
	"supports_json" boolean DEFAULT true NOT NULL,
	"supports_tools" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"secret_ciphertext" text,
	"secret_iv" varchar(64),
	"secret_tag" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_key" varchar(80) NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"status" "prompt_version_status" DEFAULT 'draft' NOT NULL,
	"rollout_percent" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_admin_created_idx" ON "audit_logs" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_key_version_unique" ON "prompt_versions" USING btree ("prompt_key","version");
