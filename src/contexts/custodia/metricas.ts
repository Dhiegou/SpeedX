import { and, asc, eq, gte, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'

/**
 * O painel do dia (T16 §5 — PRD §7).
 *
 * Os números que o time olha durante o evento e que **só o banco sabe**:
 * quantos se inscreveram nesta hora, quantas Tentativas continuam pendentes em
 * cada Pitch, quantos Lançamentos por minuto. Latência, erro e taxa de
 * revalidação vêm do log, por `shared/metricas.ts` — as duas metades juntas são
 * o painel; nenhuma sozinha responde.
 *
 * **Por que isto mora na Custódia.** A consulta atravessa BC-01 e BC-02 no
 * mesmo documento, e BC-05 é o único lugar do sistema autorizado a fazer isso
 * (SDD §1). A alternativa seria espalhar meia consulta em Inscrição e meia em
 * Cronometragem e somar na rota — o que move o cruzamento para fora do lugar
 * onde ele é auditável, exatamente o que a fronteira existe para impedir.
 *
 * **O que sai daqui é contagem, e a garantia é a mesma de `resumoAnonimo`:**
 * não existe `select` de nome, e-mail, telefone ou identificador neste arquivo.
 * O painel do dia responde "quantos", nunca "quem" — para saber quem falta,
 * existe o relatório de pendências de T14, que é uma exportação e como tal
 * exige a decisão consciente de baixar um arquivo com dado pessoal.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const UMA_HORA_MS = 60 * 60 * 1000

export type InscritosPorHora = { readonly hora: string; readonly total: number }

export type SituacaoDoPitch = {
  readonly pitch: number
  readonly pendentes: number
  readonly validas: number
  readonly ausentes: number
}

export type PainelDoDia = {
  readonly geradoEm: string
  readonly inscritos: {
    readonly total: number
    readonly ultimaHora: number
    readonly porHora: readonly InscritosPorHora[]
  }
  readonly pitches: readonly SituacaoDoPitch[]
  readonly lancamentos: {
    readonly total: number
    readonly correcoes: number
    /** Meta do PRD §7: ≤ 1%. `null` enquanto ninguém lançou nada. */
    readonly taxaDeCorrecao: number | null
    /** O ritmo agora, que é o que diz se a fila anda. */
    readonly ultimosCincoMinutos: number
  }
  /**
   * A métrica primária do PRD §7, cuja meta é **zero** ao fim do evento.
   *
   * Repetida aqui, e não só na exportação de T14, porque o número precisa estar
   * à vista o dia inteiro. Uma pendência descoberta às dezoito horas ainda dá
   * para resolver chamando a pessoa; a mesma no dia seguinte é um resultado
   * perdido para sempre.
   */
  readonly pendencias: number
}

const umNumero = async (consulta: Promise<{ total: number }[]>): Promise<number> => {
  const [linha] = await consulta
  return linha?.total ?? 0
}

export async function painelDoDia(db: Db, agora: Date = new Date()): Promise<PainelDoDia> {
  const umaHoraAtras = new Date(agora.getTime() - UMA_HORA_MS)
  const cincoMinutosAtras = new Date(agora.getTime() - 5 * 60_000)

  const [total, ultimaHora, porHora, pitches, lancamentos, recentes] = await Promise.all([
    umNumero(db.select({ total: sql<number>`count(*)::int` }).from(schema.participante)),

    umNumero(
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.participante)
        .where(gte(schema.participante.criadoEm, umaHoraAtras)),
    ),

    // Agrupado no fuso do evento: um gráfico de inscrições por hora lido em UTC
    // mostra o pico às dezessete quando ele foi às quatorze, e quem olha está
    // fisicamente no lugar onde são quatorze (mesma razão de `formatHoraDoEvento`).
    db
      .select({
        hora: sql<string>`to_char(${schema.participante.criadoEm} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:00')`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.participante)
      .groupBy(sql`1`)
      .orderBy(sql`1`),

    db
      .select({
        pitch: schema.tentativa.pitch,
        pendentes: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'pendente')::int`,
        validas: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'valida')::int`,
        ausentes: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'ausente')::int`,
      })
      .from(schema.tentativa)
      .groupBy(schema.tentativa.pitch)
      .orderBy(asc(schema.tentativa.pitch)),

    db
      .select({
        total: sql<number>`count(*)::int`,
        correcoes: sql<number>`count(*) filter (where ${schema.lancamento.tipo} = 'correcao')::int`,
      })
      .from(schema.lancamento),

    umNumero(
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.lancamento)
        .where(gte(schema.lancamento.ocorridoEm, cincoMinutosAtras)),
    ),
  ])

  const pendencias = await umNumero(
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.tentativa)
      .where(eq(schema.tentativa.estado, 'pendente')),
  )

  const lancados = lancamentos[0]?.total ?? 0
  const corrigidos = lancamentos[0]?.correcoes ?? 0

  return {
    geradoEm: agora.toISOString(),
    inscritos: { total, ultimaHora, porHora },
    pitches,
    lancamentos: {
      total: lancados,
      correcoes: corrigidos,
      taxaDeCorrecao: lancados === 0 ? null : corrigidos / lancados,
      ultimosCincoMinutos: recentes,
    },
    pendencias,
  }
}

/**
 * O total de inscritos, sozinho.
 *
 * É o denominador da métrica "consultas à classificação por participante"
 * (PRD §7, meta ≥ 2), que o log não tem como saber: ele conta leituras, não
 * inscritos. `npm run metricas -- --inscritos N` recebe este número.
 */
export async function contarInscritos(db: Db): Promise<number> {
  return umNumero(db.select({ total: sql<number>`count(*)::int` }).from(schema.participante))
}

/**
 * Quantas Tentativas seguem pendentes num Pitch — o alerta de fila parada.
 *
 * Separado de `painelDoDia` porque é a única consulta que alguém vai querer
 * repetir a cada minuto, e ela custa um índice já existente (`tentativa_fila_idx`).
 */
export async function contarPendentes(db: Db, pitch: number): Promise<number> {
  return umNumero(
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.tentativa)
      .where(and(eq(schema.tentativa.estado, 'pendente'), eq(schema.tentativa.pitch, pitch))),
  )
}
