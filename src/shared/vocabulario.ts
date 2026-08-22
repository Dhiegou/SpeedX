/**
 * Palavras que o participante lê na tela.
 *
 * Existe por causa de uma pendência concreta: o organizador ainda não confirmou
 * se o termo oficial é **Pitch** ou **Pista** (PE-01). A decisão bloqueia o
 * congelamento da copy de T06, T11 e T13 — e a forma de não ficar bloqueado é
 * escrever a palavra num lugar só.
 *
 * Não é internacionalização. É uma pendência com data para acabar, guardada
 * onde a resposta custa uma linha em vez de uma varredura por três telas.
 *
 * O gênero acompanha a palavra de propósito: "o Pitch" e "a Pista" concordam
 * diferente, e uma constante só com o substantivo deixaria "escolha o Pista"
 * espalhado pela interface no dia da troca.
 */
export const PISTA = {
  singular: 'Pitch',
  plural: 'Pitches',
  /** Artigo definido: `o` para Pitch, `a` para Pista. */
  artigo: 'o',
  /** Artigo indefinido: `um` para Pitch, `uma` para Pista. */
  artigoIndefinido: 'um',
  /** Concordância de particípio e adjetivo: `escolhido` / `escolhida`. */
  terminacao: 'o',
  /** `os dois` / `as duas` — são sempre duas pistas (premissa P-03). */
  ambas: 'os dois',
  /** `nos dois` / `nas duas`. */
  emAmbas: 'nos dois',
} as const

/** `Pitch 1`, `Pitch 2` — o rótulo de um dos dois. */
export function nomeDaPista(numero: number): string {
  return `${PISTA.singular} ${String(numero)}`
}
