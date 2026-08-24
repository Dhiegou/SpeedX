import { loadEnvConfig } from '@next/env'
import { prepararBanco } from './preparar'

/**
 * O que roda uma vez, antes de qualquer navegador subir (T17).
 *
 * Separado de `preparar.ts` porque aquele arquivo não lê ambiente: recebe a
 * URL e faz o trabalho. Este é a casca que o Playwright chama, e é o único
 * lugar que conhece `process.env`.
 */
export default async function global(): Promise<void> {
  loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined })

  const base = process.env.DATABASE_URL

  if (base === undefined || base === '') {
    throw new Error(
      'DATABASE_URL não definida. Os testes de ponta a ponta precisam de um Postgres de pé:\n' +
        'eles criam um banco próprio (speedx_e2e) a partir dessa credencial e não tocam no seu.',
    )
  }

  await prepararBanco(base)
}
