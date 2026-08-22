import { eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import type { Operador } from './modelo'
import { esquemaUsuario } from './schema'
import { gerarHash, validarForcaDaSenha } from './senha'

/**
 * Criação de conta de Operador (RNF-14).
 *
 * **Este módulo não tem rota.** É chamado por `scripts/criar-operador.ts`, que
 * roda no terminal de quem tem acesso ao ambiente e às credenciais do banco.
 * Não existe formulário, não existe endpoint, não existe convite por link — e
 * um teste estrutural (`tests/painelGuarda.test.ts`) falha se algum arquivo
 * sob `app/` passar a importar daqui.
 *
 * A alternativa descartada foi uma tela de administração protegida por um
 * Operador "administrador". Ela transformaria RNF-14 em "não existe
 * auto-cadastro, exceto pela tela que existe", e o custo de manter meia dúzia
 * de contas por CLI, uma vez, antes do evento, é próximo de zero.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export class OperadorDuplicadoError extends Error {
  constructor(usuario: string) {
    super(`Já existe um Operador com o usuário "${usuario}".`)
    this.name = 'OperadorDuplicadoError'
  }
}

export type DadosDoOperador = {
  readonly usuario: string
  readonly nome: string
  readonly senha: string
}

export async function criarOperador(db: Db, dados: DadosDoOperador): Promise<Operador> {
  const usuario = esquemaUsuario.parse(dados.usuario)
  const nome = validarNome(dados.nome)
  const senha = validarForcaDaSenha(dados.senha)

  const senhaHash = await gerarHash(senha)

  try {
    const [criado] = await db
      .insert(schema.operador)
      .values({ usuario, nome, senhaHash })
      .returning({ id: schema.operador.id, nome: schema.operador.nome })

    if (criado === undefined) throw new Error('Insert de Operador não devolveu linha.')

    return criado
  } catch (erro) {
    // A unicidade é do banco — inclusive a funcional, que impede `Marina` e
    // `marina` de coexistirem. Conferir antes com um SELECT seria uma corrida
    // entre a conferência e a escrita; aqui a corrida não existe.
    if (violouUnicidade(erro)) throw new OperadorDuplicadoError(usuario)
    throw erro
  }
}

/** Nome legível, mostrado no painel e usado por RF-23 para nomear a autoria. */
function validarNome(valor: unknown): string {
  const texto = typeof valor === 'string' ? valor.trim() : ''

  if (texto.length < 2 || texto.length > 80) {
    throw new Error('O nome do Operador precisa ter entre 2 e 80 caracteres.')
  }

  return texto
}

function violouUnicidade(erro: unknown): boolean {
  let atual: unknown = erro

  while (atual instanceof Error) {
    if ((atual as { code?: string }).code === '23505') return true
    if (atual.message.includes('duplicate key value')) return true
    atual = (atual as { cause?: unknown }).cause
  }

  return false
}

/**
 * Desativa a conta sem apagá-la.
 *
 * Não precisa mexer em sessão nenhuma: `resolverSessao` junta a linha do
 * Operador em toda requisição autenticada e recusa conta inativa. O acesso cai
 * na próxima chamada, incluindo as sessões já abertas em outros aparelhos — que
 * é exatamente o motivo de a sessão morar no banco.
 *
 * Apagar a conta não é opção: `tentativa.operador_id` e `lancamento.operador_id`
 * apontam para ela com `on delete restrict`, porque autoria de Lançamento
 * (RF-23) não pode desaparecer junto com o acesso.
 */
export async function desativarOperador(db: Db, usuario: string): Promise<boolean> {
  const atualizadas = await db
    .update(schema.operador)
    .set({ ativo: false })
    .where(eq(sql`lower(${schema.operador.usuario})`, usuario.trim().toLowerCase()))
    .returning({ id: schema.operador.id })

  return atualizadas.length > 0
}
