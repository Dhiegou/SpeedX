-- T22: "Pitch" era o nome errado desde o começo (D-75, D-77). A palavra na tela
-- virou Cockpit em 2026-08-25; esta migração faz a coluna acompanhar.
--
-- RENAME, e não DROP + ADD: o drizzle-kit pergunta qual dos dois quando vê uma
-- coluna sumir e outra aparecer, e a pergunta não tem resposta automática. A
-- diferença entre as duas respostas é a base inteira de Tentativas.
--
-- O índice "tentativa_fila_idx" não aparece aqui de propósito: o nome dele não
-- carrega a palavra, e a coluna indexada acompanha o RENAME sozinha.
ALTER TABLE "tentativa" RENAME COLUMN "pitch" TO "cockpit";--> statement-breakpoint
ALTER TABLE "tentativa" RENAME CONSTRAINT "tentativa_participante_pitch_unica" TO "tentativa_participante_cockpit_unica";--> statement-breakpoint
ALTER TABLE "tentativa" RENAME CONSTRAINT "tentativa_pitch_valido" TO "tentativa_cockpit_valido";
