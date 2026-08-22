/**
 * As três idades que decidem tudo em BC-01.
 *
 * Vivem num módulo próprio, sem nenhuma dependência, por um motivo de rede: o
 * formulário de T06 precisa saber quando exibir o bloco do responsável já na
 * primeira pintura, e importar isso de `schema.ts` arrastaria o Zod inteiro
 * para o pacote inicial da única página que duas mil pessoas vão carregar em
 * rede móvel congestionada (RNF-04).
 *
 * `schema.ts` reexporta as três, então nada fora daqui precisa saber que a
 * separação existe.
 */

/**
 * Idade a partir da qual não se exige Responsável (RF-05, RNF-07).
 *
 * Existe uma constante de mesmo nome e mesmo valor em
 * `classificacao/nomePublico.ts`, onde decide se o sobrenome é publicado por
 * extenso (RNF-09). A duplicação é imposta pela arquitetura: o lint proíbe um
 * contexto de importar o outro, e é essa proibição que sustenta RNF-08. Se um
 * dia a maioridade mudar, os dois arquivos mudam juntos.
 */
export const IDADE_MAIORIDADE = 18

/** Idade mínima para participar (RF-04). */
export const IDADE_MINIMA = 13

/** Teto plausível. Protege contra digitação errada, não contra longevidade. */
export const IDADE_MAXIMA = 99
