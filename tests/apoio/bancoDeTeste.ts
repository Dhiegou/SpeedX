import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/db/schema'

/**
 * Banco de teste real — Postgres de verdade, compilado para WebAssembly.
 *
 * As invariantes que mais importam neste sistema (RF-25, RF-04, coerência entre
 * estado e tempo) vivem em constraints do banco. Testá-las contra um mock
 * verificaria a existência do mock, não da regra. PGlite dá o mesmo motor de
 * constraints do Postgres sem exigir serviço externo, o que mantém a suíte
 * rodando em qualquer máquina e no CI.
 *
 * Produção usa `pg` contra um Postgres gerenciado (src/db/index.ts).
 */
export type BancoDeTeste = {
  db: PgliteDatabase<typeof schema>
  cliente: PGlite
  encerrar: () => Promise<void>
}

export async function criarBancoDeTeste(): Promise<BancoDeTeste> {
  const cliente = new PGlite()
  const db = drizzle(cliente, { schema })

  // As mesmas migrações que vão para produção. Testar contra um esquema
  // montado à parte esconderia justamente o erro de migração.
  await migrate(db, { migrationsFolder: './src/db/migrations' })

  return {
    db,
    cliente,
    encerrar: () => cliente.close(),
  }
}

/**
 * Executa uma operação que **deve** violar uma constraint e devolve o texto do
 * erro, incluindo as causas encadeadas.
 *
 * O Drizzle embrulha o erro do Postgres num "Failed query: ..." e empurra a
 * mensagem original — com o nome da constraint — para `cause`. Sem desembrulhar,
 * o teste passaria com qualquer falha de escrita, inclusive um erro de sintaxe:
 * verificaria que a linha não entrou, não que a regra a recusou.
 *
 * Falha se a operação for aceita, que é o defeito que estes testes procuram.
 */
export async function violou(operacao: Promise<unknown>): Promise<string> {
  try {
    await operacao
  } catch (erro) {
    const partes: string[] = []
    let atual: unknown = erro

    while (atual instanceof Error) {
      partes.push(atual.message)
      atual = (atual as { cause?: unknown }).cause
    }

    return partes.join(' | ')
  }

  throw new Error('Esperava violação de constraint, mas o banco aceitou a operação.')
}

/** Participante válido mínimo, para quando o foco do teste é outra coisa. */
export function participanteValido(sobrescrever: Record<string, unknown> = {}) {
  return {
    nome: 'Marina',
    sobrenome: 'Costa',
    email: 'marina@exemplo.com',
    telefone: '11987654321',
    idade: 30,
    ...sobrescrever,
  }
}
