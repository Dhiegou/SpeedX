import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarOperador } from '@/contexts/identidade/criarOperador'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * `/api/painel/sessao` e a guarda do painel — a camada HTTP da T08.
 *
 * O caso de uso já é testado contra o banco em `identidade.test.ts`. Aqui o que
 * está sob teste é o que só existe na borda: o status que volta, os atributos
 * do cookie, e o fato de a rota guardada recusar **sem cookie nenhum** — que é
 * o critério de aceitação da T08 escrito como `curl`, verificado no código.
 *
 * Duas coisas são substituídas: a **conexão**, que vira o Postgres em
 * WebAssembly da suíte, e o **armazém de cookies** do Next, que fora de uma
 * requisição real não existe. Regra, transação e constraint continuam as de
 * verdade.
 */

const estado = vi.hoisted(() => ({
  db: undefined as unknown,
  cookies: new Map<string, string>(),
  redirecionadoPara: null as string | null,
}))

vi.mock('@/db', () => ({ db: () => estado.db }))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (nome: string) => {
        const valor = estado.cookies.get(nome)
        return valor === undefined ? undefined : { name: nome, value: valor }
      },
      set: (nome: string, valor: string, opcoes: Record<string, unknown>) => {
        estado.cookies.set(nome, valor)
        atributos.set(nome, opcoes)
      },
      delete: (nome: string) => {
        estado.cookies.delete(nome)
      },
    }),
}))

vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    estado.redirecionadoPara = destino
    throw new Error('REDIRECIONOU')
  },
}))

const atributos = new Map<string, Record<string, unknown>>()

const { DELETE, GET, POST } = await import('@/../app/api/painel/sessao/route')
const { exigirOperador, nomeDoCookie } = await import('@/contexts/identidade/servico')

const SENHA = 'senha-de-operador-2026'
const ORIGEM = '203.0.113.7'

let banco: BancoDeTeste

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  estado.db = banco.db
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec('truncate table sessao, operador, limite_taxa cascade;')
  estado.cookies.clear()
  estado.redirecionadoPara = null
  atributos.clear()

  await criarOperador(banco.db, { usuario: 'marina', nome: 'Marina Costa', senha: SENHA })
})

type Opcoes = { tipo?: string | null; origem?: string | null; bruto?: string }

function requisicao(dados: unknown, opcoes: Opcoes = {}): NextRequest {
  const cabecalhos = new Headers()
  const tipo = opcoes.tipo === undefined ? 'application/json' : opcoes.tipo

  if (tipo !== null) cabecalhos.set('content-type', tipo)
  cabecalhos.set('x-forwarded-for', opcoes.origem ?? ORIGEM)

  const corpo = opcoes.bruto ?? JSON.stringify(dados)

  return new NextRequest('http://localhost:3000/api/painel/sessao', {
    method: 'POST',
    headers: cabecalhos,
    body: corpo,
  })
}

function entrar(usuario = 'marina', senha = SENHA, opcoes: Opcoes = {}): Promise<Response> {
  return POST(requisicao({ usuario, senha }, opcoes))
}

