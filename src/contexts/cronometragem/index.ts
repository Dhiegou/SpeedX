/**
 * BC-02 — Cronometragem.
 *
 * Responsabilidade: registrar o desfecho da participação de uma pessoa em um
 * Cockpit, e manter a rastreabilidade de quem registrou o quê.
 *
 * É o único contexto com escrita sob pressão de tempo real e com operador
 * humano no caminho crítico. Seus requisitos são de ergonomia e integridade,
 * não de validação de entrada.
 *
 * Agregado raiz: Tentativa. Nasce Pendente na Inscrição e transiciona para
 * Válida ou Ausente:
 *
 *   Pendente ──lançar tempo──▶ Válida ──corrigir──▶ Válida
 *       │                        ▲
 *       └──marcar ausência──▶ Ausente┘  (lançar tempo)
 *
 * Invariantes (SDD BC-02), e onde cada uma é garantida:
 *  - no máximo uma Tentativa por Participante por Cockpit (RF-25) — `UNIQUE` no
 *    banco, traduzido para mensagem de negócio em `adicionarTentativa`;
 *  - Tentativa Válida sempre possui Tempo; Pendente e Ausente nunca possuem
 *    (RF-21) — `CHECK` no banco, e a máquina de estados nunca tenta o contrário;
 *  - toda transição registra Operador e instante do servidor (RF-23) — `CHECK`
 *    no banco e uma linha em `lancamento` por transição.
 *
 * Alcança Inscrição apenas por `@/contexts/inscricao/contrato`, e usa Identidade
 * apenas pelo conceito de Operador autenticado (Open Host, SDD §2). O lint
 * recusa qualquer outro caminho.
 *
 * Como em Inscrição, os casos de uso recebem o banco por parâmetro e quem os
 * liga à conexão real é `servico.ts` — é o que permite testá-los contra
 * Postgres de verdade sem subir servidor.
 */

export type {
  EstadoDaTentativa,
  ItemDaFila,
  LancamentoRegistrado,
  ParticipanteEncontrado,
  TentativaDoParticipante,
  TentativaResolvida,
  TipoDeLancamento,
} from './modelo'

export { permite, explicarRecusa, TRANSICOES, type Acao } from './maquinaDeEstados'

export {
  corrigirTempo,
  marcarAusente,
  registrarTempo,
  ESCOPO_LANCAMENTO,
  type ComandoDeLancamento,
  type ResultadoDeLancamento,
} from './lancamento'

export {
  adicionarTentativa,
  type ComandoDeInclusao,
  type ResultadoDeInclusao,
} from './adicionarTentativa'

export {
  buscarParticipantes,
  contarPendentes,
  estadoDaTentativa,
  historicoDaTentativa,
  listarFila,
  LIMITE_DA_BUSCA,
  LIMITE_DA_FILA,
  type Pagina,
} from './consultas'

export { normalizar, padraoDeBusca } from './busca'
