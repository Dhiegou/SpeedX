import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, participanteValido, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * As rotas de `/api/painel/*` — a camada HTTP da T10.
 *
 * O domínio já é testado contra o banco em `cronometragem.test.ts`. Aqui o que
 * está sob teste é o que só existe na borda: o status que volta, a **projeção**
 * que sai no corpo (RF-15 é uma promessa sobre o que **não** aparece), a guarda
 * de sessão em cada rota, e o 409 legível de RF-12.
 *
 * Duas coisas são substituídas: a conexão, que vira o Postgres em WebAssembly
 * da suíte, e o armazém de cookies do Next, que fora de uma requisição real não
 * existe. Regra, transação e constraint continuam as de verdade — e a sessão
 * também: o login acontece pela rota de T08, não por um atalho.
 */

const estado = vi.hoisted(() => ({ db: undefined as unknown, cookies: new Map<string, string>() }))

vi.mock('@/db', () => ({ db: () => estado.db }))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (nome: string) => {
        const valor = estado.cookies.get(nome)
        return valor === undefined ? undefined : { name: nome, value: valor }
      },
      set: (nome: string, valor: string) => estado.cookies.set(nome, valor),
      delete: (nome: string) => estado.cookies.delete(nome),
    }),
}))

vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('REDIRECIONOU')
  },
}))

const sessaoRota = await import('@/../app/api/painel/sessao/route')
const filaRota = await import('@/../app/api/painel/fila/route')
const tempoRota = await import('@/../app/api/painel/tempo/route')
const ausenciaRota = await import('@/../app/api/painel/ausencia/route')
const tentativaRota = await import('@/../app/api/painel/tentativa/route')
const participanteRota = await import('@/../app/api/painel/participante/route')
const historicoRota = await import('@/../app/api/painel/tentativa/[id]/historico/route')
const { criarOperador } = await import('@/contexts/identidade/criarOperador')

const SENHA = 'senha-de-operador-2026'
const BASE = 'http://localhost:3000/api/painel'

let banco: BancoDeTeste

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  estado.db = banco.db
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel, participante,
                   sessao, operador, chave_idempotencia, limite_taxa cascade;
  `)
  estado.cookies.clear()

  await criarOperador(banco.db, { usuario: 'marina', nome: 'Marina Costa', senha: SENHA })
})

async function entrar(usuario = 'marina'): Promise<void> {
  const resposta = await sessaoRota.POST(
    new NextRequest(`${BASE}/sessao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario, senha: SENHA }),
    }),
  )

  if (resposta.status !== 200) throw new Error(`login falhou: ${String(resposta.status)}`)
}

function corpoJson(dados: unknown, metodo = 'POST'): NextRequest {
  return new NextRequest(`${BASE}/x`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function criarParticipante(sobrescrever: Record<string, unknown> = {}): Promise<string> {
  const [p] = await banco.db
    .insert(schema.participante)
    .values(participanteValido(sobrescrever) as typeof schema.participante.$inferInsert)
    .returning({ id: schema.participante.id })

  return p?.id ?? ''
}

async function criarTentativa(
  cockpit: 1 | 2 = 1,
  inscritoEm?: Date,
  participante: Record<string, unknown> = {},
): Promise<{ tentativaId: string; participanteId: string }> {
  const participanteId = await criarParticipante(participante)

  const [t] = await banco.db
    .insert(schema.tentativa)
    .values({ participanteId, cockpit, ...(inscritoEm === undefined ? {} : { inscritoEm }) })
    .returning({ id: schema.tentativa.id })

  return { tentativaId: t?.id ?? '', participanteId }
}

const fila = (busca?: string, cockpit = 1) =>
  filaRota.GET(
    new NextRequest(
      `${BASE}/fila?cockpit=${String(cockpit)}${busca === undefined ? '' : `&busca=${encodeURIComponent(busca)}`}`,
    ),
  )

// ---------------------------------------------------------------------------

describe('a guarda vale em todas as rotas (RF-11)', () => {
  it('sem sessão, toda rota do painel responde 401', async () => {
    const { tentativaId, participanteId } = await criarTentativa()

    const respostas = await Promise.all([
      fila(),
      participanteRota.GET(new NextRequest(`${BASE}/participante?busca=mar`)),
      tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() })),
      tempoRota.PATCH(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }, 'PATCH')),
      ausenciaRota.POST(corpoJson({ tentativaId, chave: randomUUID() })),
      tentativaRota.POST(corpoJson({ participanteId, cockpit: 2 })),
      historicoRota.GET(new Request(`${BASE}/tentativa/${tentativaId}/historico`), {
        params: Promise.resolve({ id: tentativaId }),
      }),
    ])

    expect(respostas.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
    // E nada foi escrito por nenhuma delas.
    expect(await banco.db.select().from(schema.lancamento)).toHaveLength(0)
  })

  it('toda resposta do painel sai com `no-store`', async () => {
    await entrar()

    for (const resposta of [
      await fila(),
      await participanteRota.GET(new NextRequest(`${BASE}/participante?busca=x`)),
    ]) {
      expect(resposta.headers.get('Cache-Control')).toBe('no-store')
    }
  })
})

