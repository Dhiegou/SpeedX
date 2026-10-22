// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Classificacao from '@/../app/classificacao/Classificacao'
import type { DocumentoTransmitido, LinhaCompacta } from '@/contexts/classificacao'

/**
 * A página pública (T13).
 *
 * A lógica de numeração e vizinhança já é testada sem DOM em
 * `filtroClassificacao.test.ts`. Aqui está o que só existe na tela: as três
 * colunas de RF-27 e nenhuma a mais, o destaque de RF-30, o indicador e o botão
 * de RF-32, e a promessa de que buscar **não** fala com o servidor.
 */

const chamadas: string[] = []

function documento(linhas: readonly LinhaCompacta[]): DocumentoTransmitido {
  return { geradoEm: new Date().toISOString(), total: linhas.length, linhas }
}

const BASE: readonly LinhaCompacta[] = [
  ['Ana Lima', 80_000, 412],
  ['Bruno Souza', 81_000, 7],
  ['Carla Dias', 82_000, 847],
  ['Diego Ferreira', 83_000, 1203],
  ['Fábio Assunção', 84_450, 84],
]

beforeEach(() => {
  chamadas.length = 0

  vi.stubGlobal('fetch', (url: string) => {
    chamadas.push(url)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(documento([...BASE, ['Gabriel Novo', 85_000, 1900]])),
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
  it('mostra posição, nome e tempo — sem coluna de Cockpit (D-107)', () => {
    montar()

    const colunas = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(colunas).toEqual(['#', 'Nome', 'Tempo'])
    // Nem coluna, nem o rótulo miúdo que o telefone mostrava embaixo do nome.
    expect(screen.queryByText(/Cockpit/)).toBeNull()
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

describe('D-107 — sem abas de Cockpit', () => {
  it('não há abas, e a tabela inteira é uma classificação só', () => {
    montar()

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryByRole('tablist')).toBeNull()

    const linhas = screen.getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(5)
    expect(within(linhas[1] as HTMLElement).getByText('2')).toBeTruthy()
    expect(linhas[1]?.textContent).toContain('Bruno Souza')
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

describe('busca por número de inscrição (D-112)', () => {
  it('digitar o número destaca a linha da pessoa, com as vizinhas', async () => {
    const teclado = montar()

    await teclado.type(screen.getByRole('searchbox'), '0847')

    const destacadas = screen
      .getAllByRole('row')
      .filter((l) => l.getAttribute('aria-current') === 'true')

    expect(destacadas).toHaveLength(1)
    expect(destacadas[0]?.textContent).toContain('Carla Dias')
    expect(screen.getByText('Bruno Souza')).toBeTruthy()
    expect(chamadas).toHaveLength(0)
  })

  it('o número está no documento, e não na tabela', () => {
    montar()

    // Uma quinta coluna apertaria 360px (RNF-18). O número existe para a
    // busca, e quem olha a tabela não o vê em lugar nenhum.
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      '#',
      'Nome',
      'Tempo',
    ])
    expect(screen.getByRole('table').textContent).not.toMatch(/0847|847/)
  })

  it('número sem tempo explica o motivo, e não fala em grafia', async () => {
    const teclado = montar()

    await teclado.type(screen.getByRole('searchbox'), '9999')

    expect(screen.getByText(/Nenhum tempo registrado para o número 9999/)).toBeTruthy()
    expect(screen.queryByText(/Confira a grafia/)).toBeNull()
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
    80_000 + i,
    i + 1,
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
