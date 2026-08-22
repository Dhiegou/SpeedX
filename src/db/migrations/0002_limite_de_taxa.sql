CREATE TABLE "limite_taxa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escopo" text NOT NULL,
	"identificador" text NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "limite_taxa_janela_idx" ON "limite_taxa" USING btree ("escopo","identificador","ocorrido_em");--> statement-breakpoint
CREATE INDEX "limite_taxa_ocorrido_em_idx" ON "limite_taxa" USING btree ("ocorrido_em");