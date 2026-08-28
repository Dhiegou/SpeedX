import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '@/shared/env'
import * as schema from './schema'

/**
 * Conexão com o banco. Só existe no servidor (SDD: nenhum acesso a dados parte
 * do dispositivo do usuário final).
 *
 * O pool é criado sob demanda e reaproveitado: em desenvolvimento o Next
 * recarrega módulos a cada alteração, e criar um pool por recarga esgota as
 * conexões do Postgres antes de qualquer teste de carga.
 */

declare global {
  var __speedxPool: Pool | undefined
}

function criarPool(): Pool {
  const { DATABASE_URL, NODE_ENV, DB_POOL_MAX } = env()

  return new Pool({
    connectionString: DATABASE_URL,
    // TLS obrigatório fora de desenvolvimento (SDD FL-09).
    ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    // O painel precisa de resposta previsível sob pressão: melhor falhar rápido
    // e o Operador repetir do que a requisição pendurar sem retorno (RNF-16).
    connectionTimeoutMillis: 5_000,
    // Em função efêmera a instância congela entre requisições, e uma conexão
    // ociosa segurada por trinta segundos é uma conexão que o pooler não pode
    // dar a mais ninguém. Dez segundos devolvem o assento entre picos sem
    // pagar o custo de reconectar dentro de uma rajada (T19 §5).
    idleTimeoutMillis: 10_000,
    // Por instância. Quem protege o Postgres do produto disto pelo número de
    // instâncias é o pooler do provedor, não este número (D-80).
    max: DB_POOL_MAX,
  })
}

export function pool(): Pool {
  globalThis.__speedxPool ??= criarPool()
  return globalThis.__speedxPool
}

let memo: NodePgDatabase<typeof schema> | undefined

/** Cliente Drizzle tipado pelo esquema. */
export function db(): NodePgDatabase<typeof schema> {
  memo ??= drizzle(pool(), { schema })
  return memo
}

export { schema }
