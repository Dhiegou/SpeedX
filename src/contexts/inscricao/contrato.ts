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

/**
 * O Cockpit do evento. **Um só desde 2026-10-19** (D-107).
 *
 * A coluna `tentativa.cockpit` ficou, e toda Tentativa nasce com este valor.
 * Com ele fixo, a unicidade `(participante_id, cockpit)` passa a dizer "uma
 * Tentativa por Participante", que é a regra do evento (RF-25). Ninguém escolhe
 * Cockpit: nem o participante no formulário, nem o Operador no painel.
 */
export const COCKPIT_UNICO = 1

export type Cockpit = typeof COCKPIT_UNICO

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
  inscritoEm: Date
}
