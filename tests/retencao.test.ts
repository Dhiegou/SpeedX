import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contarBase,
  excluirParticipante,
  expurgarTudo,
  higienizar,
  procurarPorEmail,
  resumoAnonimo,
} from '@/contexts/custodia/expurgo'
import {
  DIAS_DE_RETENCAO,
  DataDoEventoInvalidaError,
  diasRestantes,
  lerDiaDoEvento,
  prazoVencido,
  vencimentoDaRetencao,
} from '@/contexts/custodia/retencao'
import { TERMO_V1_0 } from '@/contexts/inscricao/consentimento/v1-0'
import * as schema from '@/db/schema'
import { popular } from '@/db/seed'
import {
  agendarHigiene,
  expurgarMecanismo,
  IDADE_MAXIMA_DE_MECANISMO_MS,
  reiniciarHigiene,
} from '@/infra/higiene'
import { criarBancoDeTeste, participanteValido, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * Retenção e exclusão (T15 — RNF-11, RF-09).
 *
 * O oposto de todo o resto da suíte: os outros testes verificam que o dado
 * chegou; estes verificam que ele foi embora. Os dois que mais importam são o
 * que conta zero em todas as tabelas depois do expurgo e o que confere que o
 * prazo implementado é o mesmo que o termo promete — porque uma divergência ali
 * é uma promessa quebrada a duas mil pessoas, e nada no sistema a denunciaria.
 */

let banco: BancoDeTeste

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel, participante,
                   sessao, operador, chave_idempotencia, limite_taxa cascade;
  `)
  reiniciarHigiene()
})

// ---------------------------------------------------------------------------

describe('o prazo de retenção', () => {
  const EVENTO = lerDiaDoEvento('2026-09-12')

  it('é o mesmo que o termo promete', () => {
    const retencao = TERMO_V1_0.secoes.find((s) => s.id === 'retencao')
    const texto = JSON.stringify(retencao)

    // Se alguém mudar `DIAS_DE_RETENCAO` sem mexer no termo, este teste cai. É
    // a única barreira entre o código e a promessa: os dois números vivem em
    // arquivos diferentes e nada mais os liga.
    expect(texto).toContain(`${String(DIAS_DE_RETENCAO)} dias`)
  })

  it('vence na virada do décimo dia depois do evento, no fuso do evento', () => {
    // 12/09 + 10 dias de guarda = até o fim de 22/09. São Paulo é UTC-3, então
    // a virada de 23/09 local é 03:00 UTC.
    expect(vencimentoDaRetencao(EVENTO).toISOString()).toBe('2026-09-23T03:00:00.000Z')
  })

  it('ainda não venceu no último instante do décimo dia', () => {
    expect(prazoVencido(EVENTO, new Date('2026-09-23T02:59:59.999Z'))).toBe(false)
    expect(prazoVencido(EVENTO, new Date('2026-09-23T03:00:00.000Z'))).toBe(true)
  })

  it('conta os dias que faltam, e zera depois do vencimento', () => {
    expect(diasRestantes(EVENTO, new Date('2026-09-12T12:00:00Z'))).toBe(11)
    expect(diasRestantes(EVENTO, new Date('2026-09-22T12:00:00Z'))).toBe(1)
    expect(diasRestantes(EVENTO, new Date('2026-09-30T12:00:00Z'))).toBe(0)
  })

  it('recusa data que não existe, em vez de reinterpretá-la', () => {
    // `new Date('2026-02-31')` vira 3 de março sem reclamar. Dois dias a menos
    // de guarda para todo mundo, e ninguém saberia.
    expect(() => lerDiaDoEvento('2026-02-31')).toThrow(DataDoEventoInvalidaError)
    expect(() => lerDiaDoEvento('12/09/2026')).toThrow(DataDoEventoInvalidaError)
    expect(() => lerDiaDoEvento('2026-13-01')).toThrow(DataDoEventoInvalidaError)
    expect(lerDiaDoEvento(' 2026-02-28 ')).toEqual({ ano: 2026, mes: 2, dia: 28 })
  })
})

// ---------------------------------------------------------------------------

describe('o expurgo total', () => {
  it('não deixa uma linha de dado pessoal atrás', async () => {
    await popular(banco.db, { participantes: 40 })

    await banco.db.insert(schema.chaveIdempotencia).values({
      chave: randomUUID(),
      escopo: 'cadastro',
      resposta: { digestao: 'x', corpo: {} },
    })
    await banco.db
      .insert(schema.limiteTaxa)
      .values({ escopo: 'cadastro', identificador: 'hmac-qualquer' })

    const [operador] = await banco.db.select().from(schema.operador).limit(1)
    await banco.db.insert(schema.sessao).values({
      operadorId: operador!.id,
      tokenHash: 'hash-de-sessao',
      expiraEm: new Date(Date.now() + 3_600_000),
    })

    const antes = await contarBase(banco.db)
    expect(antes.participante).toBe(40)
    expect(antes.tentativa).toBeGreaterThan(0)

    const resultado = await expurgarTudo(banco.db)

    // Todas as tabelas, sem exceção — a conferência é o critério de aceitação.
    for (const total of Object.values(resultado.depois)) expect(total).toBe(0)
    expect(await contarBase(banco.db)).toEqual(resultado.depois)
  })

  it('leva junto o que só some por cascata', async () => {
    // Montado à mão, e não pelo seed: a cascata é uma corrente de quatro elos
    // (Participante → Tentativa → Lançamento, mais Responsável e Consentimento
    // ao lado), e o teste precisa dos quatro presentes, não de uma amostra
    // aleatória que às vezes não gera menor de idade.
    const [operador] = await banco.db
      .insert(schema.operador)
      .values({ usuario: 'marina', nome: 'Marina', senhaHash: 'x' })
      .returning({ id: schema.operador.id })

    const [pessoa] = await banco.db
      .insert(schema.participante)
      .values(participanteValido({ idade: 15 }))
      .returning({ id: schema.participante.id })

    await banco.db.insert(schema.responsavel).values({
      participanteId: pessoa!.id,
      nome: 'Ana',
      sobrenome: 'Souza',
      telefone: '11912345678',
    })
    await banco.db.insert(schema.consentimento).values({
      participanteId: pessoa!.id,
      versaoTermo: TERMO_V1_0.versao,
      aceiteParticipante: true,
      aceiteResponsavel: true,
    })

    const [tentativa] = await banco.db
      .insert(schema.tentativa)
      .values({
        participanteId: pessoa!.id,
        cockpit: 1,
        estado: 'valida',
        tempoMs: 90_000,
        resolvidoEm: new Date(),
        operadorId: operador!.id,
      })
      .returning({ id: schema.tentativa.id })

    await banco.db.insert(schema.lancamento).values({
      tentativaId: tentativa!.id,
      tipo: 'registro',
      tempoMsNovo: 90_000,
      operadorId: operador!.id,
    })

    const antes = await contarBase(banco.db)
    expect(antes.responsavel).toBe(1)
    expect(antes.consentimento).toBe(1)
    expect(antes.lancamento).toBe(1)

    const { depois } = await expurgarTudo(banco.db)

    // Nenhum destes é apagado por um DELETE escrito à mão: todos saem pela
    // cascata a partir de `participante`. Se uma chave estrangeira perder o
    // `on delete cascade` numa migração futura, é aqui que se descobre.
    expect(depois.responsavel).toBe(0)
    expect(depois.consentimento).toBe(0)
    expect(depois.lancamento).toBe(0)
  })

  it('preserva a conta do Operador, que não é dado de participante', async () => {
    await popular(banco.db, { participantes: 10 })

    await expurgarTudo(banco.db)

    const [linha] = await banco.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.operador)

    expect(linha?.total).toBe(1)
  })

  it('o resumo que sobrevive não carrega nada que identifique alguém', async () => {
    await popular(banco.db, { participantes: 60 })

    const { resumo } = await expurgarTudo(banco.db)

    expect(resumo.participantes).toBe(60)
    expect(resumo.cockpits.length).toBeGreaterThan(0)

    // A verificação de verdade: varre os **valores** do documento — as chaves
    // são nomes de campo escritos no código, e olhá-las só produziria um teste
    // que reclama de "participantes". O que não pode existir é texto vindo do
    // banco, e o único texto legítimo aqui é o instante em que o resumo saiu.
    const valores: unknown[] = []
    const percorrer = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(percorrer)
      else if (v !== null && typeof v === 'object') Object.values(v).forEach(percorrer)
      else valores.push(v)
    }
    percorrer(resumo)

    const textos = valores.filter((v) => typeof v === 'string')
    expect(textos).toEqual([resumo.geradoEm])
    expect(resumo.geradoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('a mediana dos tempos é calculada, e continua sendo um número', async () => {
    await popular(banco.db, { participantes: 50 })

    const resumo = await resumoAnonimo(banco.db)
    const cockpit = resumo.cockpits.find((p) => p.validas > 0)

    expect(cockpit).toBeDefined()
    expect(cockpit!.melhorMs).toBeLessThanOrEqual(cockpit!.medianaMs!)
    expect(cockpit!.medianaMs).toBeLessThanOrEqual(cockpit!.piorMs!)
  })

  it('numa base vazia não quebra nem inventa número', async () => {
    const resumo = await resumoAnonimo(banco.db)

    expect(resumo.participantes).toBe(0)
    expect(resumo.menoresDeIdade).toBe(0)
    expect(resumo.cockpits).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('a exclusão individual, a pedido', () => {
  async function semear(sobrescrever: Record<string, unknown> = {}, repasse = false) {
    const [pessoa] = await banco.db
      .insert(schema.participante)
      .values(participanteValido(sobrescrever))
      .returning({ id: schema.participante.id })

    await banco.db.insert(schema.consentimento).values({
      participanteId: pessoa!.id,
      versaoTermo: TERMO_V1_0.versao,
      aceiteParticipante: true,
      aceiteCompartilhamento: repasse,
    })

    await banco.db.insert(schema.tentativa).values([
      { participanteId: pessoa!.id, cockpit: 1 },
      { participanteId: pessoa!.id, cockpit: 2 },
    ])

    return pessoa!.id
  }

  it('apaga a pessoa, suas Tentativas e sua linha na Classificação', async () => {
    const id = await semear()

    const resultado = await excluirParticipante(banco.db, id)

    expect(resultado.encontrado).toBe(true)
    expect(resultado.tentativasRemovidas).toBe(2)

    const [restou] = await banco.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.tentativa)
      .where(eq(schema.tentativa.participanteId, id))

    // A Classificação é uma projeção sobre `tentativa`: sem Tentativa não há
    // linha, e não existe estado intermediário em que a pessoa esteja apagada e
    // continue na tabela pública.
    expect(restou?.total).toBe(0)
    expect(await contarBase(banco.db)).toMatchObject({ participante: 0, consentimento: 0 })
  })

  it('diz que o telefone já pode ter sido repassado — antes de apagar a resposta', async () => {
    const autorizou = await semear({ email: 'sim@exemplo.com' }, true)
    const recusou = await semear({ email: 'nao@exemplo.com' }, false)

    // Esta é a única janela em que a pergunta tem resposta. Depois do DELETE
    // não há mais linha de Consentimento, e o termo promete encaminhar o pedido
    // a quem recebeu a cópia.
    expect((await excluirParticipante(banco.db, autorizou)).autorizouRepasse).toBe(true)
    expect((await excluirParticipante(banco.db, recusou)).autorizouRepasse).toBe(false)
  })

  it('registra que era menor de idade, porque o Responsável some junto', async () => {
    const id = await semear({ email: 'menor@exemplo.com', idade: 15 })
    await banco.db.insert(schema.responsavel).values({
      participanteId: id,
      nome: 'Ana',
      sobrenome: 'Souza',
      telefone: '11912345678',
    })

    const resultado = await excluirParticipante(banco.db, id)

    expect(resultado.eraMenorDeIdade).toBe(true)
    expect((await contarBase(banco.db)).responsavel).toBe(0)
  })

  it('id que não existe não é erro: é um pedido já atendido', async () => {
    const resultado = await excluirParticipante(banco.db, randomUUID())

    expect(resultado.encontrado).toBe(false)
    expect(resultado.tentativasRemovidas).toBe(0)
  })

  it('a busca por e-mail devolve lista, porque a família compartilha endereço', async () => {
    await semear({ email: 'familia@exemplo.com', nome: 'Bruno' })
    await semear({ email: 'FAMILIA@exemplo.com', nome: 'Aline' })
    await semear({ email: 'outra@exemplo.com', nome: 'Carla' })

    const achados = await procurarPorEmail(banco.db, 'familia@EXEMPLO.com')

    // Sem distinção de caixa, e sem escolher por conta própria: quem atende o
    // pedido confere de quem é antes de apagar o irmão errado.
    expect(achados.map((a) => a.nome)).toEqual(['Aline', 'Bruno'])
    expect(achados[0]?.ultimos4Telefone).toBe('4321')
  })
})

// ---------------------------------------------------------------------------

describe('a higiene contínua', () => {
  const AGORA = new Date('2026-09-12T18:00:00Z').getTime()
  const VELHO = new Date(AGORA - IDADE_MAXIMA_DE_MECANISMO_MS - 60_000)
  const NOVO = new Date(AGORA - 60_000)

  async function semearMecanismo(): Promise<void> {
    await banco.db.insert(schema.chaveIdempotencia).values([
      { chave: randomUUID(), escopo: 'cadastro', resposta: {}, criadoEm: VELHO },
      { chave: randomUUID(), escopo: 'cadastro', resposta: {}, criadoEm: NOVO },
    ])
    await banco.db.insert(schema.limiteTaxa).values([
      { escopo: 'cadastro', identificador: 'a', ocorridoEm: VELHO },
      { escopo: 'cadastro', identificador: 'b', ocorridoEm: NOVO },
    ])
  }

  it('apaga o que passou de 48 h e não toca no que ainda está na janela', async () => {
    await semearMecanismo()

    const contagens = await expurgarMecanismo(banco.db, AGORA)

    expect(contagens).toEqual({ chaveIdempotencia: 1, limiteTaxa: 1 })

    const restante = await contarBase(banco.db)
    expect(restante.chaveIdempotencia).toBe(1)
    expect(restante.limiteTaxa).toBe(1)
  })

  it('leva também as sessões expiradas e as encerradas', async () => {
    const [operador] = await banco.db
      .insert(schema.operador)
      .values({ usuario: 'marina', nome: 'Marina', senhaHash: 'x' })
      .returning({ id: schema.operador.id })

    await banco.db.insert(schema.sessao).values([
      { operadorId: operador!.id, tokenHash: 'viva', expiraEm: new Date(AGORA + 3_600_000) },
      { operadorId: operador!.id, tokenHash: 'expirada', expiraEm: new Date(AGORA - 1) },
      {
        operadorId: operador!.id,
        tokenHash: 'encerrada',
        expiraEm: new Date(AGORA + 3_600_000),
        encerradaEm: new Date(AGORA - 1_000),
      },
    ])

    const contagens = await higienizar(banco.db, new Date(AGORA))

    expect(contagens.sessao).toBe(2)
    expect((await contarBase(banco.db)).sessao).toBe(1)
  })

  it('a varredura automática roda uma vez por hora, e não uma vez por requisição', async () => {
    await semearMecanismo()

    const primeira = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    agendarHigiene(banco.db, AGORA)
    agendarHigiene(banco.db, AGORA + 1_000)
    agendarHigiene(banco.db, AGORA + 60_000)

    // A varredura não é aguardada de propósito — ela não pode segurar a
    // requisição que a disparou. Uma volta na fila de microtarefas basta para
    // ela terminar contra o PGlite.
    await new Promise((r) => setTimeout(r, 50))
    primeira.mockRestore()

    // Se as três tivessem rodado, a segunda e a terceira encontrariam a tabela
    // já limpa — e o teste passaria sem provar nada. O que prova é a chave nova
    // continuar de pé com um relógio que já passou da hora dela.
    const restante = await contarBase(banco.db)
    expect(restante.chaveIdempotencia).toBe(1)
    expect(restante.limiteTaxa).toBe(1)
  })

  it('não deixa a faxina derrubar a requisição que a disparou', async () => {
    const quebrado = {
      transaction: () => Promise.reject(new Error('banco fora do ar')),
    } as unknown as Parameters<typeof agendarHigiene>[0]

    const escritas: string[] = []
    const espiao = vi.spyOn(process.stdout, 'write').mockImplementation((texto) => {
      escritas.push(String(texto))
      return true
    })

    // Se isto lançasse, quem lançaria junto seria o cadastro da pessoa.
    expect(() => {
      agendarHigiene(quebrado, AGORA)
    }).not.toThrow()

    await new Promise((r) => setTimeout(r, 50))
    espiao.mockRestore()

    expect(escritas.join('')).toContain('"evento":"infra.higiene"')
    expect(escritas.join('')).toContain('"resultado":"erro"')
  })
})
