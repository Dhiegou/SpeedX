import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { env } from '@/shared/env'

carregarAmbienteDoTerminal()

/**
 * Aplica as migrações pendentes. Executado por `npm run db:migrate`.
 *
 * Usa um pool próprio, de uma conexão, e fecha ao terminar: o pool da aplicação
 * (src/db/index.ts) é global e ficaria pendurado, deixando o comando sem sair.
 */
async function principal(): Promise<void> {
  const { DATABASE_URL, NODE_ENV } = env()

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    max: 1,
  })

  try {
    await migrate(drizzle(pool), { migrationsFolder: './src/db/migrations' })
    console.log('Migrações aplicadas.')
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao aplicar migrações:', erro)
  process.exit(1)
})
