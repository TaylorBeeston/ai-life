ALTER TABLE "agent_thoughts" ALTER COLUMN "timestamp" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "agent_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "start_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "world_states" ALTER COLUMN "timestamp" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "timestamp" timestamp DEFAULT now() NOT NULL;