describe('GET /fila (RF-13, RF-14, RF-15, RF-16)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('não traz lançadas nem ausentes, e respeita a ordem de inscrição', async () => {
    const base = new Date('2026-09-12T08:00:00Z').getTime()

    const primeira = await criarTentativa(1, new Date(base), { nome: 'Ana' })
    const segunda = await criarTentativa(1, new Date(base + 60_000), { nome: 'Bruno' })
    const terceira = await criarTentativa(1, new Date(base + 120_000), { nome: 'Carlos' })

    await tempoRota.POST(
      corpoJson({ tentativaId: segunda.tentativaId, tempo: '01:23.45', chave: randomUUID() }),
    )
    await ausenciaRota.POST(corpoJson({ tentativaId: terceira.tentativaId, chave: randomUUID() }))

    const corpo = (await (await fila()).json()) as {
      itens: { tentativaId: string }[]
      pendentes: number
    }

    expect(corpo.itens.map((i) => i.tentativaId)).toEqual([primeira.tentativaId])
    expect(corpo.pendentes).toBe(1)
  })

  it('alternar cockpit altera a lista (RF-13)', async () => {
    await criarTentativa(1, undefined, { nome: 'DoCockpitUm' })
    await criarTentativa(2, undefined, { nome: 'DoCockpitDois' })

    const um = (await (await fila(undefined, 1)).json()) as { itens: { nome: string }[] }
    const dois = (await (await fila(undefined, 2)).json()) as { itens: { nome: string }[] }

    expect(um.itens.map((i) => i.nome)).toEqual(['DoCockpitUm'])
    expect(dois.itens.map((i) => i.nome)).toEqual(['DoCockpitDois'])
  })

  it('cada item traz o necessário para distinguir homônimos — e nada além (RF-15)', async () => {
    await criarTentativa(1, undefined, {
      nome: 'Marina',
      sobrenome: 'Costa',
      email: 'marina.costa@exemplo.com',
      telefone: '11987654321',
      idade: 34,
    })

    const resposta = await fila()
    const texto = await resposta.text()
    const corpo = JSON.parse(texto) as { itens: Record<string, unknown>[] }

    expect(Object.keys(corpo.itens[0] ?? {}).sort()).toEqual([
      'inscritoEm',
      'nome',
      'participanteId',
      'sobrenome',
      'tentativaId',
      'ultimos4Telefone',
    ])
    expect(corpo.itens[0]?.ultimos4Telefone).toBe('4321')

    // A promessa de RF-15 é sobre o que **não** sai. Um `select` distraído em
    // `consultas.ts` passaria por todos os outros testes e falharia aqui.
    expect(texto).not.toContain('marina.costa@exemplo.com')
    expect(texto).not.toContain('11987654321')

    // A idade não é conferida por substring: `34` são dois dígitos, e dois
    // dígitos aparecem por acaso dentro de um UUID ou de um ISO 8601. A
    // primeira versão deste teste fazia isso e passou por sorte no sorteio dos
    // identificadores — um teste que reprova conforme o UUID que calhou é pior
    // que teste nenhum. Quem garante a ausência da idade é a asserção de chaves
    // acima, que é exaustiva: se `idade` entrar na projeção, ela falha.
    expect(Object.keys(corpo.itens[0] ?? {})).not.toContain('idade')
  })

  it('busca por trecho, sem acento e sem caixa, dentro do Cockpit (RF-16)', async () => {
    await criarTentativa(1, undefined, { nome: 'João', sobrenome: 'Silva' })
    await criarTentativa(1, undefined, { nome: 'Lélio', sobrenome: 'Assumpção Neto' })
    await criarTentativa(1, undefined, { nome: 'Bruno', sobrenome: 'Souza' })
    // Mesmo nome, outro Cockpit: não pode aparecer na busca do Cockpit 1.
    await criarTentativa(2, undefined, { nome: 'João', sobrenome: 'Pereira' })

    const nomes = async (busca: string, cockpit = 1) =>
      ((await (await fila(busca, cockpit)).json()) as { itens: { nome: string }[] }).itens.map(
        (i) => i.nome,
      )

    // Sem acento na busca, com acento no dado.
    expect(await nomes('joao')).toEqual(['João'])
    expect(await nomes('JOAO')).toEqual(['João'])
    // Trecho no meio de sobrenome composto — o caso que prefixo não pega.
    expect(await nomes('neto')).toEqual(['Lélio'])
    expect(await nomes('assump')).toEqual(['Lélio'])
    // O recorte por Cockpit continua valendo.
    expect(await nomes('joao', 2)).toEqual(['João'])
    expect(await nomes('zzz')).toEqual([])
  })

  it('recusa cockpit fora de {1,2}', async () => {
    for (const p of ['0', '3', 'x', '']) {
      const r = await filaRota.GET(new NextRequest(`${BASE}/fila?cockpit=${p}`))
      expect(r.status).toBe(400)
    }
  })

  it('manda o instante do servidor no cabeçalho (regra 6)', async () => {
    const resposta = await fila()
    const instante = resposta.headers.get('X-Instante-Servidor')

    expect(instante).not.toBeNull()
    expect(Number.isNaN(Date.parse(instante ?? ''))).toBe(false)
  })

  it('avisa quando o teto cortou resultados', async () => {
    for (let i = 0; i < 3; i += 1) {
      await criarTentativa(1, undefined, { email: `p${String(i)}@exemplo.com` })
    }

    const cheia = (await (await fila()).json()) as { truncado: boolean }
    expect(cheia.truncado).toBe(false)
  })
})

