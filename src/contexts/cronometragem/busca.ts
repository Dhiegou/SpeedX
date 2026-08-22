import { sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/**
 * Normalização de nome para busca (RF-16).
 *
 * O painel precisa achar "João" quando o Operador digita "joao", e achar
 * "Assumpção Neto" quando ele digita "neto". Duas exigências, e a segunda é a
 * que decide a forma: **busca por trecho, não por prefixo**. Sobrenome composto
 * é a regra no Brasil, e o nome que a pessoa fala em voz alta na fila costuma
 * ser o último, não o primeiro.
 *
 * A T02 adiara a decisão sobre busca no meio do nome para cá, quando o banco
 * estivesse escolhido. Está: PostgreSQL 18, e a medição contra a massa real de
 * 2000 participantes desempatou sozinha —
 *
 * | forma | custo |
 * |---|---|
 * | prefixo, com os índices `text_pattern_ops` | 77 buffers |
 * | trecho, sem índice nenhum | **73 buffers** |
 *
 * Nesta escala o índice não compra nada: a busca do índice economiza duas
 * páginas e a leitura do heap paga as outras vinte e oito de qualquer jeito.
 * `pg_trgm` seria uma extensão a instalar, um índice GIN a manter e uma
 * dependência de infraestrutura a mais no dia do evento — para ganhar nada
 * mensurável em 2000 linhas.
 *
 * **Quando isto deixa de valer:** se a massa crescer uma ordem de grandeza. O
 * remédio nesse dia é `pg_trgm` com índice GIN sobre a mesma expressão daqui.
 * T18 mede; até lá, o simples é o certo.
 *
 * **Por que `translate` e não `unaccent`:** `unaccent` é extensão, não vem no
 * PGlite e não é `IMMUTABLE` sem um embrulho. `translate` é função de núcleo,
 * roda igual nos dois motores e pode entrar num índice se um dia precisar.
 */

/**
 * O mapa de acentos, escrito uma vez.
 *
 * As duas cadeias precisam ter o mesmo comprimento e a mesma ordem, e é por
 * isso que elas ficam aqui juntas em vez de repetidas no SQL e no TypeScript:
 * uma divergência entre os dois lados faria a busca falhar exatamente nos
 * nomes acentuados, que são 34% da massa.
 */
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñ'
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn'

/** Falha alto no boot se alguém editar uma cadeia e esquecer a outra. */
if (COM_ACENTO.length !== SEM_ACENTO.length) {
  throw new Error('busca.ts: os mapas de acento têm comprimentos diferentes.')
}

/** Normaliza no lado do TypeScript. Precisa casar com `normalizarNoBanco`. */
export function normalizar(texto: string): string {
  const minusculo = texto.toLowerCase()
  let saida = ''

  for (const caractere of minusculo) {
    const posicao = COM_ACENTO.indexOf(caractere)
    saida += posicao === -1 ? caractere : SEM_ACENTO[posicao]
  }

  return saida
}

/** A mesma normalização, do lado do banco. */
export function normalizarNoBanco(coluna: PgColumn): SQL<string> {
  return sql<string>`translate(lower(${coluna}), ${COM_ACENTO}, ${SEM_ACENTO})`
}

/**
 * Escapa o que o `LIKE` interpreta.
 *
 * Sem isto, um Operador que digitasse `%` veria a lista inteira e um `_`
 * casaria qualquer letra. Não é injeção — o valor vai parametrizado —, é o
 * curinga do próprio operador de comparação fazendo a busca mentir.
 */
function escaparLike(texto: string): string {
  return texto.replace(/([\\%_])/g, '\\$1')
}

/**
 * Termo digitado → padrão de `LIKE`, ou `null` quando não há o que buscar.
 *
 * Busca vazia devolve `null`, e quem chama entende como "sem filtro" — a Fila
 * inteira. É o comportamento que o Operador espera ao apagar o campo.
 */
export function padraoDeBusca(termo: string | undefined): string | null {
  const limpo = (termo ?? '').trim()

  if (limpo === '') return null

  return `%${escaparLike(normalizar(limpo))}%`
}
