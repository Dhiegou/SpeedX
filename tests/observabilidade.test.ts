import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { verificarBanco } from '@/infra/saude'
import { registrarOperacao, type RegistroDeLog } from '@/shared/log'
import {
  avaliarAlertas,
  janelaDe,
  lerRegistros,
  percentis,
  relatorioDeProduto,
  relatorioTecnico,
} from '@/shared/metricas'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, participanteValido, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * Observabilidade (T16 — RNF-05, métricas do PRD §7).
 *
 * O teste que mais importa aqui é o de FL-12: **derrubar a telemetria não pode
 * derrubar a aplicação**. Os outros verificam que os números que o time vai
 * olhar durante o evento significam o que dizem significar — um p95 calculado
 * errado é pior do que nenhum p95, porque alguém vai decidir com base nele às
 * onze da manhã do dia que não tem segunda chance.
 */

const estado = vi.hoisted(() => ({
  db: undefined as unknown,
  cookies: new Map<string, string>(),
}))

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

const rotaSaude = await import('@/../app/api/saude/route')
const rotaMetricas = await import('@/../app/api/metricas/route')
const sessaoRota = await import('@/../app/api/painel/sessao/route')
const { criarOperador } = await import('@/contexts/identidade/criarOperador')
const { painelDoDia } = await import('@/contexts/custodia/metricas')

const SENHA = 'senha-de-operador-2026'

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
  estado.db = banco.db
})

async function entrar(): Promise<string> {
  const op = await criarOperador(banco.db, {
    usuario: 'marina',
    nome: 'Marina Costa',
    senha: SENHA,
  })

  const r = await sessaoRota.POST(
    new Request('http://localhost/api/painel/sessao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario: 'marina', senha: SENHA }),
    }) as never,
  )

  expect(r.status).toBe(200)
  return op.id
}

/** Um registro de log, com o mínimo preenchido. */
function reg(parcial: Partial<RegistroDeLog> & { evento: string }): RegistroDeLog {
  return {
    resultado: 'sucesso',
    instante: '2026-09-12T09:00:00.000Z',
    ...parcial,
  } as RegistroDeLog
}

// ---------------------------------------------------------------------------

describe('FL-12 — a coleta não derruba a aplicação', () => {
  it('registrar não lança quando a saída padrão falha', () => {
    const espiao = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('cano quebrado')
    })

    // Este é o critério de aceitação de T16: derrubar o coletor não afeta a
    // aplicação. Aqui ele é trivialmente verdadeiro **porque não existe
    // coletor** — o transporte é a saída padrão, e o único jeito de ela
    // derrubar uma requisição seria este `write` propagando.
    expect(() => registrarOperacao({ evento: 'teste.fl12', resultado: 'sucesso' })).not.toThrow()

    espiao.mockRestore()
  })

  it('o registro devolvido continua completo mesmo com a escrita falhando', () => {
    const espiao = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('cano quebrado')
    })

    const registro = registrarOperacao({ evento: 'teste.fl12', resultado: 'erro', status: 500 })

    espiao.mockRestore()

    expect(registro.evento).toBe('teste.fl12')
    expect(registro.instante).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ---------------------------------------------------------------------------