describe('POST /tempo (RF-17, RF-23)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('registra e devolve o tempo reexibido idêntico', async () => {
    const { tentativaId } = await criarTentativa()

    const resposta = await tempoRota.POST(
      corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }),
    )

    expect(resposta.status).toBe(201)

    const corpo = (await resposta.json()) as {
      tentativa: { estado: string; tempo: string; tempoMs: number }
    }

    expect(corpo.tentativa.estado).toBe('valida')
    expect(corpo.tentativa.tempoMs).toBe(83_450)
    // RF-17: o valor volta formatado pelo servidor, não pelo navegador.
    expect(corpo.tentativa.tempo).toBe('01:23.45')
  })

  it('reenvio com a mesma chave devolve 200, não 201, e não duplica', async () => {
    const { tentativaId } = await criarTentativa()
    const chave = randomUUID()

    const primeira = await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave }))
    const segunda = await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave }))

    expect(primeira.status).toBe(201)
    expect(segunda.status).toBe(200)
    expect(await banco.db.select().from(schema.lancamento)).toHaveLength(1)
  })

  it('recusa tempo malformado com 422 e o nome do campo', async () => {
    const { tentativaId } = await criarTentativa()

    const resposta = await tempoRota.POST(
      corpoJson({ tentativaId, tempo: '1:23.4', chave: randomUUID() }),
    )

    expect(resposta.status).toBe(422)

    const corpo = (await resposta.json()) as { erros: { campo: string }[] }
    expect(corpo.erros[0]?.campo).toBe('tempo')
  })

  it('recusa corpo sem chave de idempotência', async () => {
    const { tentativaId } = await criarTentativa()

    const resposta = await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45' }))

    expect(resposta.status).toBe(422)
  })

  it('tentativa inexistente é 404', async () => {
    const resposta = await tempoRota.POST(
      corpoJson({ tentativaId: randomUUID(), tempo: '01:23.45', chave: randomUUID() }),
    )

    expect(resposta.status).toBe(404)
  })

  it('recusa corpo que não seja JSON', async () => {
    const { tentativaId } = await criarTentativa()

    const resposta = await tempoRota.POST(
      new NextRequest(`${BASE}/tempo`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ tentativaId, tempo: '01:23.45', chave: randomUUID() }),
      }),
    )

    expect(resposta.status).toBe(415)
  })
})

