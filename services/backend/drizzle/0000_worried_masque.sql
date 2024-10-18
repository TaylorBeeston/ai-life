DO $$ BEGIN
 CREATE TYPE "public"."agent_state" AS ENUM('sleeping', 'awake');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"action_type" text,
	"action_details" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"world_state_id" uuid,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"state" "agent_state" NOT NULL,
	"hp" double precision NOT NULL,
	"hunger" double precision NOT NULL,
	"social" double precision NOT NULL,
	"fatigue" double precision NOT NULL,
	"wood" integer NOT NULL,
	"saplings" integer NOT NULL,
	"food" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_emotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"emotion" text,
	"intensity" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_thoughts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"thought" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"model" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "building_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_state_id" uuid,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"type" integer NOT NULL,
	"progress" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enemies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_state_id" uuid,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"hp" double precision NOT NULL,
	"emoji" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"run_id" uuid,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"volume" integer NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_time" timestamp DEFAULT now(),
	"status" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seed_growth_timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_state_id" uuid,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"timer" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"previous_full_state_id" uuid,
	"timestamp" timestamp DEFAULT now(),
	"is_night" boolean NOT NULL,
	"time_of_day" integer NOT NULL,
	"compressed_grid" "bytea",
	"grid_diff" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_id_agent_details_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_details"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_details" ADD CONSTRAINT "agent_details_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_details" ADD CONSTRAINT "agent_details_world_state_id_world_states_id_fk" FOREIGN KEY ("world_state_id") REFERENCES "public"."world_states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_emotions" ADD CONSTRAINT "agent_emotions_agent_id_agent_details_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_details"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_thoughts" ADD CONSTRAINT "agent_thoughts_agent_id_agent_details_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_details"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "building_projects" ADD CONSTRAINT "building_projects_world_state_id_world_states_id_fk" FOREIGN KEY ("world_state_id") REFERENCES "public"."world_states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enemies" ADD CONSTRAINT "enemies_world_state_id_world_states_id_fk" FOREIGN KEY ("world_state_id") REFERENCES "public"."world_states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seed_growth_timers" ADD CONSTRAINT "seed_growth_timers_world_state_id_world_states_id_fk" FOREIGN KEY ("world_state_id") REFERENCES "public"."world_states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_states" ADD CONSTRAINT "world_states_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_states" ADD CONSTRAINT "world_states_previous_full_state_id_world_states_id_fk" FOREIGN KEY ("previous_full_state_id") REFERENCES "public"."world_states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
