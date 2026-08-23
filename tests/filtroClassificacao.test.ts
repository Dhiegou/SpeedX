import { describe, expect, it } from 'vitest'
import {
  classificar,
  contarLinhas,
  encontrar,
  montarBlocos,
  VIZINHAS,
  type LinhaExibida,
} from '@/../app/classificacao/filtro'
import type { LinhaCompacta } from '@/contexts/classificacao'

/**
 * A lógica da página pública, sem DOM (T13).
 *
 * Dois requisitos vivem aqui e não na tela: a renumeração de RF-29, que é a
 * diferença entre "47º no geral" e "3º no Pitch 2", e a regra de vizinhança de
 * RF-30, que é o que separa "destacar" de "apenas filtrar".
 */

const DOC: readonly LinhaCompacta[] = [
  ['Ana Lima', 1, 80_000],
  ['Bruno Souza', 2, 81_000],
  ['Carla Dias', 1, 82_000],
  ['Diego Ferreira', 2, 83_000],
  ['Elisa Marinho', 1, 84_000],
  ['Fábio Assunção', 2, 85_000],
  ['Gabriela Nunes', 1, 86_000],
]

describe('filtro por Pitch e renumeração (RF-29)', () => {
  it('sem filtro, a posição é a do documento', () => {
    const linhas = classificar(DOC, 'todos')

    expect(linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(linhas[0]?.nomePublico).toBe('Ana Lima')
  })

  it('filtrar por Pitch renumera a partir de 1', () => {
    const doPitch2 = classificar(DOC, 2)

    expect(doPitch2.map((l) => l.nomePublico)).toEqual([
      'Bruno Souza',
      'Diego Ferreira',
      'Fábio Assunção',
    ])
    // Bruno é o 2º geral e o 1º do Pitch 2. São duas perguntas diferentes, e a
    // segunda é a que a pessoa faz.
    expect(doPitch2.map((l) => l.posicao)).toEqual([1, 2, 3])
  })

  it('a ordem do documento é preservada — o servidor já classificou', () => {
    const linhas = classificar(DOC, 1)

    expect(linhas.map((l) => l.tempoMs)).toEqual([80_000, 82_000, 84_000, 86_000])
  })

  it('Pitch sem ninguém devolve lista vazia, não erro', () => {
    expect(classificar([], 1)).toEqual([])
  })
})

describe('busca por nome (RF-30)', () => {
  const linhas = classificar(DOC, 'todos')

  it('acha sem distinguir caixa nem acento', () => {
    // "Fábio Assunção" tem dois acentos, e ninguém digita acento com pressa.
    expect(encontrar(linhas, 'fabio')).toEqual(new Set([5]))
    expect(encontrar(linhas, 'ASSUNCAO')).toEqual(new Set([5]))
    expect(encontrar(linhas, 'Assunção')).toEqual(new Set([5]))
  })

  it('acha por trecho, não só por começo', () => {
    expect(encontrar(linhas, 'souza')).toEqual(new Set([1]))
    expect(encontrar(linhas, 'ima')).toEqual(new Set([0]))
  })

  it('termo vazio não acha nada — e não é o mesmo que achar tudo', () => {
    expect(encontrar(linhas, '')).toEqual(new Set())
    expect(encontrar(linhas, '   ')).toEqual(new Set())
  })

  it('acha várias linhas quando o trecho serve a mais de uma', () => {
    expect(encontrar(linhas, 'a').size).toBeGreaterThan(1)
  })
})

describe('o que a tabela mostra (RF-30, RF-33)', () => {
  const linhas = classificar(DOC, 'todos')

  it('sem busca, mostra as primeiras `limite` linhas', () => {
    const blocos = montarBlocos(linhas, new Set(), 3)

    expect(blocos).toHaveLength(1)
    expect(contarLinhas(blocos)).toBe(3)
  })

  it('as posições 1 a 100 aparecem sem interação (RF-33)', () => {
    const muitas = classificar(
      Array.from({ length: 500 }, (_, i): LinhaCompacta => [`Pessoa ${String(i)}`, 1, 80_000 + i]),
      'todos',
    )

    const blocos = montarBlocos(muitas, new Set(), 100)

    expect(contarLinhas(blocos)).toBe(100)
    // A 101 é alcançável aumentando o limite — sobre o documento em memória,
    // sem nova requisição.
    expect(contarLinhas(montarBlocos(muitas, new Set(), 200))).toBe(200)
  })

  it('com busca, o resultado vem cercado das vizinhas — não sozinho', () => {
    // É a diferença entre "destacar" e "apenas filtrar". Quem se acha em 437º
    // quer ver quem está em 436 e 438.
    const blocos = montarBlocos(linhas, new Set([3]), 100)

    expect(blocos).toHaveLength(1)
    if (blocos[0]?.tipo !== 'linhas') throw new Error('esperava bloco de linhas')

    expect(blocos[0].linhas.map((l) => l.posicao)).toEqual([2, 3, 4, 5, 6])
    expect(VIZINHAS).toBe(2)
  })

  it('resultados distantes viram blocos separados, com a lacuna nomeada', () => {
    const blocos = montarBlocos(linhas, new Set([0, 6]), 100)

    expect(blocos.map((b) => b.tipo)).toEqual(['linhas', 'lacuna', 'linhas'])

    const lacuna = blocos[1]
    if (lacuna?.tipo !== 'lacuna') throw new Error('esperava lacuna')

    // Sem a faixa, as duas pontas apareceriam grudadas e a tabela mentiria
    // sobre a distância entre elas.
    // Casamentos em 0 e 6, vizinhança 2: sobram visíveis 0-2 e 4-6, e o buraco
    // é a linha 3 sozinha.
    expect(lacuna.quantidade).toBe(1)
  })

  it('resultados vizinhos se fundem num bloco só', () => {
    const blocos = montarBlocos(linhas, new Set([2, 3]), 100)

    expect(blocos).toHaveLength(1)
    expect(contarLinhas(blocos)).toBe(6)
  })

  it('a busca não é limitada pelo `limite` da paginação', () => {
    // Quem está em 400º precisa se achar mesmo com só 100 linhas carregadas —
    // senão a busca só serviria para quem já estava visível.
    const muitas = classificar(
      Array.from({ length: 500 }, (_, i): LinhaCompacta => [`Pessoa ${String(i)}`, 1, 80_000 + i]),
      'todos',
    )

    const blocos = montarBlocos(muitas, encontrar(muitas, 'Pessoa 400'), 100)

    expect(contarLinhas(blocos)).toBeGreaterThan(0)

    const posicoes = blocos.flatMap((b) =>
      b.tipo === 'linhas' ? b.linhas.map((l) => l.posicao) : [],
    )
    expect(posicoes).toContain(401)
  })

  it('documento vazio não produz bloco nenhum', () => {
    expect(montarBlocos([], new Set(), 100)).toEqual([])
    expect(contarLinhas([])).toBe(0)
  })
})

describe('busca sobre o conjunto já filtrado por Pitch', () => {
  it('a busca respeita o filtro ativo e a renumeração', () => {
    const doPitch1 = classificar(DOC, 1)
    const achados = encontrar(doPitch1, 'elisa')

    const blocos = montarBlocos(doPitch1, achados, 100)
    const encontrada = blocos
      .flatMap((b): readonly LinhaExibida[] => (b.tipo === 'linhas' ? b.linhas : []))
      .find((l) => l.nomePublico === 'Elisa Marinho')

    // Elisa é a 5ª no geral e a 3ª do Pitch 1.
    expect(encontrada?.posicao).toBe(3)
  })
})
