import type { EstadoDaTentativa, TipoDeLancamento } from './modelo'

/**
 * A máquina de estados da Tentativa (SDD BC-02), como dado.
 *
 * ```
 * Pendente ──registrar──▶ Válida ──corrigir──▶ Válida
 *     │                     ▲
 *     └──ausentar──▶ Ausente┘   (registrar)
 * ```
 *
 * Escrita como tabela e não como uma sequência de `if`, por dois motivos. O
 * primeiro é que ela é a especificação: quem quiser saber de onde para onde uma
 * Tentativa anda lê seis linhas em vez de rastrear ramos por três arquivos. O
 * segundo é que assim ela é **testável sem banco** — as regras que decidem
 * quais transições existem não precisam de transação para serem verificadas.
 *
 * Este módulo não toca no banco, não conhece Operador e não sabe o que é uma
 * chave de idempotência. Ele responde uma pergunta só: esta ação é possível a
 * partir deste estado?
 */

/** O que o Operador pede. Não confundir com `TipoDeLancamento`, que é o registro. */
export type Acao = 'registrar' | 'corrigir' | 'ausentar'

export type Transicao = {
  readonly acao: Acao
  /** Estados a partir dos quais a ação é possível. */
  readonly origens: readonly EstadoDaTentativa[]
  readonly destino: EstadoDaTentativa
  readonly tipoDeLancamento: TipoDeLancamento
  /** Se a ação carrega um Tempo. `ausentar` não carrega. */
  readonly exigeTempo: boolean
  /**
   * Se a ação carimba `resolvido_em`.
   *
   * `corrigir` **não** carimba, e é a regra mais fácil de quebrar sem perceber:
   * `resolvido_em` é o desempate de RF-31, e mexer nele numa correção mudaria a
   * posição de terceiros que nada têm a ver com o erro de digitação.
   *
   * `registrar` carimba mesmo vindo de `ausente`, porque aí o Lançamento
   * original é aquele — marcar ausência não é registrar Tempo.
   */
  readonly carimbaResolucao: boolean
}

export const TRANSICOES: Readonly<Record<Acao, Transicao>> = {
  registrar: {
    acao: 'registrar',
    // Inclui `ausente` de propósito: quem foi dado como ausente e apareceu
    // depois corre e tem o tempo lançado direto, sem voltar para a Fila.
    origens: ['pendente', 'ausente'],
    destino: 'valida',
    tipoDeLancamento: 'registro',
    exigeTempo: true,
    carimbaResolucao: true,
  },
  corrigir: {
    acao: 'corrigir',
    origens: ['valida'],
    destino: 'valida',
    tipoDeLancamento: 'correcao',
    exigeTempo: true,
    carimbaResolucao: false,
  },
  ausentar: {
    acao: 'ausentar',
    // Só de `pendente`. Marcar ausente quem já tem Tempo apagaria um resultado
    // medido, e a saída para isso não é esta ação — é a correção.
    origens: ['pendente'],
    destino: 'ausente',
    tipoDeLancamento: 'ausencia',
    exigeTempo: false,
    carimbaResolucao: true,
  },
} as const

export function permite(acao: Acao, estadoAtual: EstadoDaTentativa): boolean {
  return TRANSICOES[acao].origens.includes(estadoAtual)
}

const NOME_DO_ESTADO: Readonly<Record<EstadoDaTentativa, string>> = {
  pendente: 'ainda não tem tempo lançado',
  valida: 'já tem tempo lançado',
  ausente: 'está marcada como ausente',
}

/**
 * Por que a transição foi recusada, em português que o Operador entende.
 *
 * A mensagem vai para a tela de quem está com fila de gente esperando: precisa
 * dizer o que aconteceu **e** o que fazer, sem vocabulário de máquina de
 * estados. "Transição inválida de valida para valida" não ajuda ninguém.
 */
export function explicarRecusa(acao: Acao, estadoAtual: EstadoDaTentativa): string {
  if (acao === 'registrar' && estadoAtual === 'valida') {
    return 'Esta tentativa já tem um tempo registrado. Para trocar o valor, use a correção.'
  }

  if (acao === 'corrigir') {
    return estadoAtual === 'ausente'
      ? 'Esta tentativa está marcada como ausente e não tem tempo a corrigir. Registre o tempo direto.'
      : 'Esta tentativa ainda não tem tempo registrado. Registre o tempo em vez de corrigir.'
  }

  if (acao === 'ausentar' && estadoAtual === 'valida') {
    return 'Esta tentativa já tem um tempo registrado e não pode ser marcada como ausente.'
  }

  return `Esta tentativa ${NOME_DO_ESTADO[estadoAtual]} e a operação não se aplica.`
}
