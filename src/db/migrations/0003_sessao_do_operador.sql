CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operador_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"encerrada_em" timestamp with time zone,
	CONSTRAINT "sessao_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessao_expira_em_idx" ON "sessao" USING btree ("expira_em");--> statement-breakpoint
CREATE INDEX "sessao_operador_idx" ON "sessao" USING btree ("operador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operador_usuario_minusculo_idx" ON "operador" USING btree (lower("usuario"));