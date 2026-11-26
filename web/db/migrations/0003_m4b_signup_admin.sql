CREATE TABLE "admin_audit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_user_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action" CHECK ("admin_audit"."action" IN ('let_in', 'let_in_many', 'waitlist_removed', 'suspended', 'reactivated', 'reactivated_to_waitlist', 'cap_changed', 'admin_added', 'permissions_changed', 'admin_removed', 'scaler_code_set', 'scaler_code_failed', 'account_deleted')),
	CONSTRAINT "admin_audit_details_object" CHECK (jsonb_typeof("admin_audit"."details") = 'object')
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_setting_key" CHECK ("app_setting"."key" IN ('user_cap', 'scaler_code_hash')),
	CONSTRAINT "app_setting_user_cap" CHECK (CASE WHEN "app_setting"."key" <> 'user_cap' THEN true WHEN "app_setting"."value" !~ '^[0-9]{1,4}$' THEN false ELSE "app_setting"."value"::int <= 1000 END),
	CONSTRAINT "app_setting_value_length" CHECK (char_length("app_setting"."value") <= 512)
);
--> statement-breakpoint
CREATE TABLE "export_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"window_start" timestamp with time zone,
	"window_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "export_token_hash_format" CHECK ("export_token"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "user_permission" (
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permission_user_id_permission_pk" PRIMARY KEY("user_id","permission"),
	CONSTRAINT "user_permission_permission" CHECK ("user_permission"."permission" IN ('metrics.view', 'users.view', 'users.manage', 'waitlist.manage', 'settings.manage', 'admins.manage', 'audit.view'))
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"show_reading" boolean DEFAULT true NOT NULL,
	"show_scaler" boolean DEFAULT false NOT NULL,
	"show_certs" boolean DEFAULT true NOT NULL,
	"show_projects" boolean DEFAULT false NOT NULL,
	"show_career" boolean DEFAULT false NOT NULL,
	"scaler_unlocked_at" timestamp with time zone,
	"scaler_attempts" integer DEFAULT 0 NOT NULL,
	"scaler_attempts_since" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_scaler_unlocked" CHECK (NOT "user_settings"."show_scaler" OR "user_settings"."scaler_unlocked_at" IS NOT NULL),
	CONSTRAINT "user_settings_scaler_attempts" CHECK ("user_settings"."scaler_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_login" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "waitlisted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_token" ADD CONSTRAINT "export_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_at_idx" ON "admin_audit" USING btree ("at");--> statement-breakpoint
CREATE INDEX "admin_audit_action_at_idx" ON "admin_audit" USING btree ("action","at");--> statement-breakpoint
CREATE UNIQUE INDEX "export_token_hash_idx" ON "export_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "export_token_user_idx" ON "export_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_status_waitlisted_idx" ON "user" USING btree ("status","waitlisted_at");--> statement-breakpoint
CREATE INDEX "user_github_login_idx" ON "user" USING btree (lower("github_login"));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_status" CHECK ("user"."status" IN ('active', 'waitlisted', 'suspended'));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_github_login" CHECK ("user"."github_login" IS NULL OR "user"."github_login" ~ '^[A-Za-z0-9-]{1,39}$');--> statement-breakpoint
-- Hand-written below this line (not generated by drizzle-kit).
-- Every existing user keeps their place: the status column defaults to 'active'; record when.
UPDATE "user" SET "activated_at" = "created_at" WHERE "status" = 'active' AND "activated_at" IS NULL;--> statement-breakpoint
-- The starting cap (M4-DESIGN 2). Admins change it on the Sign-up tab.
INSERT INTO "app_setting" ("key", "value") VALUES ('user_cap', '100');--> statement-breakpoint
-- The owner's settings: every section on, Scaler unlocked (M4-DESIGN 5 and 10.2). SQL can't read
-- OWNER_GITHUB_ID, so this relies on sign-in having been owner-only until now: it fills the row
-- only when there is exactly one user. `npm run db:migrate` checks first that this one user is the
-- owner (scripts/lib/migrate-check.mjs). With any other number of users it adds nothing, and the
-- owner's row is created at their next sign-in instead (lib/auth.ts).
DO $$
BEGIN
	IF (SELECT count(*) FROM "user") = 1 THEN
		INSERT INTO "user_settings" ("user_id", "show_reading", "show_scaler", "show_certs", "show_projects", "show_career", "scaler_unlocked_at")
		SELECT "id", true, true, true, true, true, now() FROM "user";
	END IF;
END $$;
