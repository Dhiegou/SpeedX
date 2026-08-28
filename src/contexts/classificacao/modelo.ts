/**
 * Modelo de leitura da Classificação. Fechado de propósito.
 *
 * O que está ausente aqui é o requisito: não existe e-mail, telefone, idade
 * nem dado de Responsável. Acrescentar qualquer um desses campos exige editar
 * este arquivo deliberadamente — e é exatamente por isso que RNF-08 deixa de
 * depender de disciplina de código.
 *
 * O sobrenome não é campo deste modelo: `nomePublico` já chega resolvido da
 * projeção, e nada aqui sabe se ele veio por extenso ou abreviado.
 *
 * Consumido pela projeção (T12) e pela página pública (T13).
 */

/** Um dos dois Cockpits do evento. */
export type Cockpit = 1 | 2

/** Uma linha da tabela pública. Corresponde a uma Tentativa Válida. */
export type LinhaClassificacao = {
  /** Identificador da Tentativa. Opaco: não revela nada sobre a pessoa. */
  id: string
  /** "Dhiego Ferreira" para maiores; "Lucas M." para menores de 18 (RNF-09). */
  nomePublico: string
  cockpit: Cockpit
  /** Tempo em milissegundos. Formatado como `mm:ss.cc` só na exibição. */
  tempoMs: number
  /** Instante do Lançamento original. Serve ao desempate (RF-31), não à exibição. */
  registradoEm: string
}

/**
 * Documento completo servido ao cliente e filtrado no dispositivo (SDD BC-03).
 * Uma requisição por tecla digitada, com 2000 pessoas buscando, é o cenário
 * capaz de derrubar o sistema — por isso o filtro não volta ao servidor.
 */
export type DocumentoClassificacao = {
  /** Instante em que a projeção foi gerada, para o indicador de RF-32. */
  geradoEm: string
  linhas: readonly LinhaClassificacao[]
}
