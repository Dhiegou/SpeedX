import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'

/**
 * Idempotência de escrita — infraestrutura, não domínio (SDD §4.3, FL-03 e FL-06).
 *
 * Nasceu dentro de Inscrição em T05. Sai de lá em T09 pelo mesmo motivo que o
 * limite de taxa saiu em T08 (D-38): Cronometragem precisa do mesmo mecanismo e
 * não pode importar Inscrição — o lint recusa, e o SDD §2 é a razão.
 *
 * **O problema que isto resolve.** Confiabilidade de transporte garante entrega,
 * não unicidade de efeito. Se a confirmação se perde no retorno, o Operador
 * aperta de novo e a operação executa duas vezes. Num cadastro isso é um
 * participante duplicado; num lançamento é um Tempo gravado duas vezes, com duas
 * linhas de auditoria contando histórias diferentes sobre o mesmo ato.
 *
 * **Por que a digestão do envio entra junto.** Guardar só "esta chave já foi
 * usada" não basta. Duas requisições diferentes que por acidente compartilhem a
 * chave fariam a segunda receber a resposta da primeira — no cadastro isso é o
 * nome de outra pessoa na tela de confirmação (D-28), no painel é o Operador
 * vendo confirmado um tempo que ele não lançou. A digestão transforma isso em
 * conflito explícito.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Formato exigido da chave. UUID gerado uma vez por tentativa de envio. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function chaveValida(chave: unknown): chave is string {
  return typeof chave === 'string' && UUID.test(chave)
}

/**
 * Representação estável de um valor, para saber se dois usos da mesma chave são
 * o mesmo envio.
 *
 * Chaves de objeto em ordem alfabética, e o chamador diz o que ignorar: o token
 * do formulário muda a cada carga da página, e um reenvio legítimo depois de
 * recarregar traria outro. Se ele entrasse na digestão, a retentativa mais comum
 * viraria conflito.
 */
function canonizar(valor: unknown, ignorar: ReadonlySet<string>): unknown {
  if (Array.isArray(valor)) return valor.map((v) => canonizar(v, ignorar))

  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([nome]) => !ignorar.has(nome))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([nome, v]) => [nome, canonizar(v, ignorar)]),
    )
  }

  return valor
}

export function digerir(valor: unknown, ignorar: ReadonlySet<string> = new Set()): string {
  const canonico = JSON.stringify(canonizar(valor, ignorar)) ?? 'indefinido'

  return createHash('sha256').update(canonico).digest('base64url')
}

/** O que fica guardado sob a chave. */
export type EfeitoGuardado<T> = { readonly digestao: string; readonly corpo: T }

function lerEfeito<T>(valor: unknown): EfeitoGuardado<T> | null {
  if (valor === null || typeof valor !== 'object') return null

  const { digestao, corpo } = valor as Record<string, unknown>

  return typeof digestao === 'string' && corpo !== null && typeof corpo === 'object'
    ? { digestao, corpo: corpo as T }
    : null
}

/** Violação de unicidade do Postgres, atravessando o embrulho do Drizzle. */
export function violouUnicidade(erro: unknown): boolean {
  let atual: unknown = erro

  while (atual !== null && typeof atual === 'object') {
    if ((atual as { code?: unknown }).code === '23505') return true
    atual = (atual as { cause?: unknown }).cause
  }

  return false
}

export type ConsultaDeEfeito<T> =
  /** Chave inédita: a operação deve executar. */
  | { readonly situacao: 'inedita' }
  /** Mesma chave, mesmo envio: devolver o que foi guardado, sem reexecutar. */
  | { readonly situacao: 'repetida'; readonly corpo: T }
  /** Mesma chave, outro envio — ou outro escopo. Não é reenvio: é colisão. */
  | { readonly situacao: 'conflito' }

/**
 * Procura o efeito guardado sob a chave.
 *
 * Busca pela chave sozinha, e não pelo par com o escopo, porque `chave` é a
 * primária da tabela: a mesma chave em outro escopo não seria um registro
 * paralelo, seria um INSERT recusado no meio da transação. Melhor descobrir
 * aqui e responder conflito do que virar 500 durante o evento.
 */
export async function consultarEfeito<T>(
  db: Db,
  chave: string,
  escopo: string,
  digestao: string,
): Promise<ConsultaDeEfeito<T>> {
  const [linha] = await db
    .select({
      escopo: schema.chaveIdempotencia.escopo,
      resposta: schema.chaveIdempotencia.resposta,
    })
    .from(schema.chaveIdempotencia)
    .where(eq(schema.chaveIdempotencia.chave, chave))
    .limit(1)

  if (linha === undefined) return { situacao: 'inedita' }
  if (linha.escopo !== escopo) return { situacao: 'conflito' }

  const guardado = lerEfeito<T>(linha.resposta)

  if (guardado === null || guardado.digestao !== digestao) return { situacao: 'conflito' }

  return { situacao: 'repetida', corpo: guardado.corpo }
}

/**
 * Grava o efeito. **Recebe a transação da operação**, nunca a conexão solta.
 *
 * A chave e o efeito entram junto com a escrita que eles descrevem, ou não
 * entram: gravar a chave fora da transação registraria como concluída uma
 * operação que ainda pode ser desfeita.
 */
export async function guardarEfeito<T>(
  tx: Db,
  chave: string,
  escopo: string,
  digestao: string,
  corpo: T,
): Promise<void> {
  await tx.insert(schema.chaveIdempotencia).values({
    chave,
    escopo,
    resposta: { digestao, corpo } satisfies EfeitoGuardado<T>,
  })
}
