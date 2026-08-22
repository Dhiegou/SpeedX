CREATE TYPE "public"."estado_tentativa" AS ENUM('pendente', 'valida', 'ausente');--> statement-breakpoint
CREATE TYPE "public"."tipo_lancamento" AS ENUM('registro', 'correcao', 'ausencia');--> statement-breakpoint
CREATE TABLE "chave_idempotencia" (
	"chave" text PRIMARY KEY NOT NULL,
	"escopo" text NOT NULL,
	"resposta" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consentimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participante_id" uuid NOT NULL,
	"versao_termo" text NOT NULL,
	"aceite_participante" boolean NOT NULL,
	"aceite_responsavel" boolean,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consentimento_participante_id_unique" UNIQUE("participante_id"),
	CONSTRAINT "consentimento_aceite_verdadeiro" CHECK ("consentimento"."aceite_participante" = true),
	CONSTRAINT "consentimento_responsavel_nunca_falso" CHECK ("consentimento"."aceite_responsavel" is null or "consentimento"."aceite_responsavel" = true)
);
--> statement-breakpoint
CREATE TABLE "lancamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tentativa_id" uuid NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"tempo_ms_anterior" integer,
	"tempo_ms_novo" integer,
	"operador_id" uuid NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_valores_coerentes_com_tipo" CHECK (
        ("lancamento"."tipo" = 'registro'  and "lancamento"."tempo_ms_novo" is not null and "lancamento"."tempo_ms_anterior" is null) or
        ("lancamento"."tipo" = 'correcao'  and "lancamento"."tempo_ms_novo" is not null and "lancamento"."tempo_ms_anterior" is not null) or
        ("lancamento"."tipo" = 'ausencia'  and "lancamento"."tempo_ms_novo" is null     and "lancamento"."tempo_ms_anterior" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "operador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario" text NOT NULL,
	"nome" text NOT NULL,
	"senha_hash" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operador_usuario_unique" UNIQUE("usuario")
);
--> statement-breakpoint
CREATE TABLE "participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"sobrenome" text NOT NULL,
	"email" text NOT NULL,
	"telefone" text NOT NULL,
	"idade" smallint NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participante_idade_minima" CHECK ("participante"."idade" >= 13),
	CONSTRAINT "participante_idade_plausivel" CHECK ("participante"."idade" <= 120),
	CONSTRAINT "participante_telefone_digitos" CHECK ("participante"."telefone" ~ '^[0-9]{10,11}$')
);
--> statement-breakpoint
CREATE TABLE "responsavel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"sobrenome" text NOT NULL,
	"telefone" text NOT NULL,
	CONSTRAINT "responsavel_participante_id_unique" UNIQUE("participante_id"),
	CONSTRAINT "responsavel_telefone_digitos" CHECK ("responsavel"."telefone" ~ '^[0-9]{10,11}$')
);
--> statement-breakpoint
CREATE TABLE "tentativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participante_id" uuid NOT NULL,
	"pitch" smallint NOT NULL,
	"estado" "estado_tentativa" DEFAULT 'pendente' NOT NULL,
	"tempo_ms" integer,
	"inscrito_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvido_em" timestamp with time zone,
	"operador_id" uuid,
	CONSTRAINT "tentativa_participante_pitch_unica" UNIQUE("participante_id","pitch"),
	CONSTRAINT "tentativa_pitch_valido" CHECK ("tentativa"."pitch" in (1, 2)),
	CONSTRAINT "tentativa_tempo_coerente_com_estado" CHECK (("tentativa"."estado" = 'valida') = ("tentativa"."tempo_ms" is not null)),
	CONSTRAINT "tentativa_tempo_positivo" CHECK ("tentativa"."tempo_ms" is null or "tentativa"."tempo_ms" > 0),
	CONSTRAINT "tentativa_autoria_coerente_com_estado" CHECK (("tentativa"."estado" = 'pendente') = ("tentativa"."operador_id" is null)),
	CONSTRAINT "tentativa_resolucao_coerente_com_estado" CHECK (("tentativa"."estado" = 'pendente') = ("tentativa"."resolvido_em" is null))
);
--> statement-breakpoint
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_participante_id_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participante"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_tentativa_id_tentativa_id_fk" FOREIGN KEY ("tentativa_id") REFERENCES "public"."tentativa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsavel" ADD CONSTRAINT "responsavel_participante_id_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participante"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_participante_id_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participante"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chave_idempotencia_criado_em_idx" ON "chave_idempotencia" USING btree ("criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "chave_idempotencia_escopo_idx" ON "chave_idempotencia" USING btree ("chave","escopo");--> statement-breakpoint
CREATE INDEX "lancamento_tentativa_idx" ON "lancamento" USING btree ("tentativa_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "participante_nome_idx" ON "participante" USING btree (lower("nome") text_pattern_ops);--> statement-breakpoint
CREATE INDEX "participante_sobrenome_idx" ON "participante" USING btree (lower("sobrenome") text_pattern_ops);--> statement-breakpoint
CREATE INDEX "tentativa_fila_idx" ON "tentativa" USING btree ("pitch","estado","inscrito_em");--> statement-breakpoint
CREATE INDEX "tentativa_classificacao_idx" ON "tentativa" USING btree ("tempo_ms","resolvido_em");