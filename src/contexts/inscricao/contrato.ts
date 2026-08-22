/**
 * Contrato publicado por Inscrição para Cronometragem (relação Customer/Supplier, SDD §2).
 *
 * É o **único** ponto por onde Cronometragem enxerga Inscrição — o lint impede
 * qualquer outro import entre os dois contextos. O que não estiver declarado
 * aqui, o painel não vê.
 *
 * Note o que está ausente: e-mail, idade, telefone completo e qualquer dado de
 * Responsável. O painel precisa distinguir homônimos (RF-15), não conhecer a
 * pessoa. Os últimos quatro dígitos do telefone são derivados no servidor, e o
 * número completo nunca atravessa esta fronteira.
 *
 * Implementação em T04/T09.
 */

/** Uma das duas pistas do evento. Atributo da Tentativa, nunca do Participante. */
export type Pitch = 1 | 2

/** Identidade mínima para o Operador distinguir duas pessoas na Fila (RF-15). */
export type ParticipanteNaFila = {
  participanteId: string
  nome: string
  sobrenome: string
  /** Somente os quatro últimos dígitos. O telefone completo não cruza esta fronteira. */
  ultimos4Telefone: string
}

/** Evento publicado quando uma Inscrição é confirmada. Não carrega dado pessoal. */
export type InscricaoConfirmada = {
  participanteId: string
  pitches: readonly Pitch[]
  inscritoEm: Date
}
