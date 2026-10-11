CREATE TABLE "atom_external_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"atom_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"sync_hash" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atoms" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source_atom_id" text NOT NULL,
	"target_atom_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atom_external_identities" ADD CONSTRAINT "atom_external_identities_atom_id_atoms_id_fk" FOREIGN KEY ("atom_id") REFERENCES "public"."atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_source_atom_id_atoms_id_fk" FOREIGN KEY ("source_atom_id") REFERENCES "public"."atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_atom_id_atoms_id_fk" FOREIGN KEY ("target_atom_id") REFERENCES "public"."atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_id_unique_idx" ON "atom_external_identities" USING btree ("organization_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "external_atom_idx" ON "atom_external_identities" USING btree ("organization_id","atom_id");--> statement-breakpoint
CREATE INDEX "atoms_org_type_idx" ON "atoms" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "atoms_org_created_idx" ON "atoms" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "links_org_source_idx" ON "links" USING btree ("organization_id","source_atom_id");--> statement-breakpoint
CREATE INDEX "links_org_target_idx" ON "links" USING btree ("organization_id","target_atom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "links_unique_synapse_idx" ON "links" USING btree ("organization_id","source_atom_id","target_atom_id","relation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_idx" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_org_role_idx" ON "memberships" USING btree ("organization_id","role");