describe('a sondagem de saúde', () => {
  it('responde 200 e mede a latência quando o banco atende', async () => {
    const resposta = await rotaSaude.GET()
    const corpo = (await resposta.json()) as Record<string, unknown>

    expect(resposta.status).toBe(200)
    expect(corpo.situacao).toBe('ok')
    expect(corpo.banco).toMatchObject({ alcancavel: true })
    expect(corpo.instante).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(resposta.headers.get('cache-control')).toContain('no-store')
  })

  it('responde 503 quando o banco não atende — e não conta por quê', async () => {
    const segredo = 'postgres://usuario:senha@interno.exemplo:5432/speedx'

    estado.db = {
      execute: () => Promise.reject(new Error(`connect ECONNREFUSED ${segredo}`)),
    }

    const resposta = await rotaSaude.GET()
    const texto = await resposta.text()

    expect(resposta.status).toBe(503)
    expect(texto).toContain('degradado')

    // A rota é pública: o monitor não sabe autenticar-se. A mensagem do driver
    // carrega host, porta, usuário e nome do banco — ela fica no log, que já
    // tem controle de acesso, e nunca no corpo.
    expect(texto).not.toContain(segredo)
    expect(texto).not.toContain('ECONNREFUSED')
    expect(texto).not.toContain('5432')
  })

  it('desiste no prazo em vez de herdar a espera de um banco pendurado', async () => {
    const pendurado = {
      execute: () => new Promise(() => undefined),
    } as unknown as Parameters<typeof verificarBanco>[0]

    const inicio = Date.now()
    const saude = await verificarBanco(pendurado, 50)

    // Um banco fora do ar costuma aceitar a conexão e não responder. Sem prazo,
    // o monitor estoura o próprio tempo limite e registra "sem resposta" — que
    // é indistinguível da aplicação inteira ter caído.
    expect(saude.alcancavel).toBe(false)
    expect(Date.now() - inicio).toBeLessThan(1_000)
    expect(saude).toMatchObject({ motivo: 'tempo_esgotado' })
  })

  it('cabe no orçamento de 300 ms com o banco de pé', async () => {
    const inicio = Date.now()
    await rotaSaude.GET()

    expect(Date.now() - inicio).toBeLessThan(300)
  })
})

// ---------------------------------------------------------------------------

describe('o painel do dia', () => {
  it('exige sessão de Operador', async () => {
    const resposta = await rotaMetricas.GET()

    expect(resposta.status).toBe(401)
  })

  it('conta inscritos, pendências e correções', async () => {
    const operadorId = await entrar()

    const [pessoa] = await banco.db
      .insert(schema.participante)
      .values(participanteValido())
      .returning({ id: schema.participante.id })

    const [t1] = await banco.db
      .insert(schema.tentativa)
      .values({
        participanteId: pessoa!.id,
        pitch: 1,
        estado: 'valida',
        tempoMs: 90_000,
        resolvidoEm: new Date(),
        operadorId,
      })
      .returning({ id: schema.tentativa.id })

    await banco.db.insert(schema.tentativa).values({ participanteId: pessoa!.id, pitch: 2 })

    await banco.db.insert(schema.lancamento).values([
      { tentativaId: t1!.id, tipo: 'registro', tempoMsNovo: 91_000, operadorId },
      {
        tentativaId: t1!.id,
        tipo: 'correcao',
        tempoMsAnterior: 91_000,
        tempoMsNovo: 90_000,
        operadorId,
      },
    ])

    const resposta = await rotaMetricas.GET()
    const painel = (await resposta.json()) as Awaited<ReturnType<typeof painelDoDia>>

    expect(resposta.status).toBe(200)
    expect(painel.inscritos.total).toBe(1)
    expect(painel.pendencias).toBe(1)
    expect(painel.lancamentos.total).toBe(2)
    expect(painel.lancamentos.correcoes).toBe(1)
    expect(painel.pitches).toHaveLength(2)
  })

  it('responde "quantos" e nunca "quem"', async () => {
    await entrar()

    await banco.db
      .insert(schema.participante)
      .values(participanteValido({ nome: 'Iolanda', email: 'iolanda@exemplo.com' }))

    const texto = await (await rotaMetricas.GET()).text()

    // O painel do dia é contagem. Para saber **quem** falta existe o relatório
    // de pendências de T14, que é uma exportação — e baixá-lo é uma decisão
    // consciente de mexer com dado pessoal.
    expect(texto).not.toContain('Iolanda')
    expect(texto).not.toContain('iolanda@exemplo.com')
    expect(texto).not.toContain('11987654321')
  })
})

