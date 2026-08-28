import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/db/schema'
import { popular, type ResumoSeed } from '@/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * RNF-02: 2000 cadastros e 4000 tempos sem degradação perceptível.
 *
 * Este teste popula uma fração da massa (o volume completo é exercitado em
 * T18, com o banco real) e verifica o que importa aqui: que a massa reproduz os
 * casos difíceis, e que as consultas quentes do evento usam índice em vez de
 * varrer a tabela inteira.
 */

let banco: BancoDeTeste
let resumo: ResumoSeed

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  resumo = await popular(banco.db, { participantes: 300 })
}, 120_000)

afterAll(async () => {
  await banco.encerrar()
})

describe('massa de desenvolvimento', () => {
  it('gera participantes e tentativas na proporção esperada', () => {
    expect(resumo.participantes).toBe(300)
    // Metade corre os dois Cockpits: entre 1x e 2x o número de pessoas.
    expect(resumo.tentativas).toBeGreaterThan(resumo.participantes)
    expect(resumo.tentativas).toBeLessThanOrEqual(resumo.participantes * 2)
    expect(resumo.validas + resumo.ausentes + resumo.pendentes).toBe(resumo.tentativas)
  })

  it('inclui menores de idade com responsável e consentimento do responsável', async () => {
    expect(resumo.menores).toBeGreaterThan(0)

    const responsaveis = await banco.db.select().from(schema.responsavel)
    expect(responsaveis).toHaveLength(resumo.menores)

    const semAceite = await banco.cliente.query<{ n: number }>(`
      select count(*)::int as n from consentimento c
      join participante p on p.id = c.participante_id
      where p.idade < 18 and c.aceite_responsavel is not true
    `)
    expect(semAceite.rows[0]!.n).toBe(0)
  })

  it('RF-15 — inclui homônimos, que é o caso difícil do painel', async () => {
    const homonimos = await banco.cliente.query<{ n: number }>(`
      select count(*)::int as n from (
        select nome, sobrenome from participante
        group by nome, sobrenome having count(*) > 1
      ) t
    `)

    expect(homonimos.rows[0]!.n).toBeGreaterThan(0)
  })

  it('RF-31 — inclui tempos empatados, que é o que exercita o desempate', async () => {
    const empates = await banco.cliente.query<{ n: number }>(`
      select count(*)::int as n from (
        select tempo_ms from tentativa
        where estado = 'valida'
        group by tempo_ms having count(*) > 1
      ) t
    `)

    expect(empates.rows[0]!.n).toBeGreaterThan(0)
  })

  it('inclui ausentes e pendentes — Fila e Exportação divergem aqui', () => {
    expect(resumo.ausentes).toBeGreaterThan(0)
    expect(resumo.pendentes).toBeGreaterThan(0)
  })

  it('é determinística: mesma semente, mesma massa', async () => {
    const outro = await criarBancoDeTeste()
    try {
      const segundo = await popular(outro.db, { participantes: 300 })
      expect(segundo).toEqual(resumo)
    } finally {
      await outro.encerrar()
    }
  }, 120_000)
})

describe('consultas quentes do evento', () => {
  it('RF-14 — a Fila de um Cockpit usa índice, não varredura', async () => {
    const plano = await banco.cliente.query<{ 'QUERY PLAN': string }>(`
      explain select id, participante_id, inscrito_em
      from tentativa
      where cockpit = 1 and estado = 'pendente'
      order by inscrito_em
    `)

    const texto = plano.rows.map((r) => r['QUERY PLAN']).join('\n')
    expect(texto).toMatch(/tentativa_fila_idx/)
  })

  it('a Fila devolve apenas pendentes, da inscrição mais antiga para a mais recente', async () => {
    const fila = await banco.db
      .select({ inscritoEm: schema.tentativa.inscritoEm, estado: schema.tentativa.estado })
      .from(schema.tentativa)
      .where(sql`cockpit = 1 and estado = 'pendente'`)
      .orderBy(schema.tentativa.inscritoEm)

    expect(fila.every((t) => t.estado === 'pendente')).toBe(true)

    const instantes = fila.map((t) => t.inscritoEm.getTime())
    expect([...instantes].sort((a, b) => a - b)).toEqual(instantes)
  })

  it('RF-16 — a busca por prefixo de nome pode usar o índice', async () => {
    // `enable_seqscan = off` isola a pergunta que interessa: o índice **serve**
    // para esta consulta? Com poucas centenas de linhas o planejador prefere
    // varredura por custo, e o teste passaria a medir o tamanho da massa em vez
    // da forma do índice. Foi assim que se descobriu que faltava
    // `text_pattern_ops` — sem ele o índice existe e nunca é usado.
    await banco.cliente.exec('set enable_seqscan = off')

    const plano = await banco.cliente.query<{ 'QUERY PLAN': string }>(`
      explain select id from participante where lower(nome) like 'jo%'
    `)

    await banco.cliente.exec('set enable_seqscan = on')

    const texto = plano.rows.map((r) => r['QUERY PLAN']).join('\n')
    expect(texto).toMatch(/participante_nome_idx/)
  })
})
