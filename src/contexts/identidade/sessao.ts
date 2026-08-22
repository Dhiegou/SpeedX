import { createHmac, randomBytes } from 'node:crypto'
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { env } from '@/shared/env'
import type { Operador } from './modelo'

/**
 * Ciclo de vida da sessão do Operador (RF-11, RF-12).
 *
 * O que viaja no cookie é um número aleatório de 256 bits e nada mais — sem
 * identificador de Operador, sem prazo, sem nome. Tudo o que a sessão significa
 * está na linha do banco, e a linha é a autoridade. Duas consequências, as duas
 * desejadas: o cookie não conta nada a quem o intercepta, e encerrar a sessão é
 * escrever uma coluna, não esperar um prazo vencer.
 *
 * **Múltiplas sessões simultâneas são o comportamento normal** (RF-12). Abrir
 * uma não encerra as outras, nem as do mesmo Operador: dois tablets no mesmo
 * Pitch, ou o mesmo supervisor no celular e no notebook, é o uso previsto no
 * dia. Nada aqui invalida sessão alheia exceto o logout explícito daquela
 * sessão e a desativação da conta.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const TAMANHO_TOKEN = 32

/**
 * Chave própria, derivada do segredo da aplicação.
 *
 * Mesmo raciocínio de `tokenFormulario.ts` (T05): o `SESSION_SECRET` bruto
 * assina mais de uma coisa neste sistema, e separar por rótulo custa uma linha
 * e evita que uma fraqueza em um vire fraqueza no outro.
 */
function chave(): Buffer {
  return createHmac('sha256', env().SESSION_SECRET).update('sessao-operador/v1').digest()
}

/**
 * O que fica gravado no lugar do token.
 *
 * O token já é aleatório de 256 bits — não há dicionário a proteger, e um
 * digest simples bastaria. O HMAC entra porque custa o mesmo e acrescenta uma
 * condição: quem obtiver um despejo do banco sem o segredo da aplicação não
 * consegue nem confirmar que um token que tenha em mãos pertence àquela linha.
 */
export function digerirToken(token: string): string {
  return createHmac('sha256', chave()).update(token).digest('base64url')
}

function duracaoMs(): number {
  return env().SESSAO_HORAS * 60 * 60 * 1000
}

export type SessaoAberta = {
  readonly token: string
  readonly expiraEm: Date
}

/** Abre uma sessão e devolve o token — a única vez que ele existe em claro. */
export async function abrirSessao(
  db: Db,
  operadorId: string,
  agora: number = Date.now(),
): Promise<SessaoAberta> {
  const token = randomBytes(TAMANHO_TOKEN).toString('base64url')
  const expiraEm = new Date(agora + duracaoMs())

  await db.insert(schema.sessao).values({
    operadorId,
    tokenHash: digerirToken(token),
    criadaEm: new Date(agora),
    ultimoUsoEm: new Date(agora),
    expiraEm,
  })

  return { token, expiraEm }
}

export type SessaoValida = {
  readonly id: string
  readonly operador: Operador
  readonly expiraEm: Date
  readonly ultimoUsoEm: Date
}

/**
 * Resolve o token em Operador, ou devolve `null`.
 *
 * Uma única consulta responde as quatro perguntas que importam: a sessão
 * existe, não foi encerrada, não expirou, e a conta continua ativa. O `inner
 * join` com `operador` é o que faz a desativação de uma conta ter efeito
 * imediato — é para isso que a sessão vive no banco.
 *
 * Não distingue os motivos da recusa, e nem devia: quem chama redireciona para
 * o login em todos eles.
 */
export async function resolverSessao(
  db: Db,
  token: string | null | undefined,
  agora: number = Date.now(),
): Promise<SessaoValida | null> {
  if (typeof token !== 'string' || token.length === 0) return null

  const linhas = await db
    .select({
      id: schema.sessao.id,
      expiraEm: schema.sessao.expiraEm,
      ultimoUsoEm: schema.sessao.ultimoUsoEm,
      encerradaEm: schema.sessao.encerradaEm,
      operadorId: schema.operador.id,
      nome: schema.operador.nome,
      ativo: schema.operador.ativo,
    })
    .from(schema.sessao)
    .innerJoin(schema.operador, eq(schema.operador.id, schema.sessao.operadorId))
    .where(eq(schema.sessao.tokenHash, digerirToken(token)))
    .limit(1)

  const linha = linhas[0]

  if (linha === undefined) return null
  if (linha.encerradaEm !== null) return null
  if (linha.expiraEm.getTime() <= agora) return null
  if (!linha.ativo) return null

  return {
    id: linha.id,
    operador: { id: linha.operadorId, nome: linha.nome },
    expiraEm: linha.expiraEm,
    ultimoUsoEm: linha.ultimoUsoEm,
  }
}

/**
 * Renovação silenciosa: empurra o prazo enquanto o painel está em uso.
 *
 * **Não grava a cada requisição.** Só quando a última gravação passou de
 * `SESSAO_RENOVACAO_MINUTOS`. O que a renovação precisa garantir é que o
 * Operador não seja deslogado trabalhando; para isso, empurrar o prazo algumas
 * vezes por hora resolve, e um UPDATE por chamada do painel seria escrita pura
 * sem nada em troca — com o agravante de que a fila e a classificação disputam
 * o mesmo banco durante o evento.
 *
 * Devolve o novo prazo quando gravou, `null` quando decidiu que não era hora.
 * Quem chama usa isso para saber se precisa reescrever o cookie.
 */
export async function renovarSessao(
  db: Db,
  sessao: SessaoValida,
  agora: number = Date.now(),
): Promise<Date | null> {
  const intervaloMs = env().SESSAO_RENOVACAO_MINUTOS * 60 * 1000

  if (agora - sessao.ultimoUsoEm.getTime() < intervaloMs) return null

  const expiraEm = new Date(agora + duracaoMs())

  await db
    .update(schema.sessao)
    .set({ ultimoUsoEm: new Date(agora), expiraEm })
    .where(and(eq(schema.sessao.id, sessao.id), isNull(schema.sessao.encerradaEm)))

  return expiraEm
}

/**
 * Logout explícito.
 *
 * Marca a linha em vez de apagá-la: quando a sessão foi encerrada, e por qual
 * conta, é informação de acesso ao painel — e o painel é onde RF-23 exige
 * rastro. O expurgo por idade de T15 leva a linha embora depois do evento,
 * junto com todo o resto.
 *
 * Encerra **apenas esta** sessão. As outras do mesmo Operador continuam
 * válidas, porque RF-12 diz que elas são legítimas.
 */
export async function encerrarSessao(
  db: Db,
  token: string | null | undefined,
  agora: number = Date.now(),
): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) return

  await db
    .update(schema.sessao)
    .set({ encerradaEm: new Date(agora) })
    .where(and(eq(schema.sessao.tokenHash, digerirToken(token)), isNull(schema.sessao.encerradaEm)))
}

/**
 * Remove sessões expiradas ou encerradas. Chamado pelo expurgo de T15.
 *
 * Não é limpeza cosmética: linha de sessão liga um Operador a uma janela de
 * tempo, e nada aqui precisa sobreviver ao evento (RNF-11).
 */
export async function expurgarSessoesInativas(db: Db, agora: number = Date.now()): Promise<void> {
  await db
    .delete(schema.sessao)
    .where(or(lt(schema.sessao.expiraEm, new Date(agora)), isNotNull(schema.sessao.encerradaEm)))
}
