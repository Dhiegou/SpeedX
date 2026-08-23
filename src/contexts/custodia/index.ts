/**
 * BC-05 — Custódia de Dados.
 *
 * Responsabilidade: exportação completa, retenção e exclusão.
 *
 * É o **único** contexto autorizado a reunir dados pessoais de Inscrição com
 * resultados de Cronometragem no mesmo documento. Essa autorização precisa ser
 * um ponto único, nomeado e auditável — não uma capacidade difusa. Por isso o
 * lint permite a este diretório, e só a ele, importar os dois lados, e
 * `tests/fronteiras.test.ts` falha se a permissão vazar.
 *
 * Também tem ciclo de vida distinto: sua atividade principal ocorre depois que
 * todos os outros contextos já pararam.
 *
 * **Três saídas, e a separação é a regra.** A lista de repasse poderia ser uma
 * coluna da exportação completa, filtrada na planilha do outro lado — e aí o
 * telefone de quem recusou o repasse já teria saído daqui. O termo promete que
 * o telefone só vai para quem autorizou (D-23); a promessa só se cumpre se o
 * filtro estiver na consulta.
 *
 * Exportação implementada em T14; retenção e exclusão em T15.
 */

export { ehTipoValido, nomeDe, TIPOS, type TipoDeExportacao } from './exportacao'

export type { LinhaDaExportacao, LinhaDeRepasse, Pendencia } from './consultas'
