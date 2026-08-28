/**
 * BC-01 — Inscrição.
 *
 * Responsabilidade: estabelecer que uma pessoa existe no evento, com identidade
 * suficiente para ser distinguida de homônimos e com base legal para o
 * tratamento dos seus dados.
 *
 * A regra dominante aqui é jurídica, não atlética: a idade é o discriminador
 * que decide qual conjunto de obrigações se aplica ao registro. Um Participante
 * de 17 anos e um de 18 são objetos com invariantes diferentes.
 *
 * Invariantes (SDD BC-01):
 *  - nenhum Participante existe sem Consentimento registrado (RF-08)
 *  - nenhum Participante menor de 18 existe sem Responsável completo (RF-06, RNF-07)
 *  - idade inferior a 13 não produz Participante (RF-04)
 *  - toda Inscrição declara ao menos um Cockpit (RF-03)
 *
 * Este módulo é a fachada pública do contexto: termo de consentimento (T03),
 * regra e caso de uso da Inscrição (T04) e a borda de rede (T05).
 */

/** Regra e caso de uso da Inscrição (T04). */
export { esquemaInscricao, IDADE_MAIORIDADE, IDADE_MAXIMA, IDADE_MINIMA } from './schema'
export type { EntradaInscricao, Inscricao, Responsavel } from './schema'
export { InscricaoInvalidaError, paraErrosDeValidacao } from './erros'
export type { CodigoErro, ErroDeValidacao } from './erros'
export { registrarInscricao, validarInscricao } from './registrarInscricao'
export type { InscricaoRegistrada } from './registrarInscricao'

/** Borda: idempotência, limite de taxa e anti-automação (T05). */
export { CAMPO_HONEYPOT, CAMPO_TOKEN, submeterInscricao } from './submeterInscricao'
export type { ComandoInscricao, RespostaInscricao, ResultadoSubmissao } from './submeterInscricao'
export { submeter } from './servico'
export { emitirTokenFormulario, verificarTokenFormulario } from './tokenFormulario'
export type { ExameDoToken, VereditoToken } from './tokenFormulario'
export { ESCOPO_CADASTRO } from './limiteDeTaxa'

/**
 * Contingência em papel (T20). A ficha impressa coleta os mesmos campos que a
 * tela porque a digitação posterior passa pelo mesmo caso de uso (RNF-13).
 */
export {
  CAMPO_COCKPITS,
  CAMPOS_DO_PARTICIPANTE,
  CAMPOS_DO_RESPONSAVEL,
  CHAVES_DA_FICHA,
} from './ficha'
export type { CampoDaFicha } from './ficha'

/**
 * Termo de consentimento (T03). A base legal do contexto é artefato versionado,
 * não texto de rodapé: ver `./consentimento`.
 */
export {
  assegurarTermoAprovado,
  LINK_TERMO,
  ROTA_TERMO,
  SECOES_OBRIGATORIAS,
  TERMO_VIGENTE,
  TERMOS_PUBLICADOS,
  termoEstaAprovado,
} from './consentimento'
export type {
  Bloco,
  Secao,
  SecaoId,
  SecaoObrigatoria,
  SituacaoTermo,
  TermoConsentimento,
} from './consentimento'
