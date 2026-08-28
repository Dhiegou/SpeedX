import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumirLimite,
  ESCOPO_CADASTRO,
  identificarOrigem,
} from '@/contexts/inscricao/limiteDeTaxa'
import { emitirTokenFormulario } from '@/contexts/inscricao/tokenFormulario'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * `POST /api/inscricao` — a camada HTTP (T05).
 *
 * O caso de uso já é testado contra o banco em `submeterInscricao.test.ts`.
 * Aqui o que está sob teste é a **tradução**: status, cabeçalhos e a forma do
 * corpo que chega ao celular de quem se inscreve. Um 200 no lugar de um 429
 * não muda regra nenhuma e faz o formulário de T06 exibir a tela errada.
 *
 * A única coisa simulada é a **conexão**: `@/db` devolve o Postgres em
 * WebAssembly da suíte em vez do pool de produção. Regra, transação e
 * constraint continuam sendo as de verdade — o que estes testes mediriam se
 * fossem simulados é o simulador.
 */

const estado = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('@/db', () => ({ db: () => estado.db }))

const { POST } = await import('@/../app/api/inscricao/route')

let banco: BancoDeTeste

const ORIGEM = '203.0.113.7'
const EMAIL = 'marina.costa@exemplo.com'
const TELEFONE_DIGITADO = '(11) 98765-4321'
const TELEFONE_GRAVADO = '11987654321'

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
                   participante, operador, chave_idempotencia, limite_taxa cascade;
  `)
})

function corpo(sobrescrever: Record<string, unknown> = {}) {
  return {
    nome: 'Marina',
    sobrenome: 'Costa',
    email: EMAIL,
    telefone: TELEFONE_DIGITADO,
    idade: 30,
    cockpits: [1],
    consentimento: true,
    token: emitirTokenFormulario(Date.now() - 30_000),
    ...sobrescrever,
  }
}

type Opcoes = {
  tipo?: string | null
  chave?: string | null
  origem?: string | null
  tamanho?: string
  bruto?: string
}

function requisicao(dados: unknown, opcoes: Opcoes = {}): NextRequest {
  const cabecalhos = new Headers()

  const tipo = opcoes.tipo === undefined ? 'application/json' : opcoes.tipo
  if (tipo !== null) cabecalhos.set('content-type', tipo)

  const chave = opcoes.chave === undefined ? randomUUID() : opcoes.chave
  if (chave !== null) cabecalhos.set('idempotency-key', chave)

  const origem = opcoes.origem === undefined ? ORIGEM : opcoes.origem
  if (origem !== null) cabecalhos.set('x-forwarded-for', `${origem}, 10.0.0.1`)

  if (opcoes.tamanho !== undefined) cabecalhos.set('content-length', opcoes.tamanho)

  return new NextRequest('http://localhost:3000/api/inscricao', {
    method: 'POST',
    headers: cabecalhos,
    body: opcoes.bruto ?? JSON.stringify(dados),
  })
}

describe('POST /api/inscricao — sucesso', () => {
  it('RF-10 — devolve 201 com o nome e os Cockpits enviados', async () => {
    const resposta = await POST(requisicao(corpo()))

    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual({
      nome: 'Marina',
      sobrenome: 'Costa',
      cockpits: [1],
    })
  })

  it('RNF-08 — a resposta pública não carrega e-mail, telefone nem idade', async () => {
    // O corpo devolvido é o que a tela de confirmação exibe. Ecoar a entrada
    // inteira seria o caminho mais curto e colocaria dado pessoal numa resposta
    // que nada obriga a ser privada.
    const texto = await (await POST(requisicao(corpo()))).text()

    expect(texto).not.toContain(EMAIL)
    expect(texto).not.toContain(TELEFONE_GRAVADO)
    expect(texto).not.toContain('98765')
    expect(texto).not.toContain('idade')
  })

  it('nunca vai para cache', async () => {
    // Um cadastro em cache de borda é a confirmação de uma pessoa entregue à
    // próxima. `no-store` aqui não é otimização, é privacidade.
    const resposta = await POST(requisicao(corpo()))

    expect(resposta.headers.get('cache-control')).toBe('no-store')
  })

  it('FL-03 — reenvio com a mesma chave responde 200, e não 201', async () => {
    const chave = randomUUID()
    const dados = corpo()

    const primeira = await POST(requisicao(dados, { chave }))
    const segunda = await POST(requisicao(dados, { chave }))

    expect(primeira.status).toBe(201)
    expect(segunda.status).toBe(200)
    await expect(segunda.json()).resolves.toEqual(await primeira.json())

    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
  })
})

describe('POST /api/inscricao — recusas', () => {
  it('415 para corpo que não é JSON', async () => {
    const resposta = await POST(requisicao(corpo(), { tipo: 'text/plain' }))

    expect(resposta.status).toBe(415)
    expect(await resposta.json()).toMatchObject({ erro: { codigo: 'tipo_nao_suportado' } })
  })

  it('415 quando não vem Content-Type nenhum', async () => {
    expect((await POST(requisicao(corpo(), { tipo: null }))).status).toBe(415)
  })

  it('aceita Content-Type com charset', async () => {
    // `application/json; charset=utf-8` é o que a maior parte dos clientes
    // manda. Comparar a linha inteira recusaria envio legítimo.
    const resposta = await POST(requisicao(corpo(), { tipo: 'application/json; charset=utf-8' }))

    expect(resposta.status).toBe(201)
  })

  it('400 para JSON quebrado', async () => {
    const resposta = await POST(requisicao(null, { bruto: '{"nome": ' }))

    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toMatchObject({ erro: { codigo: 'corpo_invalido' } })
  })

  it('413 para corpo grande demais', async () => {
    const resposta = await POST(requisicao(corpo(), { tamanho: String(2 * 1024 * 1024) }))

    expect(resposta.status).toBe(413)
  })

  it('RNF-17 — 422 traz campo, código e mensagem de cada problema', async () => {
    const resposta = await POST(requisicao(corpo({ idade: 12, email: 'sem-arroba' })))

    expect(resposta.status).toBe(422)

    const { erros } = (await resposta.json()) as {
      erros: { campo: string; codigo: string; mensagem: string }[]
    }

    expect(erros.map((e) => e.codigo)).toEqual(
      expect.arrayContaining(['idade_minima', 'email_formato']),
    )

    for (const erro of erros) {
      expect(erro.campo).toBeTruthy()
      expect(erro.mensagem).toBeTruthy()
    }
  })

  it('400 quando falta a chave de idempotência', async () => {
    const resposta = await POST(requisicao(corpo(), { chave: null }))

    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toMatchObject({
      erro: { codigo: 'chave_idempotencia_ausente' },
    })
  })

  it('409 quando a mesma chave chega com outro envio', async () => {
    const chave = randomUUID()

    await POST(requisicao(corpo(), { chave }))
    const resposta = await POST(requisicao(corpo({ nome: 'Bruno' }), { chave }))

    expect(resposta.status).toBe(409)
  })

  it('RNF-12 — 429 com Retry-After quando a origem excede o limite', async () => {
    const identificador = identificarOrigem(ORIGEM)

    for (let i = 0; i < 30; i += 1) {
      await consumirLimite(banco.db, ESCOPO_CADASTRO, identificador)
    }

    const resposta = await POST(requisicao(corpo()))

    expect(resposta.status).toBe(429)
    expect(Number(resposta.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
  })

  it('RNF-12 — 429 com Retry-After para envio sem token de formulário', async () => {
    const resposta = await POST(requisicao(corpo({ token: undefined })))

    expect(resposta.status).toBe(429)
    expect(resposta.headers.get('retry-after')).not.toBeNull()
  })

  it('honeypot recebe 201 e não grava', async () => {
    const resposta = await POST(requisicao(corpo({ empresa: 'Acme' })))

    expect(resposta.status).toBe(201)
    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
  })
})

describe('T05 §5 — o log não vaza dado pessoal', () => {
  let escrito: string[]
  let espiao: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    escrito = []
    espiao = vi.spyOn(process.stdout, 'write').mockImplementation((linha: unknown) => {
      escrito.push(String(linha))
      return true
    })
  })

  afterEach(() => {
    espiao.mockRestore()
  })

  it('nenhuma linha contém e-mail ou telefone, em nenhum desfecho', async () => {
    // Percorre os desfechos que carregam corpo com dado pessoal: sucesso,
    // recusa por validação e reenvio. É no caminho de erro que o vazamento
    // costuma nascer, porque a mensagem do banco traz o valor recusado junto.
    const chave = randomUUID()

    await POST(requisicao(corpo(), { chave }))
    await POST(requisicao(corpo(), { chave }))
    await POST(requisicao(corpo({ idade: 12 })))
    await POST(requisicao(corpo({ empresa: 'Acme' })))

    const tudo = escrito.join('\n')

    expect(tudo).not.toContain(EMAIL)
    expect(tudo).not.toContain('marina.costa')
    expect(tudo).not.toContain(TELEFONE_GRAVADO)
    expect(tudo).not.toContain('98765')
    expect(tudo).not.toContain('Marina')
  })

  it('mas registra o suficiente para T16 contar', async () => {
    await POST(requisicao(corpo()))
    await POST(requisicao(corpo({ idade: 12 })))

    const linhas = escrito.map((l) => JSON.parse(l) as Record<string, unknown>)

    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({
      evento: 'inscricao.cadastro',
      resultado: 'sucesso',
      status: 201,
    })
    expect(linhas[1]).toMatchObject({ resultado: 'recusada', motivo: 'validacao', status: 422 })
    // Nome de campo é vocabulário do sistema; é o que permite descobrir no dia
    // do evento que metade das recusas é o mesmo campo mal explicado.
    expect(linhas[1]?.['campos']).toContain('idade')
    expect(typeof linhas[0]?.['duracaoMs']).toBe('number')
  })
})
