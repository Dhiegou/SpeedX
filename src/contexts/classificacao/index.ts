/**
 * BC-03 — Classificação.
 *
 * Responsabilidade: produzir e servir a ordenação pública das Tentativas Válidas.
 *
 * Este contexto opera sobre **Nome Público** — um conceito que não existe em
 * Inscrição. A tradução acontece na fronteira, uma única vez, em
 * `nomePublico.ts`: maior de idade sai por extenso ("Dhiego Ferreira"), menor
 * de 18 sai com a inicial ("Lucas M.") — RNF-09, ver D-21 no `CONTEXT.md`.
 *
 * O modelo deste lado não tem e-mail, telefone, idade nem dado de Responsável,
 * e é por isso que RNF-08 não depende de disciplina de código. A idade entra
 * apenas na projeção, para decidir o formato do nome, e não sai de lá.
 *
 * O lint impede que este diretório importe qualquer outro contexto ou o banco;
 * a única exceção é `projecao.ts`, a fronteira onde a tradução acontece.
 *
 * Implementado em T12: `projecao.ts` constrói o documento e `documento.ts`
 * decide o que dele atravessa a rede — que é menos do que o modelo interno tem,
 * por tamanho e por privacidade.
 */

export type { DocumentoClassificacao, LinhaClassificacao, Cockpit } from './modelo'
export type { DocumentoTransmitido, LinhaCompacta } from './documento'
export { compactar, etiquetaDe } from './documento'
export type { OpcoesNomePublico } from './nomePublico'
export { deveAbreviarSobrenome, IDADE_MAIORIDADE, paraNomePublico } from './nomePublico'
