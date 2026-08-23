/**
 * Normalização de texto para busca.
 *
 * Nasceu dentro de Cronometragem em T10, para a busca do painel. Sai de lá em
 * T13 pelo mesmo motivo que o limite de taxa saiu em T08 e a idempotência em
 * T09: a Classificação precisa da mesma regra e **não pode** importar
 * Cronometragem — o lint recusa, e o SDD §2 é a razão.
 *
 * Vai para `shared/` e não para `infra/` porque não toca o banco: é
 * transformação de cadeia, sem dependência nenhuma. É exatamente o que
 * `shared/` existe para guardar.
 *
 * **Por que os dois lados precisam da mesma função.** No painel a comparação
 * acontece no Postgres, com `translate`; na Classificação acontece no
 * navegador, em JavaScript. Se as duas divergirem, o mesmo nome digitado acha
 * a pessoa num lugar e não acha no outro — e quem procura a própria posição na
 * arquibancada não tem a quem perguntar.
 */

/**
 * O mapa de acentos, escrito uma vez.
 *
 * As duas cadeias precisam ter o mesmo comprimento e a mesma ordem. Ficam
 * juntas aqui, e não repetidas no SQL e no TypeScript, porque uma divergência
 * entre os dois lados faria a busca falhar exatamente nos nomes acentuados —
 * que são 34% da massa deste evento.
 */
export const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñ'
export const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn'

/** Falha alto no boot se alguém editar uma cadeia e esquecer a outra. */
if (COM_ACENTO.length !== SEM_ACENTO.length) {
  throw new Error('texto.ts: os mapas de acento têm comprimentos diferentes.')
}

/**
 * Minúsculas e sem acento.
 *
 * Precisa casar com `translate(lower(coluna), COM_ACENTO, SEM_ACENTO)` do lado
 * do Postgres — é a mesma tabela de tradução, aplicada caractere a caractere.
 */
export function normalizar(texto: string): string {
  const minusculo = texto.toLowerCase()
  let saida = ''

  for (const caractere of minusculo) {
    const posicao = COM_ACENTO.indexOf(caractere)
    saida += posicao === -1 ? caractere : SEM_ACENTO[posicao]
  }

  return saida
}