describe('o 409 de conflito é escrito para ser exibido (RF-12)', () => {
  it('traz tempo, autor e hora do lançamento que já existe', async () => {
    await criarOperador(banco.db, { usuario: 'joao', nome: 'João Lima', senha: SENHA })

    const { tentativaId } = await criarTentativa()

    await entrar('marina')
    await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }))

    await entrar('joao')
    const resposta = await tempoRota.POST(
      corpoJson({ tentativaId, tempo: '01:20.00', chave: randomUUID() }),
    )

    expect(resposta.status).toBe(409)

    const corpo = (await resposta.json()) as { erro: { codigo: string; mensagem: string } }

    expect(corpo.erro.codigo).toBe('estado_conflitante')
    expect(corpo.erro.mensagem).toContain('01:23.45')
    expect(corpo.erro.mensagem).toContain('Marina Costa')
    expect(corpo.erro.mensagem).toMatch(/às \d{2}:\d{2}/)
    expect(corpo.erro.mensagem).toContain('correção')
  })

  it('dois lançamentos paralelos: um 201, um 409, e uma linha de auditoria', async () => {
    await entrar()
    const { tentativaId } = await criarTentativa()

    const [a, b] = await Promise.all([
      tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() })),
      tempoRota.POST(corpoJson({ tentativaId, tempo: '01:20.00', chave: randomUUID() })),
    ])

    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await banco.db.select().from(schema.lancamento)).toHaveLength(1)
  })
})

describe('PATCH /tempo (RF-22)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('corrige o valor e preserva o instante do lançamento original', async () => {
    const { tentativaId } = await criarTentativa()

    const registro = (await (
      await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }))
    ).json()) as { tentativa: { resolvidoEm: string } }

    const resposta = await tempoRota.PATCH(
      corpoJson({ tentativaId, tempo: '01:20.00', chave: randomUUID() }, 'PATCH'),
    )

    expect(resposta.status).toBe(201)

    const corpo = (await resposta.json()) as { tentativa: { tempo: string; resolvidoEm: string } }

    expect(corpo.tentativa.tempo).toBe('01:20.00')
    // RF-31: o desempate é o lançamento original, não a correção.
    expect(corpo.tentativa.resolvidoEm).toBe(registro.tentativa.resolvidoEm)
  })

  it('corrigir quem ainda não tem tempo é 409', async () => {
    const { tentativaId } = await criarTentativa()

    const resposta = await tempoRota.PATCH(
      corpoJson({ tentativaId, tempo: '01:20.00', chave: randomUUID() }, 'PATCH'),
    )

    expect(resposta.status).toBe(409)
  })
})

describe('POST /ausencia (RF-21)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('sai da Fila e mantém o cadastro', async () => {
    const { tentativaId } = await criarTentativa()

    expect((await ausenciaRota.POST(corpoJson({ tentativaId, chave: randomUUID() }))).status).toBe(
      201,
    )

    const corpo = (await (await fila()).json()) as { itens: unknown[] }
    expect(corpo.itens).toHaveLength(0)
    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
  })
})

