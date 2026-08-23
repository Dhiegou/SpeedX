import type { LinhaCompacta, Pitch } from '@/contexts/classificacao'
import { normalizar } from '@/shared/texto'

/**
 * O que a página da Classificação faz com o documento (T13).
 *
 * Tudo aqui roda **no dispositivo**, sobre o documento já baixado. Nenhuma
 * dessas funções volta ao servidor, e é deliberado: uma requisição por tecla
 * digitada, com 2000 pessoas buscando ao mesmo tempo, é o cenário que derruba o
 * sistema (SDD BC-03, T12 escopo 5).
 *
 * Está fora do componente pelo mesmo motivo do painel: a renumeração de RF-29 e
 * a regra de vizinhança de RF-30 são decisões testáveis sem DOM, e testá-las
 * assim é mais barato e mais confiável do que procurá-las na tela.
 */

/** Uma linha pronta para a tabela. `posicao` é calculada, nunca persistida. */
export type LinhaExibida = {
  readonly posicao: number
  readonly nomePublico: string
  readonly pitch: Pitch
  readonly tempoMs: number
  /** Índice no conjunto filtrado. Serve de chave estável de renderização. */
  readonly indice: number
}

export type FiltroDePitch = 'todos' | Pitch

/**
 * Aplica o filtro de Pitch e **renumera a partir de 1** (RF-29).
 *
 * A posição não é atributo persistido — é calculada na apresentação (SDD §3).
 * É o que torna correto dizer "3º no Pitch 2" para quem é 47º no geral: são
 * duas perguntas diferentes, e a segunda é a que a pessoa faz.
 */
export function classificar(
  linhas: readonly LinhaCompacta[],
  pitch: FiltroDePitch,
): readonly LinhaExibida[] {
  const escolhidas = pitch === 'todos' ? linhas : linhas.filter(([, p]) => p === pitch)

  return escolhidas.map(([nomePublico, p, tempoMs], indice) => ({
    posicao: indice + 1,
    nomePublico,
    pitch: p,
    tempoMs,
    indice,
  }))
}

/** Índices das linhas que casam o termo, sem acento e sem caixa (RF-30). */
export function encontrar(linhas: readonly LinhaExibida[], termo: string): ReadonlySet<number> {
  const alvo = normalizar(termo.trim())

  if (alvo === '') return new Set()

  const achados = new Set<number>()

  for (const linha of linhas) {
    if (normalizar(linha.nomePublico).includes(alvo)) achados.add(linha.indice)
  }

  return achados
}

/**
 * Um pedaço da tabela: linhas seguidas, ou o buraco entre dois pedaços.
 *
 * A lacuna é renderizada como uma faixa dizendo quantas posições foram puladas.
 * Sem ela, duas linhas distantes apareceriam grudadas e a tabela mentiria sobre
 * a distância entre elas.
 */
export type Bloco =
  | { readonly tipo: 'linhas'; readonly linhas: readonly LinhaExibida[] }
  | { readonly tipo: 'lacuna'; readonly quantidade: number }

/** Quantas vizinhas acompanham cada resultado da busca. */
export const VIZINHAS = 2

/**
 * Monta o que a tabela mostra.
 *
 * **Sem busca:** as primeiras `limite` linhas. RF-33 exige que as posições 1 a
 * 100 apareçam sem interação nenhuma, e que a 101 seja alcançável — daí o
 * limite crescer por botão, sobre o documento que já está em memória.
 *
 * **Com busca:** cada resultado vem cercado das vizinhas (RF-30). A task é
 * explícita: destacar, "não apenas filtrado — a pessoa quer ver a própria linha
 * no contexto das vizinhas". Uma lista só com os casamentos responderia "você é
 * o 437º" e esconderia quem está em 436 e 438, que é metade da graça.
 */
export function montarBlocos(
  linhas: readonly LinhaExibida[],
  achados: ReadonlySet<number>,
  limite: number,
): readonly Bloco[] {
  if (achados.size === 0) {
    const visiveis = linhas.slice(0, limite)
    const blocos: Bloco[] = visiveis.length > 0 ? [{ tipo: 'linhas', linhas: visiveis }] : []

    return blocos
  }

  // Cada resultado arrasta suas vizinhas; faixas que se tocam viram uma só.
  const manter = new Set<number>()

  for (const indice of achados) {
    for (let i = indice - VIZINHAS; i <= indice + VIZINHAS; i += 1) {
      if (i >= 0 && i < linhas.length) manter.add(i)
    }
  }

  const ordenados = [...manter].sort((a, b) => a - b)
  const blocos: Bloco[] = []
  let atual: LinhaExibida[] = []
  let anterior: number | null = null

  for (const indice of ordenados) {
    const linha = linhas[indice]
    if (linha === undefined) continue

    if (anterior !== null && indice > anterior + 1) {
      blocos.push({ tipo: 'linhas', linhas: atual })
      blocos.push({ tipo: 'lacuna', quantidade: indice - anterior - 1 })
      atual = []
    }

    atual.push(linha)
    anterior = indice
  }

  if (atual.length > 0) blocos.push({ tipo: 'linhas', linhas: atual })

  return blocos
}

/** Quantas linhas os blocos somam. Usado para dizer se ainda há mais. */
export function contarLinhas(blocos: readonly Bloco[]): number {
  return blocos.reduce((total, b) => (b.tipo === 'linhas' ? total + b.linhas.length : total), 0)
}