// ---------------------------------------------------------------------------

describe('percentis', () => {
  it('devolve amostra que aconteceu, sem interpolar', () => {
    const p = percentis([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])

    // Posto mais próximo: o p95 de dez amostras é a décima. Interpolando sairia
    // 95, um número que nenhuma requisição produziu — e um limite de aceitação
    // ("≤ 2 s") merece uma amostra concreta para quem contestar olhar.
    expect(p).toMatchObject({ amostras: 10, p50: 50, p95: 100, p99: 100, max: 100 })
  })

  it('com uma amostra só, todos os percentis são ela', () => {
    expect(percentis([42])).toMatchObject({ p50: 42, p95: 42, p99: 42 })
  })

  it('sem amostra, devolve nulo em vez de zero', () => {
    // Zero seria lido como "latência excelente" num relatório.
    expect(percentis([])).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('a leitura do log', () => {
  it('atravessa o ruído que a plataforma imprime no meio', () => {
    const bruto = [
      '$ next dev',
      '  ▲ Next.js 16.3.1',
      JSON.stringify(reg({ evento: 'inscricao.cadastro', status: 201 })),
      'nem sequer é JSON {',
      '{"quebrado": ',
      JSON.stringify({ sem: 'os campos obrigatórios' }),
      JSON.stringify(reg({ evento: 'classificacao.leitura', status: 200 })),
    ].join('\n')

    // Um analisador que quebre na primeira linha estranha nunca roda contra o
    // log de verdade, que é o único contra o qual ele precisa rodar.
    expect(lerRegistros(bruto).map((r) => r.evento)).toEqual([
      'inscricao.cadastro',
      'classificacao.leitura',
    ])
  })

  it('mede a janela em vez de supô-la', () => {
    const janela = janelaDe([
      reg({ evento: 'a', instante: '2026-09-12T09:00:00.000Z' }),
      reg({ evento: 'a', instante: '2026-09-12T09:30:00.000Z' }),
    ])

    expect(janela?.minutos).toBe(30)
  })

  it('a janela nunca é zero, senão as taxas por minuto seriam infinitas', () => {
    const janela = janelaDe([reg({ evento: 'a' }), reg({ evento: 'a' })])

    expect(janela?.minutos).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('o relatório técnico', () => {
  const registros = [
    reg({ evento: 'classificacao.leitura', status: 200, duracaoMs: 30 }),
    reg({ evento: 'classificacao.leitura', status: 304, duracaoMs: 5 }),
    reg({ evento: 'classificacao.leitura', status: 304, duracaoMs: 5 }),
    reg({ evento: 'classificacao.leitura', status: 503, duracaoMs: 900, resultado: 'erro' }),
    reg({ evento: 'inscricao.cadastro', status: 429, duracaoMs: 3, resultado: 'limitada' }),
  ]

  it('separa latência por evento e ordena pelo p95', () => {
    const r = relatorioTecnico(registros)

    expect(r.latencia[0]?.evento).toBe('classificacao.leitura')
    expect(r.latencia[0]?.amostras).toBe(4)
  })

  it('conta 5xx e 429 sobre o total com status', () => {
    const r = relatorioTecnico(registros)

    expect(r.erros5xx.total).toBe(1)
    expect(r.erros5xx.taxa).toBeCloseTo(1 / 5)
    expect(r.limitadas429.total).toBe(1)
  })

  it('mede revalidação 304, que não é a taxa de acerto da borda', () => {
    const r = relatorioTecnico(registros)

    // O acerto de borda por definição não chega ao servidor. O que se mede aqui
    // é o mecanismo de FL-08: das leituras que passaram, quantas saíram sem
    // corpo. Cai junto quando o custo por leitura sobe, que é o sintoma útil.
    expect(r.revalidacaoDaClassificacao.leituras).toBe(4)
    expect(r.revalidacaoDaClassificacao.revalidacoes).toBe(2)
    expect(r.revalidacaoDaClassificacao.taxa).toBeCloseTo(0.5)
  })
})

// ---------------------------------------------------------------------------

describe('o relatório de produto', () => {
  it('a taxa de conclusão usa a abertura do formulário como denominador', () => {
    const registros = [
      ...Array.from({ length: 10 }, () => reg({ evento: 'inscricao.formulario_aberto' })),
      ...Array.from({ length: 9 }, () =>
        reg({ evento: 'inscricao.cadastro', status: 201, preenchimentoMs: 80_000 }),
      ),
    ]

    const r = relatorioDeProduto(registros)

    // O denominador vem do servidor, não do navegador: `/` emite a abertura ao
    // renderizar (D-33 tirou a métrica do cliente). Sem isso, a taxa dependeria
    // de telemetria que este sistema decidiu não ter.
    expect(r.cadastro.aberturas).toBe(10)
    expect(r.cadastro.concluidos).toBe(9)
    expect(r.cadastro.taxaDeConclusao).toBeCloseTo(0.9)
    expect(r.cadastro.medianaDeSegundos).toBe(80)
  })

  it('mediana, e não média, para o tempo de preenchimento', () => {
    const registros = [
      reg({ evento: 'inscricao.cadastro', status: 201, preenchimentoMs: 60_000 }),
      reg({ evento: 'inscricao.cadastro', status: 201, preenchimentoMs: 70_000 }),
      // Alguém que abriu o formulário e voltou meia hora depois.
      reg({ evento: 'inscricao.cadastro', status: 201, preenchimentoMs: 1_800_000 }),
    ]

    // A média daria 10 minutos e diria que a meta de 90 s está perdida. A
    // mediana diz o que a maioria viveu, que é o que a meta do PRD descreve.
    expect(relatorioDeProduto(registros).cadastro.medianaDeSegundos).toBe(70)
  })

  it('separa recusa no bloco do Responsável das demais', () => {
    const registros = [
      reg({ evento: 'inscricao.formulario_aberto' }),
      reg({ evento: 'inscricao.cadastro', status: 422, resultado: 'recusada', campos: ['email'] }),
      reg({
        evento: 'inscricao.cadastro',
        status: 422,
        resultado: 'recusada',
        campos: ['responsavelTelefone'],
      }),
      reg({
        evento: 'inscricao.cadastro',
        status: 422,
        resultado: 'recusada',
        campos: ['aceiteResponsavel'],
      }),
    ]

    const r = relatorioDeProduto(registros)

    expect(r.responsavel.recusas).toBe(3)
    expect(r.responsavel.recusasNoBlocoDoResponsavel).toBe(2)
  })

  it('leituras por inscrito só existe com o denominador, que vem do banco', () => {
    const registros = Array.from({ length: 8 }, () => reg({ evento: 'classificacao.leitura' }))

    expect(relatorioDeProduto(registros).classificacao.porInscrito).toBeNull()
    expect(relatorioDeProduto(registros, { inscritos: 4 }).classificacao.porInscrito).toBe(2)
  })

  it('taxa de correção sobre o total de lançamentos, não sobre as tentativas', () => {
    const registros = [
      ...Array.from({ length: 99 }, () => reg({ evento: 'cronometragem.registro' })),
      reg({ evento: 'cronometragem.correcao' }),
    ]

    expect(relatorioDeProduto(registros).lancamentos.taxaDeCorrecao).toBeCloseTo(0.01)
  })
})

// ---------------------------------------------------------------------------

describe('os alertas', () => {
  const emMinuto = (m: number, extra: Partial<RegistroDeLog> = {}): RegistroDeLog =>
    reg({
      evento: 'classificacao.leitura',
      duracaoMs: 100,
      instante: new Date(Date.parse('2026-09-12T09:00:00.000Z') + m * 60_000).toISOString(),
      ...extra,
    })

  it('dispara quando a sondagem de saúde não alcança o banco', () => {
    const alertas = avaliarAlertas([
      reg({ evento: 'saude.verificacao', resultado: 'erro', status: 503 }),
    ])

    expect(alertas.map((a) => a.nome)).toContain('saude_indisponivel')
  })

  it('dispara com dois minutos seguidos de p95 acima de 2 s', () => {
    const alertas = avaliarAlertas([
      emMinuto(0, { duracaoMs: 3_000 }),
      emMinuto(1, { duracaoMs: 3_000 }),
    ])

    expect(alertas.map((a) => a.nome)).toContain('classificacao_lenta')
  })

  it('não dispara com dois minutos lentos separados por um minuto bom', () => {
    const alertas = avaliarAlertas([
      emMinuto(0, { duracaoMs: 3_000 }),
      emMinuto(1, { duracaoMs: 50 }),
      emMinuto(2, { duracaoMs: 3_000 }),
    ])

    // O limiar fala de um problema que persiste. Dois picos separados são dois
    // incidentes curtos, e acordar alguém para cada um é como o alerta perde a
    // credibilidade antes do meio-dia.
    expect(alertas.map((a) => a.nome)).not.toContain('classificacao_lenta')
  })

  it('não dispara com dois minutos lentos que não são consecutivos no relógio', () => {
    const alertas = avaliarAlertas([
      emMinuto(0, { duracaoMs: 3_000 }),
      emMinuto(30, { duracaoMs: 3_000 }),
    ])

    expect(alertas.map((a) => a.nome)).not.toContain('classificacao_lenta')
  })

  it('dispara acima de 1% de 5xx', () => {
    const registros = [
      ...Array.from({ length: 98 }, () => reg({ evento: 'a', status: 200 })),
      reg({ evento: 'a', status: 500 }),
      reg({ evento: 'a', status: 503 }),
    ]

    expect(avaliarAlertas(registros).map((a) => a.nome)).toContain('erros_5xx')
  })

  it('dispara com dez minutos sem nenhum cadastro concluído', () => {
    const cadastro = (m: number): RegistroDeLog =>
      reg({
        evento: 'inscricao.cadastro',
        status: 201,
        instante: new Date(Date.parse('2026-09-12T09:00:00.000Z') + m * 60_000).toISOString(),
      })

    expect(avaliarAlertas([cadastro(0), cadastro(12)]).map((a) => a.nome)).toContain(
      'cadastro_silencioso',
    )
  })

  it('não chama de silêncio o tempo antes do primeiro nem depois do último cadastro', () => {
    const base = Date.parse('2026-09-12T09:00:00.000Z')
    const registros = [
      // Uma hora de leituras da classificação, com um único cadastro no meio.
      ...Array.from({ length: 60 }, (_, m) =>
        reg({
          evento: 'classificacao.leitura',
          status: 200,
          instante: new Date(base + m * 60_000).toISOString(),
        }),
      ),
      reg({
        evento: 'inscricao.cadastro',
        status: 201,
        instante: new Date(base + 30 * 60_000).toISOString(),
      }),
    ]

    // Antes do primeiro cadastro o evento não começou; depois do último, acabou.
    // Alertar sobre qualquer um dos dois é acordar alguém para dizer que a noite
    // está quieta — e um alerta que grita à toa é um alerta que se ignora.
    expect(avaliarAlertas(registros).map((a) => a.nome)).not.toContain('cadastro_silencioso')
  })

  it('um dia tranquilo não produz alerta nenhum', () => {
    const registros = Array.from({ length: 50 }, (_, i) =>
      reg({
        evento: 'classificacao.leitura',
        status: 200,
        duracaoMs: 40,
        instante: new Date(Date.parse('2026-09-12T09:00:00.000Z') + i * 60_000).toISOString(),
      }),
    )

    expect(avaliarAlertas(registros)).toEqual([])
  })
})
