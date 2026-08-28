import { gzipSync } from 'node:zlib'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { exigeTls } from '@/db'
import * as schema from '@/db/schema'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { COM_ACENTO, SEM_ACENTO } from '@/shared/texto'
import { env } from '@/shared/env'
import { urlDoBancoDeCarga } from './banco'

/**
 * As medições de T18 que um gerador de carga não faz.
 *
 * Artillery responde "quanto tempo demorou". Estas quatro perguntas são de
 * outra natureza e cada uma decide alguma coisa:
 *
 * 1. **Quanto pesa o documento público** (T12, SDD §3). Se estourar muito a
 *    estimativa, o formato compacto precisa mudar — e é decisão de código, não
 *    de dimensionamento.
 * 2. **Quanto tempo o tempo lançado leva para aparecer** (RNF-03, ≤ 30 s).
 * 3. **Quais índices o planejador realmente escolhe** (D-56). Três foram
 *    criados em T02 por raciocínio; T10 e T12 mostraram que ele não os usa.
 *    Ou some justificativa medida, ou eles saem numa migração.
 * 4. **Quanto custa a consulta da projeção** com a massa de 4000.
 *
 * Roda contra o banco de carga, com a aplicação de pé em APP_URL.
 *
 *   npm run perf:medir
 */

carregarAmbienteDoTerminal()

const ALVO = process.env.PERF_ALVO ?? 'http://localhost:3300'

type Medida = { o_que: string; medido: string; meta: string; veredito: string }

const resultados: Medida[] = []

function anotar(o_que: string, medido: string, meta: string, passou: boolean | null): void {
  resultados.push({
    o_que,
    medido,
    meta,
    veredito: passou === null ? '—' : passou ? 'ok' : 'FALHOU',
  })
}

/** §2 — o tamanho real do documento, bruto e comprimido. */
async function medirDocumento(): Promise<void> {
  const resposta = await fetch(`${ALVO}/api/classificacao`)
  const corpo = await resposta.text()

  const bruto = Buffer.byteLength(corpo)
  const comprimido = gzipSync(corpo).byteLength
  const { total } = JSON.parse(corpo) as { total: number }

  anotar(
    `Documento público, ${String(total)} linhas — bruto`,
    `${(bruto / 1024).toFixed(1)} KB`,
    '—',
    null,
  )
  anotar(
    'Documento público — gzip',
    `${(comprimido / 1024).toFixed(1)} KB`,
    '~40 KB (estimativa do SDD)',
    comprimido < 40 * 1024,
  )
}

/**
 * §6 — do lançamento à linha na página pública (RNF-03).
 *
 * Mede pelo caminho de dentro: grava a Tentativa e pergunta ao endpoint até a
 * linha aparecer. O que sobra fora desta conta é o cache de borda, que não
 * existe localmente — some-se a janela de `s-maxage` (15 s) ao número daqui
 * para ter o do dia do evento.
 */
async function medirPropagacao(db: ReturnType<typeof drizzle<typeof schema>>): Promise<void> {
  const [pendente] = await db
    .select({ id: schema.tentativa.id })
    .from(schema.tentativa)
    .where(eq(schema.tentativa.estado, 'pendente'))
    .limit(1)

  if (pendente === undefined) {
    anotar('Propagação do lançamento (RNF-03)', 'sem Tentativa pendente', '≤ 30 s', null)
    return
  }

  const [operador] = await db.select({ id: schema.operador.id }).from(schema.operador).limit(1)

  // Um tempo que ninguém mais tem: é assim que a busca sabe que achou este, e
  // não outro qualquer da massa.
  const tempoUnico = 99_990

  const inicio = Date.now()

  await db
    .update(schema.tentativa)
    .set({
      estado: 'valida',
      tempoMs: tempoUnico,
      resolvidoEm: new Date(),
      operadorId: operador!.id,
    })
    .where(eq(schema.tentativa.id, pendente.id))

  let apareceu: number | null = null

  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    const corpo = await (await fetch(`${ALVO}/api/classificacao`)).text()

    if (corpo.includes(String(tempoUnico))) {
      apareceu = Date.now() - inicio
      break
    }

    await new Promise((resolver) => setTimeout(resolver, 1000))
  }

  anotar(
    'Propagação do lançamento até a página pública (RNF-03)',
    apareceu === null ? 'não apareceu em 60 s' : `${(apareceu / 1000).toFixed(1)} s (sem borda)`,
    '≤ 30 s',
    apareceu !== null && apareceu <= 30_000,
  )
}

