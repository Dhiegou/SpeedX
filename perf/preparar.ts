import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { criarOperador } from '@/contexts/identidade/criarOperador'
import * as schema from '@/db/schema'
import { popular } from '@/db/seed'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { env } from '@/shared/env'
import {
  NOME_DO_BANCO_DE_CARGA,
  OPERADOR_DE_CARGA,
  urlAdministrativa,
  urlDoBancoDeCarga,
} from './banco'

/**
 * Banco de carga: 2000 Participantes e 4000 Tentativas (T18 §1, RNF-02).
 *
 * **Banco próprio, como o do e2e, e pelo mesmo motivo dobrado.** A massa de
 * carga é o pior caso — todo mundo nos dois Cockpits —, e não é a massa
 * realista com que se desenvolve. Misturar as duas estragaria as duas: o
 * desenvolvimento passaria a ver uma base que não existe, e a medição passaria
 * a depender do que alguém tenha deixado no banco de ontem.
 *
 * **Por que 4000 e não os ~3000 do seed padrão.** O seed de T02 coloca metade
 * da massa nos dois Cockpits, que é a distribuição realista. T18 mede o **teto**
 * do evento: se toda pessoa inscrita disputar os dois, são 4000 Tentativas e é
 * esse o documento público mais pesado que a Classificação pode ter que servir.
 * Medir contra a média mede o dia bom.
 */

carregarAmbienteDoTerminal()

/** Falta de privilégio para criar banco. Qualquer outro erro é defeito. */
const semPrivilegio = (erro: unknown): boolean =>
  typeof (erro as { code?: unknown }).code === 'string' &&
  ['42501', '42P04'].includes((erro as { code: string }).code)

async function garantirBanco(base: string): Promise<void> {
  const admin = new Pool({ connectionString: urlAdministrativa(base), max: 1 })

  try {
    const existe = await admin.query('select 1 from pg_database where datname = $1', [
      NOME_DO_BANCO_DE_CARGA,
    ])

    if (existe.rowCount !== 0) return

    const consulta = await admin.query<{ papel: string }>('select current_user as papel')
    const papel = consulta.rows[0]?.papel ?? 'o papel da aplicação'

    try {
      await admin.query(`create database ${NOME_DO_BANCO_DE_CARGA}`)
    } catch (erro) {
      if (semPrivilegio(erro)) {
        throw new Error(
          `O banco "${NOME_DO_BANCO_DE_CARGA}" não existe e o papel "${papel}" não pode criá-lo.\n\n` +
            'Resolva uma vez, com um papel administrativo:\n\n' +
            `  psql -c 'alter role "${papel}" createdb'\n` +
            `  psql -c 'create database ${NOME_DO_BANCO_DE_CARGA} owner "${papel}"'\n`,
        )
      }
      throw erro
    }
  } finally {
    await admin.end()
  }
}

async function principal(): Promise<void> {
  const { DATABASE_URL, NODE_ENV } = env()

  if (NODE_ENV === 'production') {
    console.error('Recusado: o preparo de carga não roda em produção.')
    process.exit(1)
  }

  await garantirBanco(DATABASE_URL)

  const pool = new Pool({ connectionString: urlDoBancoDeCarga(DATABASE_URL), max: 1 })

  try {
    const db = drizzle(pool, { schema })

    await migrate(db, { migrationsFolder: './src/db/migrations' })

    // Do zero a cada execução: comparar duas medições exige a mesma massa nas
    // duas, e massa acumulada de execução anterior é ruído silencioso.
    await pool.query(`
      truncate table lancamento, tentativa, consentimento, responsavel, participante,
                     sessao, operador, chave_idempotencia, limite_taxa cascade;
    `)

    const inicio = Date.now()
    const resumo = await popular(db, { participantes: 2000, proporcaoNosDoisCockpits: 1 })

    await criarOperador(db, OPERADOR_DE_CARGA)

    console.log(`Banco "${NOME_DO_BANCO_DE_CARGA}" pronto em ${String(Date.now() - inicio)} ms:`)
    console.table(resumo)
    console.log(`Operador para o teste de escrita: ${OPERADOR_DE_CARGA.usuario}`)
    console.log(
      `\nSuba a aplicação contra ele:\n  DATABASE_URL="${urlDoBancoDeCarga(DATABASE_URL)}"`,
    )
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao preparar o banco de carga:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
