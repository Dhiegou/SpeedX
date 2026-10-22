-- D-112: o número de inscrição, para a pessoa se achar entre homônimos.
--
-- Identity `GENERATED ALWAYS`, e não número derivado de `criado_em`: a exclusão a
-- pedido renumeraria todo mundo depois de quem saiu. A sequência nunca devolve
-- um número já entregue, e o banco recusa valor escrito à mão e `UPDATE`.
--
-- As linhas que já existem recebem número na própria execução do `ADD COLUMN`,
-- porque a coluna é `NOT NULL`. É a base de teste de antes do evento.
--
-- Rodar com a string **direta** do Neon (`DATABASE_URL_UNPOOLED`), nunca a do
-- pooler: `docs/deploy.md` §3.
ALTER TABLE "participante" ADD COLUMN "numero" integer NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "participante_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_numero_unico" UNIQUE("numero");