import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { exigeTls, pareceComPooler, urlDeMigracao } from '@/db'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { env } from '@/shared/env'

carregarAmbienteDoTerminal()

/** Host, sem usuário nem senha — o comando diz para onde vai, não a credencial. */
function destino(urlDoBanco: string): string {
  try {
    return new URL(urlDoBanco).host
  } catch {
    return '(endereço ilegível)'
  }
}

/**
 * Aplica as migrações pendentes. Executado por `npm run db:migrate`.
 *
 * Usa um pool próprio, de uma conexão, e fecha ao terminar: o pool da aplicação
 * (src/db/index.ts) é global e ficaria pendurado, deixando o comando sem sair.
 *
 * Vai pela conexão **direta** quando ela existe (`urlDeMigracao`, D-80). O
 * pool da aplicação continua no pooler; aqui ele seria uma armadilha silenciosa
 * — ver o comentário de `DATABASE_URL_UNPOOLED` em `src/shared/env.ts`.
 */
async function principal(): Promise<void> {
  const { DATABASE_URL, DATABASE_URL_UNPOOLED } = env()
  const urlDoBanco = urlDeMigracao({ DATABASE_URL, DATABASE_URL_UNPOOLED })

  console.log(`Migrando contra ${destino(urlDoBanco)}`)

  if (pareceComPooler(urlDoBanco)) {
    // Não é erro: contra um banco sem migração pesada isto passa. É aviso
    // porque, no dia em que não passar, a falha chega no meio do caminho.
    console.warn(
      `Aviso: esta é a conexão do pooler, e migração quer a direta.
Defina DATABASE_URL_UNPOOLED — .env.example, docs/deploy.md §3.
O PgBouncer em modo transação não repassa CREATE INDEX CONCURRENTLY nem
bloqueio de sessão: a migração que precisar de um dos dois falha no meio,
com o que veio antes já aplicado.`,
    )
  }

  const pool = new Pool({
    connectionString: urlDoBanco,
    // Mesma regra da aplicação: TLS pelo destino, não pelo ambiente.
    ssl: exigeTls(urlDoBanco) ? { rejectUnauthorized: true } : undefined,
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
