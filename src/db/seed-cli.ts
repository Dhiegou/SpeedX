import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { env } from '@/shared/env'
import * as schema from './schema'
import { popular } from './seed'

carregarAmbienteDoTerminal()

/**
 * Popula a massa de desenvolvimento. Executado por `npm run db:seed`.
 *
 * Recusa rodar em produção. A massa contém 2000 pessoas fictícias com
 * consentimento marcado como aceito; misturá-la à base real contaminaria a
 * Exportação e a Classificação do evento, e não há como distinguir depois.
 */
async function principal(): Promise<void> {
  const { DATABASE_URL, NODE_ENV } = env()

  if (NODE_ENV === 'production') {
    console.error('Recusado: `db:seed` não roda em produção.')
    process.exit(1)
  }

  const participantes = Number(process.argv[2] ?? 2000)

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 })

  try {
    const db = drizzle(pool, { schema })
    const inicio = Date.now()
    const resumo = await popular(db, { participantes })

    console.log(`Massa criada em ${((Date.now() - inicio) / 1000).toFixed(1)}s:`)
    console.table(resumo)
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao popular a massa:', erro)
  process.exit(1)
})
