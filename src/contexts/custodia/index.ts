/**
 * BC-05 — Custódia de Dados.
 *
 * Responsabilidade: exportação completa, retenção e exclusão.
 *
 * É o **único** contexto autorizado a reunir dados pessoais de Inscrição com
 * resultados de Cronometragem no mesmo documento. Essa autorização precisa ser
 * um ponto único, nomeado e auditável — não uma capacidade difusa. Por isso o
 * lint permite a este diretório, e só a ele, importar os dois lados.
 *
 * Também tem ciclo de vida distinto: sua atividade principal ocorre depois que
 * todos os outros contextos já pararam.
 *
 * Implementação em T14 (exportação) e T15 (retenção e exclusão).
 */

export {}