describe('POST /tentativa (RF-24)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('inclui no outro Cockpit mantendo um único cadastro', async () => {
    const { participanteId } = await criarTentativa(1)

    expect((await tentativaRota.POST(corpoJson({ participanteId, cockpit: 2 }))).status).toBe(201)

    const dois = (await (await fila(undefined, 2)).json()) as { itens: unknown[] }
    expect(dois.itens).toHaveLength(1)
    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
  })

  it('incluir de novo no mesmo Cockpit é 409', async () => {
    const { participanteId } = await criarTentativa(1)

    expect((await tentativaRota.POST(corpoJson({ participanteId, cockpit: 1 }))).status).toBe(409)
  })

  it('participante inexistente é 404', async () => {
    expect(
      (await tentativaRota.POST(corpoJson({ participanteId: randomUUID(), cockpit: 2 }))).status,
    ).toBe(404)
  })
})

describe('GET /participante (RF-22, RF-24)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('acha quem já saiu da Fila, com as tentativas nos dois Cockpits', async () => {
    const { tentativaId, participanteId } = await criarTentativa(1, undefined, {
      nome: 'Marina',
      sobrenome: 'Costa',
      telefone: '11987654321',
    })
    await banco.db.insert(schema.tentativa).values({ participanteId, cockpit: 2 })

    await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }))

    // Já saiu da Fila...
    expect(((await (await fila()).json()) as { itens: unknown[] }).itens).toHaveLength(0)

    // ...mas a busca global continua alcançando, que é o ponto de RF-22.
    const corpo = (await (
      await participanteRota.GET(new NextRequest(`${BASE}/participante?busca=marina`))
    ).json()) as {
      itens: { tentativas: { cockpit: number; estado: string; tempo: string | null }[] }[]
    }

    expect(corpo.itens).toHaveLength(1)
    expect(corpo.itens[0]?.tentativas).toHaveLength(2)
    expect(corpo.itens[0]?.tentativas.find((t) => t.cockpit === 1)?.tempo).toBe('01:23.45')
    expect(corpo.itens[0]?.tentativas.find((t) => t.cockpit === 2)?.estado).toBe('pendente')
  })

  it('busca vazia devolve vazio, não a base inteira', async () => {
    await criarTentativa(1)

    const corpo = (await (
      await participanteRota.GET(new NextRequest(`${BASE}/participante?busca=`))
    ).json()) as { itens: unknown[] }

    expect(corpo.itens).toHaveLength(0)
  })

  it('não expõe e-mail nem telefone completo', async () => {
    await criarTentativa(1, undefined, {
      nome: 'Marina',
      email: 'marina.costa@exemplo.com',
      telefone: '11987654321',
    })

    const texto = await (
      await participanteRota.GET(new NextRequest(`${BASE}/participante?busca=marina`))
    ).text()

    expect(texto).not.toContain('marina.costa@exemplo.com')
    expect(texto).not.toContain('11987654321')
    expect(texto).toContain('4321')
  })
})

describe('GET /tentativa/:id/historico (RF-23)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('revela autor, hora e os valores de cada transição', async () => {
    const { tentativaId } = await criarTentativa()

    await tempoRota.POST(corpoJson({ tentativaId, tempo: '01:23.45', chave: randomUUID() }))
    await tempoRota.PATCH(
      corpoJson({ tentativaId, tempo: '01:20.00', chave: randomUUID() }, 'PATCH'),
    )

    const corpo = (await (
      await historicoRota.GET(new Request(`${BASE}/tentativa/${tentativaId}/historico`), {
        params: Promise.resolve({ id: tentativaId }),
      })
    ).json()) as {
      lancamentos: {
        tipo: string
        operador: string
        hora: string
        tempoAnterior: string | null
        tempoNovo: string | null
      }[]
    }

    expect(corpo.lancamentos.map((l) => l.tipo)).toEqual(['registro', 'correcao'])
    expect(corpo.lancamentos[0]?.operador).toBe('Marina Costa')
    expect(corpo.lancamentos[0]?.hora).toMatch(/^\d{2}:\d{2}$/)
    expect(corpo.lancamentos[1]?.tempoAnterior).toBe('01:23.45')
    expect(corpo.lancamentos[1]?.tempoNovo).toBe('01:20.00')
  })

  it('identificador malformado é 400', async () => {
    const resposta = await historicoRota.GET(new Request(`${BASE}/tentativa/x/historico`), {
      params: Promise.resolve({ id: 'nao-e-uuid' }),
    })

    expect(resposta.status).toBe(400)
  })
})
