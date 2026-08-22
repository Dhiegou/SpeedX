import { eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { consumirLimite, verificarLimite } from '@/infra/limiteDeTaxa'
import type { Operador } from './modelo'
import {
  ESCOPO_LOGIN_ORIGEM,
  ESCOPO_LOGIN_USUARIO,
  identificarOrigem,
  identificarUsuario,
  politicaPorOrigem,
  politicaPorUsuario,
} from './politicaDeLogin'
import { esquemaCredencial } from './schema'
import { conferirSenha, gastarTempoDeConferencia } from './senha'
import { abrirSessao } from './sessao'

/**
 * Caso de uso do login (RF-11, FL-04).
 *
 * Recebe o banco por parâmetro, como todo caso de uso deste projeto: é o que
 * permite testá-lo contra um Postgres real sem subir servidor nem simular nada
 * do que importa.
 *
 * A saída é uma união fechada de situações. A rota traduz situação em status
 * HTTP; acrescentar uma situação sem lhe dar status não compila.
 *
 * **Uma recusa só.** Usuário inexistente, conta desativada, senha errada e
 * corpo malformado saem todos como `credenciais_invalidas`, e todos gastam o
 * mesmo tempo. A resposta genérica exigida pela T08 não é uma frase na tela: é
 * a impossibilidade de distinguir os casos por texto, por status ou por
 * relógio.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export type ComandoLogin = {
  /** Corpo cru da requisição. Ainda não é uma credencial. */
  readonly corpo: unknown
  /** Endereço de origem, em claro. Vira HMAC antes de tocar o banco. */
  readonly origem: string | null
  readonly agora?: number
}

export type ResultadoLogin =
  | {
      readonly situacao: 'autenticado'
      readonly operador: Operador
      /** Só existe em claro aqui. Quem chama põe no cookie e esquece. */
      readonly token: string
      readonly expiraEm: Date
    }
  | { readonly situacao: 'credenciais_invalidas' }
  | { readonly situacao: 'limite_excedido'; readonly esperarSegundos: number }

export async function autenticar(db: Db, comando: ComandoLogin): Promise<ResultadoLogin> {
  const agora = comando.agora ?? Date.now()

  const analise = esquemaCredencial.safeParse(comando.corpo)

  const identificadorOrigem = identificarOrigem(comando.origem)
  const identificadorUsuario = analise.success ? identificarUsuario(analise.data.usuario) : null

  // O limite é conferido antes da derivação da senha, e não depois. Depois
  // seria tarde: cada tentativa recusada já teria custado 64 MiB e dois
  // décimos de segundo, e o próprio mecanismo de contenção viraria o vetor.
  for (const [politica, identificador] of [
    [politicaPorOrigem(), identificadorOrigem],
    [politicaPorUsuario(), identificadorUsuario],
  ] as const) {
    const veredito = await verificarLimite(db, politica, identificador, agora)

    if (!veredito.permitido) {
      return { situacao: 'limite_excedido', esperarSegundos: veredito.esperarSegundos }
    }
  }

  const recusar = async (): Promise<ResultadoLogin> => {
    await consumirLimite(db, ESCOPO_LOGIN_ORIGEM, identificadorOrigem, new Date(agora))
    await consumirLimite(db, ESCOPO_LOGIN_USUARIO, identificadorUsuario, new Date(agora))

    return { situacao: 'credenciais_invalidas' }
  }

  if (!analise.success) {
    // Corpo sem senha utilizável ainda gasta o tempo de uma conferência. Sem
    // isso, um cliente descobre a forma esperada do corpo pelo relógio.
    await gastarTempoDeConferencia('')
    return recusar()
  }

  const { usuario, senha } = analise.data

  const linhas = await db
    .select({
      id: schema.operador.id,
      nome: schema.operador.nome,
      senhaHash: schema.operador.senhaHash,
      ativo: schema.operador.ativo,
    })
    .from(schema.operador)
    // Comparação sem distinção de caixa: quem digita o próprio usuário num
    // tablet, com pressa, não deve ser recusado por uma maiúscula.
    .where(eq(sql`lower(${schema.operador.usuario})`, usuario.toLowerCase()))
    .limit(1)

  const encontrado = linhas[0]

  if (encontrado === undefined) {
    await gastarTempoDeConferencia(senha)
    return recusar()
  }

  const senhaConfere = await conferirSenha(senha, encontrado.senhaHash)

  // A conta desativada é conferida **depois** da senha, e não antes. Antes, o
  // tempo de resposta diria "esta conta existe e está desligada" a quem nem
  // sabia a senha.
  if (!senhaConfere || !encontrado.ativo) return recusar()

  const { token, expiraEm } = await abrirSessao(db, encontrado.id, agora)

  // Sucesso não consome cota. É a mesma regra do cadastro (D-27), pelo motivo
  // oposto ao daquele caso: aqui a cota existe para o erro, e um Operador que
  // acerta a senha dez vezes no dia — porque abriu o painel em dois tablets e
  // recarregou — não pode ficar sem login no meio do evento.
  return {
    situacao: 'autenticado',
    operador: { id: encontrado.id, nome: encontrado.nome },
    token,
    expiraEm,
  }
}
