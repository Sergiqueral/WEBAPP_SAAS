CREATE TABLE "tenant_addons" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"addon_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_feature_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"feature_key" text NOT NULL,
	"is_granted" boolean NOT NULL,
	"reason" text,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan" text DEFAULT 'alpha_tester' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"first_guest_trial_started_at" timestamp,
	"first_guest_trial_ends_at" timestamp,
	"paid_seats_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_addons_org_key_idx" ON "tenant_addons" USING btree ("organization_id","addon_key");--> statement-breakpoint
CREATE INDEX "tenant_addons_org_idx" ON "tenant_addons" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_overrides_org_feature_idx" ON "tenant_feature_overrides" USING btree ("organization_id","feature_key");--> statement-breakpoint
CREATE INDEX "tenant_overrides_org_idx" ON "tenant_feature_overrides" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_subs_org_idx" ON "tenant_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenant_subs_status_idx" ON "tenant_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_subs_last_active_idx" ON "tenant_subscriptions" USING btree ("last_active_at");