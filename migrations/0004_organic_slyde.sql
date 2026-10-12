CREATE TABLE "system_superadmins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"role" text DEFAULT 'superadmin' NOT NULL,
	"is_granted" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "system_superadmins_email_idx" ON "system_superadmins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "system_superadmins_user_idx" ON "system_superadmins" USING btree ("user_id");