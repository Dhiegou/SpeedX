import type { Pitch } from '@/contexts/inscricao/contrato'

/**
 * O vocabulário de BC-02, em tipos.
 *
 * Nada aqui conhece HTTP, banco ou tela. É o que a T10 traduz para JSON e a
 * T11 desenha.
 */

/** Estado da Tentativa (SDD BC-02). Fechado: o `switch` que o percorre é exaustivo. */
export type EstadoDaTentativa = 'pendente' | 'valida' | 'ausente'

/**
 * O **ato** de registrar um Tempo, não o valor (SDD §3). RF-23 rastreia
 * Lançamentos.
 */
export type TipoDeLancamento = 'registro' | 'correcao' | 'ausencia'

/** A Tentativa como o painel a enxerga depois de uma transição. */
export type TentativaResolvida = {
  readonly id: string
  readonly participanteId: string
  readonly pitch: Pitch
  readonly estado: EstadoDaTentativa
  /** Milissegundos. Presente se e somente se o estado for `valida`. */
  readonly tempoMs: number | null
  /**
   * Instante do Lançamento **original**, do relógio do servidor.
   *
   * É o critério de desempate de RF-31, e por isso a correção de tempo não o
   * altera (RF-22): senão um acerto administrativo mudaria a posição de
   * terceiros no pódio.
   */
  readonly resolvidoEm: Date | null
  readonly operadorId: string | null
}

/**
 * Uma linha da Fila (RF-14, RF-15).
 *
 * Carrega o mínimo para o Operador distinguir dois homônimos e nada além disso.
 * Os quatro últimos dígitos do telefone são derivados **aqui, no servidor** — o
 * número completo não atravessa a fronteira do contexto (SDD §2).
 */
export type ItemDaFila = {
  readonly tentativaId: string
  readonly participanteId: string
  readonly nome: string
  readonly sobrenome: string
  readonly ultimos4Telefone: string
  readonly inscritoEm: Date
}

/** Uma entrada da trilha de auditoria (RF-23). */
export type LancamentoRegistrado = {
  readonly id: string
  readonly tipo: TipoDeLancamento
  readonly tempoMsAnterior: number | null
  readonly tempoMsNovo: number | null
  readonly operadorId: string
  readonly operadorNome: string
  readonly ocorridoEm: Date
}

/** Uma Tentativa vista pela busca global: o que o Operador precisa decidir. */
export type TentativaDoParticipante = {
  readonly tentativaId: string
  readonly pitch: Pitch
  readonly estado: EstadoDaTentativa
  readonly tempoMs: number | null
  readonly resolvidoEm: Date | null
}

/**
 * Uma pessoa achada pela busca global (T10), com suas Tentativas nos dois
 * Pitches.
 *
 * Existe porque a Fila só mostra quem ainda não correu — e RF-22 e RF-24 tratam
 * justamente de quem saiu dela. Carrega o mesmo tanto de dado pessoal que a
 * Fila: nome, sobrenome e quatro dígitos. Nada mais atravessa daqui para o
 * painel.
 */
export type ParticipanteEncontrado = {
  readonly participanteId: string
  readonly nome: string
  readonly sobrenome: string
  readonly ultimos4Telefone: string
  readonly tentativas: readonly TentativaDoParticipante[]
}
