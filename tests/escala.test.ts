import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/db/schema'
import { popular, type ResumoSeed } from '@/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * RNF-02 na escala contratada: 2000 Participantes e as Tentativas que eles
 * geram, sem degradação perceptível.
 *
 * Roda contra PGlite, que é Postgres de verdade mas em WebAssembly e num único
 * processo — os tempos aqui são **piores** que os de um Postgres gerenciado com
 * disco e cache próprios. Servem como piso, não como medida: a medição oficial
 * de desempenho é T18, com o banco real e o provedor escolhido.
 */

let banco: BancoDeTeste
let resumo: ResumoSeed

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  resumo = await popular(banco.db, { participantes: 2000 })
}, 300_000)

afterAll(async () => {
  await banco.encerrar()
})

describe('RNF-02 — volume do evento', () => {
  it('suporta 2000 participantes e as tentativas correspondentes', () => {
    expect(resumo.participantes).toBe(2000)
    expect(resumo.tentativas).toBeGreaterThanOrEqual(2000)
    expect(resumo.validas).toBeGreaterThan(1000)
  })

  it('a Fila de um Cockpit responde rápido com a base cheia (RNF-16)', async () => {
    const inicio = performance.now()

    const fila = await banco.db
      .select({
        id: schema.tentativa.id,
        participanteId: schema.tentativa.participanteId,
        inscritoEm: schema.tentativa.inscritoEm,
      })
      .from(schema.tentativa)
      .where(sql`cockpit = 1 and estado = 'pendente'`)
      .orderBy(schema.tentativa.inscritoEm)

    const decorrido = performance.now() - inicio

    expect(fila.length).toBeGreaterThan(0)
    expect(decorrido).toBeLessThan(250)
  })

  it('a projeção da Classificação é montada em uma consulta ordenada (RF-31)', async () => {
    const inicio = performance.now()

    const linhas = await banco.cliente.query<{
      id: string
      nome: string
      sobrenome: string
      cockpit: number
      tempo_ms: number
    }>(`
      select t.id, p.nome, p.sobrenome, t.cockpit, t.tempo_ms
      from tentativa t
      join participante p on p.id = t.participante_id
      where t.estado = 'valida'
      order by t.tempo_ms asc, t.resolvido_em asc, t.id asc
    `)

    const decorrido = performance.now() - inicio

    expect(linhas.rows.length).toBe(resumo.validas)
    expect(decorrido).toBeLessThan(500)

    // Ordenação de fato crescente, sem depender da ordem de inserção.
    const tempos = linhas.rows.map((l) => l.tempo_ms)
    expect([...tempos].sort((a, b) => a - b)).toEqual(tempos)
  })

  it('a Classificação nunca inclui Ausente nem Pendente (RF-21)', async () => {
    const indevidos = await banco.cliente.query<{ n: number }>(`
      select count(*)::int as n from tentativa
      where estado <> 'valida' and tempo_ms is not null
    `)

    expect(indevidos.rows[0]!.n).toBe(0)
  })
})