/** §2 e D-56 — o que o planejador faz com a massa de 4000. */
async function medirConsultas(pool: Pool): Promise<void> {
  const consultas: { nome: string; sql: string }[] = [
    {
      nome: 'projeção da Classificação (T12)',
      sql: `select p.nome, p.sobrenome, p.idade, t.cockpit, t.tempo_ms, t.resolvido_em
            from tentativa t join participante p on p.id = t.participante_id
            where t.estado = 'valida'
            order by t.tempo_ms asc, t.resolvido_em asc`,
    },
    {
      nome: 'fila do painel, Cockpit 1 (RF-14)',
      sql: `select t.id from tentativa t
            where t.cockpit = 1 and t.estado = 'pendente'
            order by t.inscrito_em asc limit 50`,
    },
    {
      // A mesma expressão de `normalizarNoBanco` (busca.ts): `translate`, e não
      // `unaccent`. A primeira versão desta medição usou `unaccent` e morreu
      // com "função não existe" — que é o motivo pelo qual o código não a usa.
      nome: 'busca por trecho de nome (RF-16)',
      sql: `select p.id from participante p
            where translate(lower(p.nome), '${COM_ACENTO}', '${SEM_ACENTO}') like '%jo%'
               or translate(lower(p.sobrenome), '${COM_ACENTO}', '${SEM_ACENTO}') like '%jo%'
            limit 20`,
    },
  ]

  for (const consulta of consultas) {
    try {
      const plano = await pool.query<{ 'QUERY PLAN': string }>(
        `explain (analyze, buffers, format text) ${consulta.sql}`,
      )

      const linhas = plano.rows.map((l) => l['QUERY PLAN'])
      const tempo = linhas.find((l) => l.startsWith('Execution Time'))
      const indices = linhas
        .filter((l) => l.includes('Index Scan') || l.includes('Index Only Scan'))
        .map((l) => /using (\w+)/.exec(l)?.[1] ?? '?')

      anotar(
        consulta.nome,
        `${tempo ?? 'sem tempo'} · índices: ${indices.length === 0 ? 'nenhum (varredura)' : indices.join(', ')}`,
        '—',
        null,
      )
    } catch (erro) {
      anotar(consulta.nome, `falhou: ${erro instanceof Error ? erro.message : ''}`, '—', null)
    }
  }
}

/** D-56 — os três índices sob suspeita, e o que o Postgres diz do uso deles. */
async function medirUsoDeIndices(pool: Pool): Promise<void> {
  const uso = await pool.query<{ indexrelname: string; idx_scan: string }>(
    `select indexrelname, idx_scan from pg_stat_user_indexes
     where indexrelname in ('participante_nome_idx', 'participante_sobrenome_idx',
                            'tentativa_classificacao_idx', 'tentativa_fila_idx')
     order by indexrelname`,
  )

  for (const linha of uso.rows) {
    anotar(
      `índice ${linha.indexrelname}`,
      `${linha.idx_scan} varreduras desde o preparo`,
      'usado ao menos uma vez',
      Number(linha.idx_scan) > 0,
    )
  }
}

async function principal(): Promise<void> {
  const { DATABASE_URL } = env()
  const url = urlDoBancoDeCarga(DATABASE_URL)

  const pool = new Pool({
    connectionString: url,
    ssl: exigeTls(url) ? { rejectUnauthorized: true } : undefined,
    max: 2,
  })

  try {
    const db = drizzle(pool, { schema })

    await medirDocumento()
    await medirConsultas(pool)
    await medirUsoDeIndices(pool)
    await medirPropagacao(db)

    console.table(resultados)

    const falhas = resultados.filter((r) => r.veredito === 'FALHOU')
    if (falhas.length > 0) {
      console.error(`\n${String(falhas.length)} medição(ões) fora da meta.`)
      process.exit(1)
    }
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao medir:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
