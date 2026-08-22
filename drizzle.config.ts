import { defineConfig } from 'drizzle-kit'

/**
 * Migrações versionadas: o esquema mora no código e cada alteração vira um
 * arquivo SQL revisável. O evento dura um dia e não tem janela de manutenção —
 * alteração de esquema improvisada no terminal não deixa rastro nem volta atrás.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
