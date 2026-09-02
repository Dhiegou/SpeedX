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

/**
 * TLS é exigido pelo **destino**, não pelo ambiente (FL-09).
 *
 * A regra anterior era `NODE_ENV === 'production'`, e ela errava dos dois
 * lados. Errava para menos: um desenvolvimento apontado para um banco remoto
 * trafegava a base em claro pela internet, calado. E errava para mais: o
 * artefato de produção ficava **impossível de rodar** contra um Postgres local,
 * que é exatamente o que T18 precisa para medir e o que um ensaio de
 * homologação num laptop precisaria para existir.
 *
 * O que decide é se há rede a proteger. Contra `localhost` o pacote não sai da
 * máquina; contra qualquer outro host, TLS com certificado conferido. Um
 * `DATABASE_URL` de produção apontando para Neon continua exigindo TLS, e não
 * há variável de ambiente capaz de desligar isso — a que existia, e que um dia
 * vazaria para produção, deixou de existir.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function exigeTls(urlDoBanco: string): boolean {
  try {
    return !LOOPBACK.has(new URL(urlDoBanco).hostname)
  } catch {
    // URL que não se analisa não é motivo para relaxar: exige TLS e deixa o
    // driver reclamar do endereço, que é o defeito de verdade.
    return true
  }
}

/** Host do pooler do provedor. No Neon é o mesmo endpoint com o sufixo. */
const MARCA_DO_POOLER = '-pooler.'

/**
 * Verdadeiro se a URL aponta para o pooler, e não para o Postgres.
 *
 * Serve para o comando de migração **avisar** em vez de descobrir tarde: uma
 * migração que precise de bloqueio de sessão não falha no primeiro comando,
 * falha no que o PgBouncer não repassa — com o que veio antes já aplicado.
 */
export function pareceComPooler(urlDoBanco: string): boolean {
  try {
    return new URL(urlDoBanco).hostname.includes(MARCA_DO_POOLER)
  } catch {
    return false
  }
}

/**
 * A conexão que as migrações usam: a direta, quando ela existe (D-80).
 *
 * Servir requisição e migrar querem coisas opostas. A aplicação quer o pooler,
 * porque é ele que multiplexa as funções efêmeras contra um banco de cem
 * conexões. A migração quer o Postgres, porque o pooler em modo transação não
 * repassa `CREATE INDEX CONCURRENTLY` nem bloqueio de sessão.
 *
 * Sem `DATABASE_URL_UNPOOLED` a resposta é `DATABASE_URL`, e é a resposta
 * certa: contra um Postgres local — desenvolvimento, teste, o banco de carga de
 * T18 — não há pooler nenhum e as duas são a mesma string.
 */
export function urlDeMigracao(cfg: {
  DATABASE_URL: string
  DATABASE_URL_UNPOOLED?: string
}): string {
  return cfg.DATABASE_URL_UNPOOLED ?? cfg.DATABASE_URL
}

function criarPool(): Pool {
  const { DATABASE_URL, DB_POOL_MAX } = env()

  return new Pool({
    connectionString: DATABASE_URL,
    ssl: exigeTls(DATABASE_URL) ? { rejectUnauthorized: true } : undefined,
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
