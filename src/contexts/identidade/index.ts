/**
 * BC-04 — Identidade e Acesso.
 *
 * Responsabilidade: autenticar Operadores e fornecer sua identidade aos demais
 * contextos.
 *
 * É genérico e substituível: não contém regra do domínio de corrida. Isolá-lo
 * permite que Cronometragem dependa apenas do conceito de "Operador
 * autenticado", sem conhecer o mecanismo.
 *
 * Invariantes (SDD BC-04):
 *  - não existe criação pública de conta (RNF-14) — `criarOperador` só é
 *    alcançável pelo CLI de `scripts/criar-operador.ts`, e nenhuma rota o
 *    importa;
 *  - múltiplas sessões simultâneas de Operadores distintos são permitidas
 *    (RF-12) — e as do mesmo Operador também, porque dois tablets no mesmo
 *    Pitch é o uso previsto.
 *
 * **A fachada exporta o tipo, e só.** Quem precisa da sessão — as rotas e o
 * layout do painel — importa `@/contexts/identidade/servico` diretamente, do
 * mesmo jeito que a rota de cadastro importa `inscricao/servico`. Manter
 * `next/headers` fora daqui é o que permite a Cronometragem depender do
 * conceito de Operador sem arrastar o mecanismo junto, que é o ponto inteiro
 * deste contexto no SDD.
 */

export type { Operador } from './modelo'
