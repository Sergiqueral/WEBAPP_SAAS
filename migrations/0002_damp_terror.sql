CREATE INDEX "atoms_org_type_created_idx" ON "atoms" USING btree ("organization_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "atoms_org_updated_idx" ON "atoms" USING btree ("organization_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "atoms_payload_gin_idx" ON "atoms" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "links_source_atom_idx" ON "links" USING btree ("source_atom_id");--> statement-breakpoint
CREATE INDEX "links_target_atom_idx" ON "links" USING btree ("target_atom_id");--> statement-breakpoint
CREATE INDEX "links_org_relation_idx" ON "links" USING btree ("organization_id","relation_type");--> statement-breakpoint
CREATE INDEX "links_org_created_idx" ON "links" USING btree ("organization_id","created_at" DESC NULLS LAST);