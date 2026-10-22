import { createHash } from 'node:crypto'
import type { DocumentoClassificacao, LinhaClassificacao } from './modelo'

/**
 * O que atravessa a rede (T12, escopo 3).
 *
 * O documento inteiro vai para o dispositivo de uma vez, e a busca por nome
 * acontece lá (SDD BC-03). Uma requisição por tecla digitada, com 2000 pessoas
 * buscando ao mesmo tempo, é o cenário capaz de derrubar o sistema — por isso a
 * busca não volta ao servidor.
 *
 * Como o documento é grande e é baixado por todo mundo, a forma dele importa.
 * Duas decisões:
 *
 * **1. Arrays posicionais, não objetos.** `["Marina Costa",83450]` contra
 * `{"nomePublico":"Marina Costa","tempoMs":83450}` — as chaves
 * repetidas 4000 vezes custam mais que os dados. O custo é legibilidade do
 * corpo cru, que se paga com este comentário e com um tipo nomeado.
 *
 * **2. Nem tudo do modelo interno vai para a rede.** Ficam de fora o `id` da
 * Tentativa e o `registradoEm`:
 *
 *  - o `id` é um UUID de 36 caracteres que a tela não usa para nada. A ordem do
 *    array já é a classificação, e a posição já é a chave de renderização;
 *  - o `registradoEm` serve ao **desempate**, que o servidor já resolveu ao
 *    ordenar. Mandá-lo adiante seria publicar o instante exato em que uma
 *    pessoa nomeada esteve num lugar — e, para os menores de 18, isso é
 *    exatamente a exposição que RNF-09 existe para evitar, só que por outra
 *    porta. Menos campo na rede é menos superfície, e aqui também é menos risco.
 */

/**
 * `[nomePublico, tempoMs, numero]`. A posição no array é a classificação.
 *
 * Até D-107 havia o Cockpit no meio, `[nomePublico, cockpit, tempoMs]`. A
 * página e a rota mudam no mesmo deploy; o que fica descasado é uma aba aberta
 * antes dele (ou uma resposta ainda nos 15 s da borda), que lê a forma errada
 * até recarregar. O deploy acontece antes do evento, sem público na página, e
 * é por isso que o custo foi aceito em vez de manter uma coluna constante.
 *
 * O número de inscrição entrou no fim em D-112, e não no meio, por isso: uma
 * aba antiga que lê `[nome, tempo]` continua lendo certo, só não acha número.
 * Ele viaja para a busca no navegador e não é desenhado na tabela.
 */
export type LinhaCompacta = readonly [string, number, number]

export type DocumentoTransmitido = {
  /** Instante em que a projeção foi gerada (RF-32). */
  readonly geradoEm: string
  /** Quantas linhas vêm — para a tela dizer o total antes de contar. */
  readonly total: number
  readonly linhas: readonly LinhaCompacta[]
}

export function compactar(documento: DocumentoClassificacao): DocumentoTransmitido {
  return {
    geradoEm: documento.geradoEm,
    total: documento.linhas.length,
    linhas: documento.linhas.map((l: LinhaClassificacao): LinhaCompacta => [
      l.nomePublico,
      l.tempoMs,
      l.numero,
    ]),
  }
}

/**
 * ETag do conteúdo — e **só** do conteúdo.
 *
 * `geradoEm` fica de fora do cálculo de propósito. Se entrasse, a etiqueta
 * mudaria a cada requisição e nenhuma revalidação jamais devolveria 304 — que
 * é justamente o que torna o polling de FL-08 barato. Duas gerações da mesma
 * classificação têm a mesma etiqueta, que é o que "não mudou" quer dizer.
 *
 * Aspas incluídas porque a gramática de `ETag` no HTTP as exige.
 */
export function etiquetaDe(documento: DocumentoTransmitido): string {
  const digestao = createHash('sha256')
    .update(JSON.stringify(documento.linhas))
    .digest('base64url')
    .slice(0, 27)

  return `"${digestao}"`
}
