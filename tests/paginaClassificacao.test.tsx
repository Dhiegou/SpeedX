// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Classificacao from '@/../app/classificacao/Classificacao'
import type { DocumentoTransmitido, LinhaCompacta } from '@/contexts/classificacao'

/**
 * A página pública (T13).
 *
 * A lógica de renumeração e vizinhança já é testada sem DOM em
 * `filtroClassificacao.test.ts`. Aqui está o que só existe na tela: as quatro
 * colunas de RF-27 e nenhuma a mais, o destaque de RF-30, o indicador e o botão
 * de RF-32, e a promessa de que filtrar e buscar **não** falam com o servidor.
 */

const chamadas: string[] = []

function documento(linhas: readonly LinhaCompacta[]): DocumentoTransmitido {
  return { geradoEm: new Date().toISOString(), total: linhas.length, linhas }
}

const BASE: readonly LinhaCompacta[] = [
  ['Ana Lima', 1, 80_000],
  ['Bruno Souza', 2, 81_000],
  ['Carla Dias', 1, 82_000],
  ['Diego Ferreira', 2, 83_000],
  ['Fábio Assunção', 1, 84_450],
]

beforeEach(() => {
  chamadas.length = 0

  vi.stubGlobal('fetch', (url: string) => {
    chamadas.push(url)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(documento([...BASE, ['Gabriel Novo', 1, 85_000]])),
    } as Response)
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const montar = (linhas: readonly LinhaCompacta[] = BASE) => {
  const teclado = userEvent.setup()
  render(<Classificacao inicial={documento(linhas)} />)
  return teclado
}

describe('as colunas de RF-27, e nenhuma a mais', () => {
  it('mostra posição, nome, pitch e tempo', () => {
    montar()

    const colunas = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(colunas).toEqual(['#', 'Nome', 'Pitch', 'Tempo'])
  })

  it('o tempo é formatado pelo formatador compartilhado', () => {
    montar()

    // 84 450 ms → 01:24.45. Se a tela formatasse por conta própria, duas
    // implementações de arredondamento produziriam duas classificações.
    expect(screen.getByText('01:24.45')).toBeTruthy()
  })

  it('a primeira pintura já traz a tabela, sem esperar requisição', () => {
    montar()

    expect(screen.getByText('Ana Lima')).toBeTruthy()
    expect(chamadas).toHaveLength(0)
  })
})

describe('filtro por Pitch (RF-29)', () => {
  it('renumera a partir de 1 e não fala com o servidor', async () => {
    const teclado = montar()

    await teclado.click(screen.getByRole('tab', { name: 'Pitch 2' }))

    const linhas = screen.getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(2)

    // Bruno é o 2º no geral e o 1º do Pitch 2.
    expect(within(linhas[0] as HTMLElement).getByText('1')).toBeTruthy()
    expect(linhas[0]?.textContent).toContain('Bruno Souza')

    // A promessa central de T12/T13: filtrar não custa requisição.
    expect(chamadas).toHaveLength(0)
  })
})

describe('busca por nome (RF-30)', () => {
  it('destaca a linha encontrada e mantém as vizinhas à vista', async () => {
    const teclado = montar()

    await teclado.type(screen.getByRole('searchbox'), 'carla')

    const destacadas = screen
      .getAllByRole('row')
      .filter((l) => l.getAttribute('aria-current') === 'true')

    expect(destacadas).toHaveLength(1)
    expect(destacadas[0]?.textContent).toContain('Carla Dias')

    // "Destacar, não apenas filtrar": as vizinhas continuam na tela.
    expect(screen.getByText('Bruno Souza')).toBeTruthy()
    expect(screen.getByText('Diego Ferreira')).toBeTruthy()
    expect(chamadas).toHaveLength(0)
  })

  it('acha sem acento e sem caixa', async () => {
    const teclado = montar()

    await teclado.type(screen.getByRole('searchbox'), 'ASSUNCAO')

    const destacadas = screen
      .getAllByRole('row')
      .filter((l) => l.getAttribute('aria-current') === 'true')
    expect(destacadas[0]?.textContent).toContain('Fábio Assunção')
  })

  it('busca sem resultado explica, e não some com a tabela em silêncio', async () => {
    const teclado = montar()

    await teclado.type(screen.getByRole('searchbox'), 'zzzz')

    expect(screen.getByText(/Confira a grafia/)).toBeTruthy()
  })
})

describe('atualização (RF-32)', () => {
  it('mostra há quanto tempo, com o instante exato no title', () => {
    montar()

    const indicador = screen.getByText(/atualizado há/)
    expect(indicador.getAttribute('title')).toBeTruthy()
  })

  it('o botão força nova leitura e a tabela cresce', async () => {
    const teclado = montar()

    expect(screen.queryByText('Gabriel Novo')).toBeNull()

    await teclado.click(screen.getByRole('button', { name: /atualizar/i }))

    await waitFor(() => {
      expect(screen.getByText('Gabriel Novo')).toBeTruthy()
    })
    expect(chamadas).toEqual(['/api/classificacao'])
  })

  it('falha de rede mantém a tabela e avisa — nunca esvazia', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('rede caiu')))

    const teclado = montar()
    await teclado.click(screen.getByRole('button', { name: /atualizar/i }))

    await screen.findByText(/Não foi possível atualizar/)
    // A lista anterior continua ali. Perder a tabela por um pacote perdido é
    // pior que mostrá-la um pouco velha.
    expect(screen.getByText('Ana Lima')).toBeTruthy()
  })
})

describe('volume (RF-33)', () => {
  const muitas: readonly LinhaCompacta[] = Array.from({ length: 250 }, (_, i): LinhaCompacta => [
    `Pessoa ${String(i + 1)}`,
    1,
    80_000 + i,
  ])

  it('as 100 primeiras aparecem sem interação nenhuma', () => {
    montar(muitas)

    expect(screen.getAllByRole('row').slice(1)).toHaveLength(100)
    expect(screen.getByText('Pessoa 100')).toBeTruthy()
  })

  it('a 101 é alcançável sem nova requisição', async () => {
    const teclado = montar(muitas)

    expect(screen.queryByText('Pessoa 101')).toBeNull()

    await teclado.click(screen.getByRole('button', { name: /Mostrar mais/ }))

    expect(screen.getByText('Pessoa 101')).toBeTruthy()
    // Sobre o documento que já estava em memória.
    expect(chamadas).toHaveLength(0)
  })
})

describe('estado vazio', () => {
  it('antes da corrida, explica em vez de mostrar tabela em branco', () => {
    montar([])

    expect(screen.getByText(/Ainda não há tempos registrados/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