describe('POST /api/painel/sessao — login', () => {
  it('credencial certa devolve 200, o Operador e nenhum token no corpo', async () => {
    const resposta = await entrar()

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')

    const corpo = (await resposta.json()) as { operador: { nome: string }; expiraEm: string }
    expect(corpo.operador.nome).toBe('Marina Costa')

    // O token está no cookie `HttpOnly`. No corpo, ele estaria ao alcance de
    // qualquer script da página.
    const cookie = estado.cookies.get(nomeDoCookie())
    expect(cookie).toBeDefined()
    expect(JSON.stringify(corpo)).not.toContain(cookie)
  })

  it('o cookie sai HttpOnly, SameSite=Lax, Path=/ e com prazo', async () => {
    await entrar()

    const opcoes = atributos.get(nomeDoCookie())

    expect(opcoes?.httpOnly).toBe(true)
    expect(opcoes?.sameSite).toBe('lax')
    expect(opcoes?.path).toBe('/')
    expect(opcoes?.expires).toBeInstanceOf(Date)
    // `secure` fica desligado fora de produção porque `http://localhost` não o
    // satisfaz e o navegador descartaria o cookie em silêncio.
    expect(opcoes?.secure).toBe(false)
  })

  it('usuário inexistente e senha errada devolvem o mesmo 401 e o mesmo texto', async () => {
    const inexistente = await entrar('ninguem', SENHA)
    const senhaErrada = await entrar('marina', 'errada-porem-longa')

    expect(inexistente.status).toBe(401)
    expect(senhaErrada.status).toBe(401)
    expect(await inexistente.text()).toBe(await senhaErrada.text())
    expect(estado.cookies.size).toBe(0)
  })

  it('corpo ilegível também é 401 — não 400', async () => {
    // Um 400 aqui separaria "corpo malformado" de "senha errada" para quem
    // está sondando, e não ajudaria ninguém que esteja de fato tentando entrar.
    const resposta = await POST(requisicao(null, { bruto: '{quebrado' }))

    expect(resposta.status).toBe(401)
  })

  it('recusa corpo que não seja JSON', async () => {
    const resposta = await entrar('marina', SENHA, { tipo: 'text/plain' })

    expect(resposta.status).toBe(415)
  })

  it('tentativas demais devolvem 429 com Retry-After', async () => {
    for (let i = 0; i < 10; i += 1) {
      await entrar('marina', 'errada-porem-longa-' + String(i))
    }

    const resposta = await entrar()

    expect(resposta.status).toBe(429)
    expect(Number(resposta.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  it('a senha nunca aparece na resposta nem no log', async () => {
    const escritas: string[] = []
    const espiao = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((texto: unknown): boolean => {
        escritas.push(String(texto))
        return true
      })

    const ok = await entrar()
    const recusado = await entrar('marina', 'errada-porem-longa')

    espiao.mockRestore()

    const tudo = escritas.join('') + (await ok.text()) + (await recusado.text())

    expect(tudo).not.toContain(SENHA)
    expect(tudo).not.toContain('errada-porem-longa')
    // E o log registrou as duas passagens, para T16 poder contá-las.
    expect(escritas.join('')).toContain('identidade.login')
  })
})

describe('GET /api/painel/sessao — a guarda de API (RF-11)', () => {
  it('sem cookie nenhum, responde 401 e não conta nada sobre o painel', async () => {
    const resposta = await GET()

    expect(resposta.status).toBe(401)
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')

    const corpo = (await resposta.json()) as { erro: { codigo: string } }
    expect(corpo.erro.codigo).toBe('nao_autenticado')
  })

  it('com cookie forjado, também 401', async () => {
    estado.cookies.set(nomeDoCookie(), 'token-inventado')

    expect((await GET()).status).toBe(401)
  })

  it('com a sessão aberta pelo login, responde 200 com o Operador', async () => {
    await entrar()

    const resposta = await GET()

    expect(resposta.status).toBe(200)
    const corpo = (await resposta.json()) as { operador: { nome: string } }
    expect(corpo.operador.nome).toBe('Marina Costa')
  })
})

describe('DELETE /api/painel/sessao — logout', () => {
  it('encerra a sessão no banco, apaga o cookie e o acesso cai', async () => {
    await entrar()
    expect((await GET()).status).toBe(200)

    const resposta = await DELETE()

    expect(resposta.status).toBe(204)
    expect(estado.cookies.size).toBe(0)

    const [linha] = await banco.db.select().from(schema.sessao)
    // A linha permanece, marcada: quando a sessão foi encerrada é informação de
    // acesso ao painel, e apagá-la seria o oposto do rastro que RF-23 pede.
    expect(linha?.encerradaEm).not.toBeNull()

    expect((await GET()).status).toBe(401)
  })

  it('sem sessão, ainda responde 204 — sair é idempotente', async () => {
    expect((await DELETE()).status).toBe(204)
  })
})

describe('guarda das páginas (RF-11)', () => {
  it('sem sessão, `exigirOperador` redireciona antes de renderizar', async () => {
    await expect(exigirOperador()).rejects.toThrow('REDIRECIONOU')

    expect(estado.redirecionadoPara).toBe('/painel/login')
  })

  it('com sessão, devolve o Operador e não redireciona', async () => {
    await entrar()

    expect(await exigirOperador()).toEqual({
      id: expect.any(String) as unknown as string,
      nome: 'Marina Costa',
    })
    expect(estado.redirecionadoPara).toBeNull()
  })
})

describe('sessões simultâneas pela borda (RF-12)', () => {
  it('o login de um Operador não derruba a sessão do outro', async () => {
    await criarOperador(banco.db, { usuario: 'joao', nome: 'João Lima', senha: SENHA })

    await entrar('marina')
    const cookieMarina = estado.cookies.get(nomeDoCookie())

    await entrar('joao')
    const cookieJoao = estado.cookies.get(nomeDoCookie())

    expect(cookieMarina).not.toBe(cookieJoao)

    // O armazém de cookies do teste é um só, como o de um navegador. Trocar o
    // valor de volta é o que simula o segundo aparelho.
    estado.cookies.set(nomeDoCookie(), cookieMarina ?? '')
    const deMarina = (await (await GET()).json()) as { operador: { nome: string } }

    estado.cookies.set(nomeDoCookie(), cookieJoao ?? '')
    const deJoao = (await (await GET()).json()) as { operador: { nome: string } }

    expect(deMarina.operador.nome).toBe('Marina Costa')
    expect(deJoao.operador.nome).toBe('João Lima')
  })
})
