ALTER TABLE "ai_citations" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_versions" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD COLUMN "input_token_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD COLUMN "output_token_count" integer DEFAULT 0 NOT NULL;