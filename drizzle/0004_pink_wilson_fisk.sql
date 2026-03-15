CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nhl_game_id" integer NOT NULL,
	"season" text NOT NULL,
	"game_date" date NOT NULL,
	"game_type" integer NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"game_state" text NOT NULL,
	"start_time_utc" timestamp with time zone NOT NULL,
	"period" integer,
	"time_remaining" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_nhl_game_id_unique" UNIQUE("nhl_game_id")
);
--> statement-breakpoint
CREATE TABLE "goal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"nhl_game_id" integer NOT NULL,
	"scorer_nhl_id" integer NOT NULL,
	"period" integer NOT NULL,
	"time_in_period" text NOT NULL,
	"strength" text NOT NULL,
	"goal_modifier" text,
	"assist_nhl_ids" integer[] DEFAULT '{}' NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	CONSTRAINT "goal_events_unique" UNIQUE("nhl_game_id","scorer_nhl_id","period","time_in_period","home_score","away_score")
);
--> statement-breakpoint
CREATE TABLE "goaltender_game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"nhl_game_id" integer NOT NULL,
	"goaltender_nhl_id" integer NOT NULL,
	"decision" text,
	"shots_against" integer NOT NULL,
	"goals_against" integer NOT NULL,
	"save_pctg" real NOT NULL,
	"shutout" boolean DEFAULT false NOT NULL,
	"toi" text NOT NULL,
	CONSTRAINT "goaltender_game_stats_unique" UNIQUE("nhl_game_id","goaltender_nhl_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nhl_id" integer NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"position" text NOT NULL,
	"salary" integer,
	"injury_status" text,
	"injury_description" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_nhl_id_unique" UNIQUE("nhl_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"week_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"lock_time" timestamp with time zone NOT NULL,
	"is_overridden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_schedules_pool_week_unique" UNIQUE("pool_id","week_number")
);
--> statement-breakpoint
CREATE TABLE "roster_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"player_nhl_id" integer NOT NULL,
	"position" text NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"salary" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"user_id" text NOT NULL,
	"week_id" uuid NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_snapshots_pool_user_week_unique" UNIQUE("pool_id","user_id","week_id")
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"user_id" text NOT NULL,
	"week_id" uuid NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rosters_pool_user_week_unique" UNIQUE("pool_id","user_id","week_id")
);
--> statement-breakpoint
CREATE TABLE "pool_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"salary_cap" integer,
	"captain_mode" boolean DEFAULT false NOT NULL,
	"goaltending_mode" text DEFAULT 'team' NOT NULL,
	"roster_constraints" jsonb DEFAULT '{"forwards":6,"defensemen":4,"goalies":2}'::jsonb NOT NULL,
	"scoring_rules" jsonb DEFAULT '{"forward":{"goal":2,"assist":1,"hatTrick":2},"defenseman":{"goal":2,"assist":1,"hatTrick":2},"goalie":{"goal":2,"assist":1},"goaltending":{"win":2,"shutout":2,"overtimeLoss":1}}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pool_config_pool_id_unique" UNIQUE("pool_id")
);
--> statement-breakpoint
CREATE TABLE "scoring_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"week_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"player_nhl_id" integer NOT NULL,
	"nhl_game_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"points" integer NOT NULL,
	"base_points" integer NOT NULL,
	"is_captain_bonus" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"week_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_scores_pool_week_user_unique" UNIQUE("pool_id","week_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "financial_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" text NOT NULL,
	"user_id" text NOT NULL,
	"week_id" uuid,
	"event_type" text NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_events" ADD CONSTRAINT "goal_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goaltender_game_stats" ADD CONSTRAINT "goaltender_game_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_schedules" ADD CONSTRAINT "weekly_schedules_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_snapshots" ADD CONSTRAINT "roster_snapshots_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_snapshots" ADD CONSTRAINT "roster_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_snapshots" ADD CONSTRAINT "roster_snapshots_week_id_weekly_schedules_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weekly_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_week_id_weekly_schedules_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weekly_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_config" ADD CONSTRAINT "pool_config_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_events" ADD CONSTRAINT "scoring_events_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_events" ADD CONSTRAINT "scoring_events_week_id_weekly_schedules_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weekly_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_events" ADD CONSTRAINT "scoring_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_week_id_weekly_schedules_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weekly_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_pool_id_organization_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_week_id_weekly_schedules_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weekly_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_game_date_idx" ON "games" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "games_home_team_idx" ON "games" USING btree ("home_team");--> statement-breakpoint
CREATE INDEX "games_away_team_idx" ON "games" USING btree ("away_team");--> statement-breakpoint
CREATE INDEX "goal_events_game_id_idx" ON "goal_events" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "goal_events_scorer_nhl_id_idx" ON "goal_events" USING btree ("scorer_nhl_id");--> statement-breakpoint
CREATE INDEX "goal_events_nhl_game_id_idx" ON "goal_events" USING btree ("nhl_game_id");--> statement-breakpoint
CREATE INDEX "goaltender_game_stats_game_id_idx" ON "goaltender_game_stats" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "goaltender_game_stats_goaltender_nhl_id_idx" ON "goaltender_game_stats" USING btree ("goaltender_nhl_id");--> statement-breakpoint
CREATE INDEX "goaltender_game_stats_nhl_game_id_idx" ON "goaltender_game_stats" USING btree ("nhl_game_id");--> statement-breakpoint
CREATE INDEX "players_team_idx" ON "players" USING btree ("team");--> statement-breakpoint
CREATE INDEX "players_position_idx" ON "players" USING btree ("position");--> statement-breakpoint
CREATE INDEX "weekly_schedules_pool_week_idx" ON "weekly_schedules" USING btree ("pool_id","week_number");--> statement-breakpoint
CREATE INDEX "weekly_schedules_pool_dates_idx" ON "weekly_schedules" USING btree ("pool_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "roster_slots_roster_id_idx" ON "roster_slots" USING btree ("roster_id");--> statement-breakpoint
CREATE INDEX "rosters_pool_user_week_idx" ON "rosters" USING btree ("pool_id","user_id","week_id");--> statement-breakpoint
CREATE INDEX "scoring_events_pool_week_user_idx" ON "scoring_events" USING btree ("pool_id","week_id","user_id");--> statement-breakpoint
CREATE INDEX "scoring_events_nhl_game_id_idx" ON "scoring_events" USING btree ("nhl_game_id");--> statement-breakpoint
CREATE INDEX "weekly_scores_pool_week_idx" ON "weekly_scores" USING btree ("pool_id","week_id");--> statement-breakpoint
CREATE INDEX "financial_ledger_pool_user_idx" ON "financial_ledger" USING btree ("pool_id","user_id");