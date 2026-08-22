import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * `GET /api/classificacao` — a única rota pública que devolve dado de pessoa
 * (T12, RF-26).
 *
 * Ela é a superfície mais exposta do sistema: sem autenticação, cacheada na
 * borda, aberta por 2000 aparelhos ao mesmo tempo. Os testes daqui cuidam do
 * que só existe na borda — status, cabeçalhos de cache, revalidação — e
 * repetem a varredura de privacidade sobre o corpo que de fato sai pelo fio.
 */

const estado = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('@/db', () => ({ db: () => estado.db }))

const { GET } = await import('@/../app/api/classificacao/route')

const AGORA = new Date('2026-09-12T14:00:00Z')
const URL_BASE = 'http://localhost:3000/api/classificacao'

let banco: BancoDeTeste
let operadorId: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  estado.db = banco.db
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel,
                   participante, operador cascade;
  `)

  const [op] = await banco.db
    .insert(schema.operador)
    .values({ usuario: 'marina', nome: 'Marina Costa', senhaHash: 'x' })
    .returning({ id: schema.operador.id })

  operadorId = op?.id ?? ''
})

async function corredor(
  nome: string,
  sobrenome: string,
  idade: number,
  tempoMs: number,
): Promise<void> {
  const [p] = await banco.db
    .insert(schema.participante)
    .values({
      nome,
      sobrenome,
      email: `${randomUUID()}@exemplo.com`,
      telefone: '11987654321',
      idade,
    })
    .returning({ id: schema.participante.id })

  await banco.db.insert(schema.tentativa).values({
    participanteId: p?.id ?? '',
    pitch: 1,
    estado: 'valida',
    tempoMs,
    resolvidoEm: AGORA,
    operadorId,
  })
}

const pedir = (cabecalhos: Record<string, string> = {}) =>
  GET(new NextRequest(URL_BASE, { headers: new Headers(cabecalhos) }))

describe('acesso público (RF-26)', () => {
  it('responde 200 sem cookie, sem sessão e sem cabeçalho nenhum', async () => {
    await corredor('Marina', 'Costa', 30, 83_450)

    const resposta = await pedir()

    expect(resposta.status).toBe(200)

    const corpo = (await resposta.json()) as { total: number; linhas: unknown[] }
    expect(corpo.total).toBe(1)
    expect(corpo.linhas).toEqual([['Marina Costa', 1, 83_450]])
  })

  it('funciona com a classificação vazia, antes da corrida começar', async () => {
    const resposta = await pedir()

    expect(resposta.status).toBe(200)
    const corpo = (await resposta.json()) as { total: number }
    expect(corpo.total).toBe(0)
  })
})

describe('cache e revalidação (RNF-01, RNF-03, FL-08)', () => {
  it('manda a borda guardar por 15 s e servir o antigo enquanto revalida', async () => {
    await corredor('Marina', 'Costa', 30, 83_450)

    const cache = (await pedir()).headers.get('Cache-Control')

    expect(cache).toContain('public')
    // Quinze segundos ficam bem dentro dos 30 s que RNF-03 concede, deixando
    // margem para a consulta, a rede e o polling da página.
    expect(cache).toContain('s-maxage=15')
    expect(cache).toContain('stale-while-revalidate=30')
  })

  it('varia por codificação, para a borda não servir gzip a quem não entende', async () => {
    await corredor('Marina', 'Costa', 30, 83_450)

    expect((await pedir()).headers.get('Vary')).toContain('Accept-Encoding')
  })

  it('a segunda leitura sem mudança volta 304, sem corpo', async () => {
    await corredor('Marina', 'Costa', 30, 83_450)

    const primeira = await pedir()
    const etiqueta = primeira.headers.get('ETag')
    expect(etiqueta).toBeTruthy()

    const segunda = await pedir({ 'if-none-match': etiqueta ?? '' })

    expect(segunda.status).toBe(304)
    expect(await segunda.text()).toBe('')
    // O 304 também precisa repetir as instruções de cache, senão a borda
    // esquece a janela na revalidação.
    expect(segunda.headers.get('Cache-Control')).toContain('s-maxage=15')
  })

  it('um tempo novo muda a etiqueta e a leitura volta a trazer corpo', async () => {
    await corredor('Marina', 'Costa', 30, 83_450)
    const etiqueta = (await pedir()).headers.get('ETag') ?? ''

    await corredor('Bruno', 'Souza', 30, 90_000)

    const depois = await pedir({ 'if-none-match': etiqueta })

    expect(depois.status).toBe(200)
    const corpo = (await depois.json()) as { total: number }
    expect(corpo.total).toBe(2)
  })
})

describe('o corpo público não carrega dado pessoal (RNF-08, RNF-09)', () => {
  it('nem e-mail, nem telefone, nem sobrenome de menor', async () => {
    await corredor('Dhiego', 'Ferreira', 30, 80_000)
    await corredor('Lucas', 'Marinho', 15, 90_000)

    const texto = await (await pedir()).text()

    expect(texto).toContain('Dhiego Ferreira')
    expect(texto).toContain('Lucas M.')
    // O sobrenome do menor não pode estar em lugar nenhum do corpo.
    expect(texto).not.toContain('Marinho')
    expect(texto).not.toContain('@exemplo.com')
    expect(texto).not.toContain('11987654321')
  })
})

describe('quando o banco não responde', () => {
  it('devolve 503 e proíbe a borda de guardar a falha', async () => {
    const original = estado.db
    estado.db = {
      select: () => {
        throw new Error('conexão recusada')
      },
    }

    const resposta = await pedir()

    expect(resposta.status).toBe(503)
    // Cachear a indisponibilidade por 15 s seria o pior momento possível para
    // fazê-lo: todo mundo recarregando ao mesmo tempo receberia a falha.
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')

    estado.db = original
  })
})
