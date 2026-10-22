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
 * O requisito que vive aqui e não na tela é a regra de vizinhança de RF-30, que
 * é o que separa "destacar" de "apenas filtrar". A renumeração por Cockpit de
 * RF-29 saiu com D-107: a posição de cada pessoa agora é uma só.
 */

// O número de inscrição não acompanha a posição: inscrever-se cedo não é
// correr bem. Por isso os números aqui vêm fora de ordem (D-112).
const DOC: readonly LinhaCompacta[] = [
  ['Ana Lima', 80_000, 412],
  ['Bruno Souza', 81_000, 7],
  ['Carla Dias', 82_000, 847],
  ['Diego Ferreira', 83_000, 1203],
  ['Elisa Marinho', 84_000, 84],
  ['Fábio Assunção', 85_000, 840],
  ['Gabriela Nunes', 86_000, 33],
]

describe('numeração (D-107)', () => {
  it('a posição é a do documento, a partir de 1', () => {
    const linhas = classificar(DOC)

    expect(linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(linhas[0]?.nomePublico).toBe('Ana Lima')
  })

  it('a ordem do documento é preservada — o servidor já classificou', () => {
    expect(classificar(DOC).map((l) => l.tempoMs)).toEqual([
      80_000, 81_000, 82_000, 83_000, 84_000, 85_000, 86_000,
    ])
  })

  it('a linha exibida não carrega Cockpit', () => {
    expect(Object.keys(classificar(DOC)[0] ?? {}).sort()).toEqual([
      'indice',
      'nomePublico',
      'numero',
      'posicao',
      'tempoMs',
    ])
  })

  it('documento vazio devolve lista vazia, não erro', () => {
    expect(classificar([])).toEqual([])
  })
})

describe('busca por nome (RF-30)', () => {
  const linhas = classificar(DOC)

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

describe('busca por número de inscrição (D-112)', () => {
  const linhas = classificar(DOC)

  it('acha a linha do número, com ou sem os zeros e o #', () => {
    for (const termo of ['847', '0847', '#0847', ' 847 ']) {
      expect(encontrar(linhas, termo), termo).toEqual(new Set([2]))
    }
  })

  it('casa por igualdade, e não por trecho', () => {
    // "84" é o 0084, e não o 0840 nem o 0847. Quem digita o número quer uma
    // linha só, a sua.
    expect(encontrar(linhas, '84')).toEqual(new Set([4]))
  })

  it('número sem tempo registrado não acha nada', () => {
    expect(encontrar(linhas, '9999')).toEqual(new Set())
    expect(encontrar(linhas, '0')).toEqual(new Set())
  })

  it('o número segue para a vizinhança como a busca por nome (RF-30)', () => {
    const blocos = montarBlocos(linhas, encontrar(linhas, '1203'), 100)

    if (blocos[0]?.tipo !== 'linhas') throw new Error('esperava bloco de linhas')
    expect(blocos[0].linhas.map((l) => l.posicao)).toEqual([2, 3, 4, 5, 6])
  })
})

describe('o que a tabela mostra (RF-30, RF-33)', () => {
  const linhas = classificar(DOC)

  it('sem busca, mostra as primeiras `limite` linhas', () => {
    const blocos = montarBlocos(linhas, new Set(), 3)

    expect(blocos).toHaveLength(1)
    expect(contarLinhas(blocos)).toBe(3)
  })

  it('as posições 1 a 100 aparecem sem interação (RF-33)', () => {
    const muitas = classificar(
      Array.from({ length: 500 }, (_, i): LinhaCompacta => [
        `Pessoa ${String(i)}`,
        80_000 + i,
        i + 1,
      ]),
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
      Array.from({ length: 500 }, (_, i): LinhaCompacta => [
        `Pessoa ${String(i)}`,
        80_000 + i,
        i + 1,
      ]),
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

describe('a busca não renumera (RF-30, D-107)', () => {
  it('quem é achado mantém a posição do documento', () => {
    const linhas = classificar(DOC)
    const achados = encontrar(linhas, 'elisa')

    const blocos = montarBlocos(linhas, achados, 100)
    const encontrada = blocos
      .flatMap((b): readonly LinhaExibida[] => (b.tipo === 'linhas' ? b.linhas : []))
      .find((l) => l.nomePublico === 'Elisa Marinho')

    // Destacar não é filtrar: Elisa é a 5ª, achada ou não.
    expect(encontrada?.posicao).toBe(5)
  })
})
