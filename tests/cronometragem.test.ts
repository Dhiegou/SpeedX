import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { adicionarTentativa } from '@/contexts/cronometragem/adicionarTentativa'
import {
  contarPendentes,
  historicoDaTentativa,
  listarFila,
} from '@/contexts/cronometragem/consultas'
import { corrigirTempo, marcarAusente, registrarTempo } from '@/contexts/cronometragem/lancamento'
import { explicarRecusa, permite, TRANSICOES } from '@/contexts/cronometragem/maquinaDeEstados'
import * as schema from '@/db/schema'
import { formatTempo, parseTempo } from '@/shared/tempo'
import { criarBancoDeTeste, participanteValido, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * T09 — Domínio de Cronometragem (RF-17, RF-21 a RF-25, RF-12).
 *
 * Contra Postgres real, como o resto da suíte: as invariantes que mais importam
 * aqui — coerência entre estado e tempo, autoria obrigatória fora de Pendente,
 * unicidade por Participante e Cockpit — são constraints do banco. Testá-las
 * contra um mock verificaria o mock.
 */

const AGORA = new Date('2026-09-12T13:00:00Z').getTime()
const MINUTO = 60_000

let banco: BancoDeTeste
let operadorId: string
let outroOperadorId: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel,
                   participante, operador, chave_idempotencia cascade;
  `)

  const [a, b] = await banco.db
    .insert(schema.operador)
    .values([
      { usuario: 'marina', nome: 'Marina Costa', senhaHash: 'x' },
      { usuario: 'joao', nome: 'João Lima', senhaHash: 'x' },
    ])
    .returning({ id: schema.operador.id })

  operadorId = a?.id ?? ''
  outroOperadorId = b?.id ?? ''
})

async function criarParticipante(sobrescrever: Record<string, unknown> = {}): Promise<string> {
  const [p] = await banco.db
    .insert(schema.participante)
    .values(participanteValido(sobrescrever) as typeof schema.participante.$inferInsert)
    .returning({ id: schema.participante.id })

  return p?.id ?? ''
}

async function criarTentativa(cockpit: 1 | 2 = 1, inscritoEm?: Date): Promise<string> {
  const participanteId = await criarParticipante()

  const [t] = await banco.db
    .insert(schema.tentativa)
    .values({ participanteId, cockpit, ...(inscritoEm === undefined ? {} : { inscritoEm }) })
    .returning({ id: schema.tentativa.id })

  return t?.id ?? ''
}

const chave = () => randomUUID()

// ---------------------------------------------------------------------------

describe('máquina de estados (pura, sem banco)', () => {
  it('descreve exatamente as transições do SDD BC-02', () => {
    expect(permite('registrar', 'pendente')).toBe(true)
    // Quem foi dado como ausente e apareceu depois corre e tem o tempo lançado
    // direto — Ausente não volta para Pendente.
    expect(permite('registrar', 'ausente')).toBe(true)
    expect(permite('registrar', 'valida')).toBe(false)

    expect(permite('corrigir', 'valida')).toBe(true)
    expect(permite('corrigir', 'pendente')).toBe(false)
    expect(permite('corrigir', 'ausente')).toBe(false)

    expect(permite('ausentar', 'pendente')).toBe(true)
    expect(permite('ausentar', 'valida')).toBe(false)
  })

  it('só a correção preserva o instante de resolução (RF-22 + RF-31)', () => {
    expect(TRANSICOES.registrar.carimbaResolucao).toBe(true)
    expect(TRANSICOES.ausentar.carimbaResolucao).toBe(true)
    // Carimbar aqui faria um acerto de digitação mudar a posição de terceiros.
    expect(TRANSICOES.corrigir.carimbaResolucao).toBe(false)
  })

  it('a recusa é escrita para quem está com fila de gente esperando', () => {
    const mensagem = explicarRecusa('registrar', 'valida')

    expect(mensagem).toContain('correção')
    expect(mensagem).not.toMatch(/transi[çc]/i)
    expect(mensagem).not.toContain('valida')
  })
})

describe('registrar tempo (RF-17, RF-23)', () => {
  it('aceita 1min 23s 45cent e reexibe idêntico', async () => {
    const tentativaId = await criarTentativa()
    const tempoMs = parseTempo('01:23.45')

    const r = await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs,
      agora: AGORA,
    })

    expect(r.situacao).toBe('aplicado')
    if (r.situacao !== 'aplicado') return

    expect(r.tentativa.estado).toBe('valida')
    expect(r.tentativa.tempoMs).toBe(83_450)
    expect(formatTempo(r.tentativa.tempoMs ?? 0)).toBe('01:23.45')
    expect(r.tentativa.resolvidoEm?.getTime()).toBe(AGORA)
    expect(r.tentativa.operadorId).toBe(operadorId)
  })

  it('grava a linha de auditoria com autor e instante (RF-23)', async () => {
    const tentativaId = await criarTentativa()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    const historico = await historicoDaTentativa(banco.db, tentativaId)

    expect(historico).toHaveLength(1)
    expect(historico[0]?.tipo).toBe('registro')
    expect(historico[0]?.tempoMsAnterior).toBeNull()
    expect(historico[0]?.tempoMsNovo).toBe(83_450)
    // Um UUID não revela autor para quem media uma contestação no dia.
    expect(historico[0]?.operadorNome).toBe('Marina Costa')
    expect(historico[0]?.ocorridoEm.getTime()).toBe(AGORA)
  })

  it('funciona a partir de Ausente — a pessoa reapareceu e correu', async () => {
    const tentativaId = await criarTentativa()

    await marcarAusente(banco.db, { tentativaId, operadorId, chave: chave(), agora: AGORA })

    const r = await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 90_000,
      agora: AGORA + MINUTO,
    })

    expect(r.situacao).toBe('aplicado')
    if (r.situacao !== 'aplicado') return

    expect(r.tentativa.estado).toBe('valida')
    // O Lançamento original é este, não a marcação de ausência.
    expect(r.tentativa.resolvidoEm?.getTime()).toBe(AGORA + MINUTO)
  })

  it('recusa tempo fora da faixa plausível e não escreve nada', async () => {
    const tentativaId = await criarTentativa()

    for (const tempoMs of [0, -1, 100 * MINUTO, 1.5]) {
      const r = await registrarTempo(banco.db, {
        tentativaId,
        operadorId,
        chave: chave(),
        tempoMs,
        agora: AGORA,
      })
      expect(r.situacao).toBe('tempo_invalido')
    }

    expect(await banco.db.select().from(schema.lancamento)).toHaveLength(0)
  })

  it('recusa tentativa inexistente', async () => {
    const r = await registrarTempo(banco.db, {
      tentativaId: randomUUID(),
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    expect(r.situacao).toBe('tentativa_inexistente')
  })

  it('exige chave de idempotência', async () => {
    const tentativaId = await criarTentativa()

    for (const k of [null, 'nao-e-uuid', '']) {
      const r = await registrarTempo(banco.db, {
        tentativaId,
        operadorId,
        chave: k,
        tempoMs: 83_450,
        agora: AGORA,
      })
      expect(r.situacao).toBe('chave_ausente')
    }
  })
})

describe('segundo lançamento no mesmo Cockpit (RF-25)', () => {
  it('é recusado, e a recusa carrega o tempo que já está lá', async () => {
    const tentativaId = await criarTentativa()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    const segundo = await registrarTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: chave(),
      tempoMs: 99_999,
      agora: AGORA + MINUTO,
    })

    expect(segundo.situacao).toBe('transicao_recusada')
    if (segundo.situacao !== 'transicao_recusada') return

    expect(segundo.estadoAtual).toBe('valida')
    // É isto que permite ao painel oferecer a correção em vez de só dizer "não
    // deu" — e é por isso que a recusa é melhor que a sobrescrita silenciosa.
    expect(segundo.tempoMsAtual).toBe(83_450)
    expect(segundo.mensagem).toContain('correção')
  })

  it('não duplica: o tempo original permanece e a trilha tem uma linha só', async () => {
    const tentativaId = await criarTentativa()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })
    await registrarTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: chave(),
      tempoMs: 99_999,
      agora: AGORA + MINUTO,
    })

    const [linha] = await banco.db.select().from(schema.tentativa)
    expect(linha?.tempoMs).toBe(83_450)
    expect(await historicoDaTentativa(banco.db, tentativaId)).toHaveLength(1)
  })
})

describe('corrigir tempo (RF-22 + RF-31)', () => {
  it('substitui o valor e preserva o instante do lançamento original', async () => {
    const tentativaId = await criarTentativa()

    const original = await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })
    if (original.situacao !== 'aplicado') throw new Error('registro falhou')

    const corrigido = await corrigirTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: chave(),
      tempoMs: 82_000,
      // Uma hora depois: se o instante fosse recarimbado, esta Tentativa
      // perderia o desempate para quem correu depois dela (RF-31).
      agora: AGORA + 60 * MINUTO,
    })

    expect(corrigido.situacao).toBe('aplicado')
    if (corrigido.situacao !== 'aplicado') return

    expect(corrigido.tentativa.tempoMs).toBe(82_000)
    expect(corrigido.tentativa.resolvidoEm?.getTime()).toBe(AGORA)
    expect(corrigido.tentativa.estado).toBe('valida')
  })

  it('a trilha guarda anterior e novo, com o segundo autor (RF-23)', async () => {
    const tentativaId = await criarTentativa()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })
    await corrigirTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: chave(),
      tempoMs: 82_000,
      agora: AGORA + MINUTO,
    })

    const historico = await historicoDaTentativa(banco.db, tentativaId)

    expect(historico.map((l) => l.tipo)).toEqual(['registro', 'correcao'])
    expect(historico[1]?.tempoMsAnterior).toBe(83_450)
    expect(historico[1]?.tempoMsNovo).toBe(82_000)
    expect(historico[1]?.operadorNome).toBe('João Lima')
    // Append-only: a linha do registro original continua intacta.
    expect(historico[0]?.tempoMsNovo).toBe(83_450)
  })

  it('recusa corrigir o que ainda não tem tempo', async () => {
    const tentativaId = await criarTentativa()

    const r = await corrigirTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 82_000,
      agora: AGORA,
    })

    expect(r.situacao).toBe('transicao_recusada')
    if (r.situacao !== 'transicao_recusada') return
    expect(r.mensagem).toContain('Registre o tempo')
  })
})

describe('marcar ausente (RF-21)', () => {
  it('sai da Fila, mantém o cadastro e não fica com tempo', async () => {
    const tentativaId = await criarTentativa()

    expect((await listarFila(banco.db, 1)).itens).toHaveLength(1)

    const r = await marcarAusente(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      agora: AGORA,
    })

    expect(r.situacao).toBe('aplicado')
    if (r.situacao !== 'aplicado') return

    expect(r.tentativa.estado).toBe('ausente')
    expect(r.tentativa.tempoMs).toBeNull()

    expect((await listarFila(banco.db, 1)).itens).toHaveLength(0)
    // Não é exclusão: o cadastro continua inteiro.
    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
    expect(await banco.db.select().from(schema.tentativa)).toHaveLength(1)
  })

  it('não entra na Classificação, que só olha para Válidas', async () => {
    const tentativaId = await criarTentativa()
    await marcarAusente(banco.db, { tentativaId, operadorId, chave: chave(), agora: AGORA })

    const validas = await banco.db
      .select()
      .from(schema.tentativa)
      .where(eq(schema.tentativa.estado, 'valida'))

    expect(validas).toHaveLength(0)
  })

  it('registra autor e instante, como toda transição (RF-23)', async () => {
    const tentativaId = await criarTentativa()
    await marcarAusente(banco.db, { tentativaId, operadorId, chave: chave(), agora: AGORA })

    const historico = await historicoDaTentativa(banco.db, tentativaId)

    expect(historico[0]?.tipo).toBe('ausencia')
    expect(historico[0]?.tempoMsNovo).toBeNull()
    expect(historico[0]?.operadorNome).toBe('Marina Costa')
  })

  it('recusa marcar ausente quem já tem tempo', async () => {
    const tentativaId = await criarTentativa()
    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    const r = await marcarAusente(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      agora: AGORA,
    })

    expect(r.situacao).toBe('transicao_recusada')
  })
})

describe('idempotência (FL-06)', () => {
  it('a mesma chave não gera segundo lançamento', async () => {
    const tentativaId = await criarTentativa()
    const k = chave()
    const comando = { tentativaId, operadorId, chave: k, tempoMs: 83_450, agora: AGORA }

    const primeira = await registrarTempo(banco.db, comando)
    const segunda = await registrarTempo(banco.db, comando)

    expect(primeira.situacao).toBe('aplicado')
    expect(segunda.situacao).toBe('repetida')

    if (primeira.situacao === 'aplicado' && segunda.situacao === 'repetida') {
      expect(segunda.lancamentoId).toBe(primeira.lancamentoId)
      expect(segunda.tentativa.tempoMs).toBe(83_450)
      expect(segunda.tentativa.resolvidoEm?.getTime()).toBe(AGORA)
    }

    expect(await historicoDaTentativa(banco.db, tentativaId)).toHaveLength(1)
  })

  it('a mesma chave com outro tempo é conflito, não reenvio', async () => {
    const tentativaId = await criarTentativa()
    const k = chave()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: k,
      tempoMs: 83_450,
      agora: AGORA,
    })

    const r = await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: k,
      tempoMs: 82_000,
      agora: AGORA,
    })

    expect(r.situacao).toBe('chave_em_conflito')
  })

  it('a mesma chave por outro Operador é conflito — não confirmação alheia', async () => {
    const tentativaId = await criarTentativa()
    const k = chave()

    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: k,
      tempoMs: 83_450,
      agora: AGORA,
    })

    const r = await registrarTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: k,
      tempoMs: 83_450,
      agora: AGORA,
    })

    expect(r.situacao).toBe('chave_em_conflito')
  })

  it('a chave de um cadastro não vale para um lançamento', async () => {
    const tentativaId = await criarTentativa()
    const k = chave()

    await banco.db
      .insert(schema.chaveIdempotencia)
      .values({ chave: k, escopo: 'cadastro', resposta: { digestao: 'x', corpo: {} } })

    const r = await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: k,
      tempoMs: 83_450,
      agora: AGORA,
    })

    expect(r.situacao).toBe('chave_em_conflito')
  })
})

describe('concorrência entre Operadores (RF-12)', () => {
  it('dois lançamentos simultâneos: um vence, o outro recebe recusa legível', async () => {
    const tentativaId = await criarTentativa()

    const [a, b] = await Promise.all([
      registrarTempo(banco.db, {
        tentativaId,
        operadorId,
        chave: chave(),
        tempoMs: 83_450,
        agora: AGORA,
      }),
      registrarTempo(banco.db, {
        tentativaId,
        operadorId: outroOperadorId,
        chave: chave(),
        tempoMs: 99_999,
        agora: AGORA,
      }),
    ])

    const situacoes = [a.situacao, b.situacao].sort()
    expect(situacoes).toEqual(['aplicado', 'transicao_recusada'])

    // O que importa: nenhum dado perdido e nenhuma sobrescrita silenciosa.
    expect(await historicoDaTentativa(banco.db, tentativaId)).toHaveLength(1)

    const [linha] = await banco.db.select().from(schema.tentativa)
    expect([83_450, 99_999]).toContain(linha?.tempoMs)
  })

  it('duas correções simultâneas não perdem a trilha', async () => {
    const tentativaId = await criarTentativa()
    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    await Promise.all([
      corrigirTempo(banco.db, {
        tentativaId,
        operadorId,
        chave: chave(),
        tempoMs: 82_000,
        agora: AGORA + MINUTO,
      }),
      corrigirTempo(banco.db, {
        tentativaId,
        operadorId: outroOperadorId,
        chave: chave(),
        tempoMs: 81_000,
        agora: AGORA + MINUTO,
      }),
    ])

    // Correção sobre Válida é sempre permitida, então as duas passam. O que não
    // pode acontecer é uma delas sumir do histórico.
    const historico = await historicoDaTentativa(banco.db, tentativaId)
    expect(historico).toHaveLength(3)
    expect(historico.filter((l) => l.tipo === 'correcao')).toHaveLength(2)

    const [linha] = await banco.db.select().from(schema.tentativa)
    expect([82_000, 81_000]).toContain(linha?.tempoMs)
    // E o desempate continua sendo o do lançamento original.
    expect(linha?.resolvidoEm?.getTime()).toBe(AGORA)
  })
})

describe('incluir tentativa em Cockpit adicional (RF-24)', () => {
  it('participante do Cockpit 1 passa a constar no Cockpit 2, com um único cadastro', async () => {
    const participanteId = await criarParticipante()
    await banco.db.insert(schema.tentativa).values({ participanteId, cockpit: 1 })

    const r = await adicionarTentativa(banco.db, { participanteId, cockpit: 2 })

    expect(r.situacao).toBe('criada')
    if (r.situacao !== 'criada') return
    expect(r.tentativa.estado).toBe('pendente')
    expect(r.tentativa.tempoMs).toBeNull()
    // Pendente não tem autoria: a constraint do banco exige isso.
    expect(r.tentativa.operadorId).toBeNull()

    expect((await listarFila(banco.db, 1)).itens).toHaveLength(1)
    expect((await listarFila(banco.db, 2)).itens).toHaveLength(1)
    // Um único registro pessoal — é o ponto inteiro de RF-24.
    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
  })

  it('incluir de novo no mesmo Cockpit é recusado pelo banco, com mensagem de negócio', async () => {
    const participanteId = await criarParticipante()
    await banco.db.insert(schema.tentativa).values({ participanteId, cockpit: 1 })

    expect((await adicionarTentativa(banco.db, { participanteId, cockpit: 1 })).situacao).toBe(
      'ja_existe',
    )
  })

  it('participante inexistente é recusa de negócio, não erro', async () => {
    expect(
      (await adicionarTentativa(banco.db, { participanteId: randomUUID(), cockpit: 2 })).situacao,
    ).toBe('participante_inexistente')
  })
})

describe('a Fila (RF-14, RF-15, RF-16)', () => {
  it('traz só pendentes do Cockpit, do cadastro mais antigo para o mais recente', async () => {
    const base = new Date('2026-09-12T08:00:00Z').getTime()

    const antiga = await criarTentativa(1, new Date(base))
    const meio = await criarTentativa(1, new Date(base + MINUTO))
    await criarTentativa(1, new Date(base + 2 * MINUTO))
    await criarTentativa(2, new Date(base))

    await registrarTempo(banco.db, {
      tentativaId: meio,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    const fila = (await listarFila(banco.db, 1)).itens

    expect(fila).toHaveLength(2)
    expect(fila[0]?.tentativaId).toBe(antiga)
    expect(fila.map((i) => i.tentativaId)).not.toContain(meio)
    expect(await contarPendentes(banco.db, 1)).toBe(2)
    expect(await contarPendentes(banco.db, 2)).toBe(1)
  })

  it('mostra os quatro últimos dígitos do telefone, e só eles (RF-15)', async () => {
    const participanteId = await criarParticipante({ telefone: '11987654321' })
    await banco.db.insert(schema.tentativa).values({ participanteId, cockpit: 1 })

    const [item] = (await listarFila(banco.db, 1)).itens

    expect(item?.ultimos4Telefone).toBe('4321')
    expect(JSON.stringify(item)).not.toContain('11987654321')
  })

  it('distingue homônimos apenas pelo que a lista mostra (RF-15)', async () => {
    for (const telefone of ['11987654321', '11912345678']) {
      const id = await criarParticipante({ nome: 'Marina', sobrenome: 'Costa', telefone })
      await banco.db.insert(schema.tentativa).values({ participanteId: id, cockpit: 1 })
    }

    const fila = (await listarFila(banco.db, 1)).itens
    const marcas = fila.map((i) => i.ultimos4Telefone)

    expect(new Set(marcas).size).toBe(2)
  })

  it('busca por prefixo de nome ou sobrenome, sem distinguir caixa (RF-16)', async () => {
    for (const [nome, sobrenome] of [
      ['Marina', 'Costa'],
      ['Marcos', 'Silva'],
      ['Ana', 'Marques'],
      ['Bruno', 'Souza'],
    ]) {
      const id = await criarParticipante({ nome, sobrenome, telefone: '11987654321' })
      await banco.db.insert(schema.tentativa).values({ participanteId: id, cockpit: 1 })
    }

    expect((await listarFila(banco.db, 1, { busca: 'mar' })).itens).toHaveLength(3)
    expect((await listarFila(banco.db, 1, { busca: 'MAR' })).itens).toHaveLength(3)
    expect((await listarFila(banco.db, 1, { busca: 'marina' })).itens).toHaveLength(1)
    expect((await listarFila(banco.db, 1, { busca: 'sou' })).itens).toHaveLength(1)
    expect((await listarFila(banco.db, 1, { busca: 'zzz' })).itens).toHaveLength(0)
    expect((await listarFila(banco.db, 1, { busca: '   ' })).itens).toHaveLength(4)
  })

  it('o curinga do LIKE não vaza pela busca', async () => {
    const id = await criarParticipante({ nome: 'Marina', telefone: '11987654321' })
    await banco.db.insert(schema.tentativa).values({ participanteId: id, cockpit: 1 })

    // Sem escape, `%` devolveria a fila inteira e `_` casaria qualquer letra —
    // a busca mentiria para quem está procurando uma pessoa específica.
    expect((await listarFila(banco.db, 1, { busca: '%' })).itens).toHaveLength(0)
    expect((await listarFila(banco.db, 1, { busca: '_arina' })).itens).toHaveLength(0)
  })

  it('respeita o teto de itens', async () => {
    for (let i = 0; i < 5; i += 1) {
      const id = await criarParticipante({ email: `p${String(i)}@exemplo.com` })
      await banco.db.insert(schema.tentativa).values({ participanteId: id, cockpit: 1 })
    }

    expect((await listarFila(banco.db, 1, { limite: 3 })).itens).toHaveLength(3)
  })
})

describe('a trilha é append-only (RF-23)', () => {
  it('três transições produzem três linhas, nenhuma alterada', async () => {
    const tentativaId = await criarTentativa()

    await marcarAusente(banco.db, { tentativaId, operadorId, chave: chave(), agora: AGORA })
    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA + MINUTO,
    })
    await corrigirTempo(banco.db, {
      tentativaId,
      operadorId: outroOperadorId,
      chave: chave(),
      tempoMs: 82_000,
      agora: AGORA + 2 * MINUTO,
    })

    const historico = await historicoDaTentativa(banco.db, tentativaId)

    expect(historico.map((l) => l.tipo)).toEqual(['ausencia', 'registro', 'correcao'])
    expect(historico.map((l) => l.ocorridoEm.getTime())).toEqual([
      AGORA,
      AGORA + MINUTO,
      AGORA + 2 * MINUTO,
    ])
    // A contestação que o PRD §7 teme é justamente esta: dá para reconstruir o
    // que aconteceu, em ordem, com nome de quem fez.
    expect(historico.every((l) => l.operadorNome !== '')).toBe(true)
  })

  it('a autoria fica registrada na própria Tentativa fora de Pendente', async () => {
    const tentativaId = await criarTentativa()
    await registrarTempo(banco.db, {
      tentativaId,
      operadorId,
      chave: chave(),
      tempoMs: 83_450,
      agora: AGORA,
    })

    const [linha] = await banco.db
      .select()
      .from(schema.tentativa)
      .where(and(eq(schema.tentativa.id, tentativaId), eq(schema.tentativa.estado, 'valida')))

    expect(linha?.operadorId).toBe(operadorId)
    expect(linha?.resolvidoEm).not.toBeNull()
  })
})
