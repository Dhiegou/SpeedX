import type { NextRequest } from 'next/server'
import type { ResultadoLogin } from '@/contexts/identidade/autenticar'
import { entrar, exigirOperadorNaApi, sair } from '@/contexts/identidade/servico'
import { registrarOperacao, type ResultadoOperacao } from '@/shared/log'
import { ehTipo, enderecoDeOrigem } from '@/shared/requisicao'

/**
 * `/api/painel/sessao` — a sessão do Operador como recurso (T08, RF-11, RF-12).
 *
 *   POST   cria a sessão (login)
 *   DELETE encerra a sessão (logout)
 *   GET    devolve quem está logado — e é a rota que prova a guarda de API
 *
 * Não decide nada sobre autenticação: lê a requisição, chama o caso de uso e
 * traduz situação em status. Toda regra — validação, limite, conferência de
 * senha, abertura de sessão — está em `autenticar`, onde o teste alcança sem
 * subir servidor.
 *
 * Não há `PUT` nem qualquer verbo que crie **conta**. RNF-14 não é uma escolha
 * de interface: não existe caminho HTTP até `criarOperador`, e
 * `tests/painelGuarda.test.ts` falha se algum arquivo sob `app/` passar a
 * importá-lo.
 */

const TIPO_ESPERADO = 'application/json'

/** Uma credencial não passa de algumas centenas de bytes. */
const TAMANHO_MAXIMO = 4 * 1024

/** Nunca em cache: identidade não é documento. */
const CABECALHOS = { 'Cache-Control': 'no-store' } as const

function responder(corpo: unknown, status: number, extras: Record<string, string> = {}): Response {
  return Response.json(corpo, { status, headers: { ...CABECALHOS, ...extras } })
}

function falha(codigo: string, mensagem: string, status: number, extras = {}): Response {
  return responder({ erro: { codigo, mensagem } }, status, extras)
}

/**
 * A recusa genérica (T08, item 1 do escopo).
 *
 * Uma frase só para usuário inexistente, conta desativada, senha errada e corpo
 * malformado. O caso de uso já os gastou no mesmo tempo; se o texto os
 * separasse, o cuidado com o relógio teria sido em vão.
 */
function recusaGenerica(): Response {
  return falha('credenciais_invalidas', 'Usuário ou senha incorretos.', 401)
}

function traduzir(resultado: ResultadoLogin): {
  resposta: Response
  registro: { resultado: ResultadoOperacao; motivo?: string; referencia?: string }
} {
  switch (resultado.situacao) {
    case 'autenticado':
      return {
        // O corpo carrega o mínimo que o painel precisa para se desenhar. O
        // token não aparece aqui: ele já foi para o cookie `HttpOnly`, e
        // devolvê-lo no corpo o entregaria a qualquer script da página.
        resposta: responder(
          { operador: resultado.operador, expiraEm: resultado.expiraEm.toISOString() },
          200,
        ),
        // O identificador do Operador é um UUID; nome de usuário, não.
        registro: { resultado: 'sucesso', referencia: resultado.operador.id },
      }

    case 'credenciais_invalidas':
      return {
        resposta: recusaGenerica(),
        registro: { resultado: 'recusada', motivo: 'credenciais' },
      }

    case 'limite_excedido':
      return {
        resposta: falha(
          'limite_excedido',
          `Tentativas demais. Tente novamente em ${String(Math.ceil(resultado.esperarSegundos / 60))} minuto(s).`,
          429,
          { 'Retry-After': String(resultado.esperarSegundos) },
        ),
        registro: { resultado: 'limitada', motivo: 'limite_login' },
      }
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const inicio = Date.now()

  const registrar = (
    entrada: { resultado: ResultadoOperacao; motivo?: string; referencia?: string },
    status: number,
  ): void => {
    registrarOperacao({
      evento: 'identidade.login',
      status,
      duracaoMs: Date.now() - inicio,
      ...entrada,
    })
  }

  if (!ehTipo(request.headers, TIPO_ESPERADO)) {
    registrar({ resultado: 'recusada', motivo: 'tipo_nao_suportado' }, 415)
    return falha('tipo_nao_suportado', 'Envie o corpo como application/json.', 415)
  }

  const tamanho = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanho) && tamanho > TAMANHO_MAXIMO) {
    registrar({ resultado: 'recusada', motivo: 'corpo_grande_demais' }, 413)
    return falha('corpo_grande_demais', 'Corpo da requisição grande demais.', 413)
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    // 401 e não 400: um corpo ilegível não merece resposta mais informativa do
    // que uma senha errada. A distinção só ajudaria quem está sondando.
    registrar({ resultado: 'recusada', motivo: 'corpo_ilegivel' }, 401)
    return recusaGenerica()
  }

  try {
    const resultado = await entrar({ corpo, origem: enderecoDeOrigem(request.headers) })
    const { resposta, registro } = traduzir(resultado)

    registrar(registro, resposta.status)

    return resposta
  } catch (erro) {
    // O detalhe fica no log do servidor. A senha nunca chega aqui: `sanear`
    // limparia e-mail e telefone, mas a barreira que importa é a forma fechada
    // de `EntradaDeLog`, que não tem campo onde um corpo de requisição caiba.
    registrar(
      { resultado: 'erro', motivo: erro instanceof Error ? erro.message : 'desconhecido' },
      500,
    )

    return falha('falha_interna', 'Não foi possível entrar agora. Tente de novo.', 500)
  }
}

/** Logout. Idempotente: sem sessão, responde 204 do mesmo jeito. */
export async function DELETE(): Promise<Response> {
  await sair()

  registrarOperacao({ evento: 'identidade.logout', resultado: 'sucesso', status: 204 })

  return new Response(null, { status: 204, headers: CABECALHOS })
}

/** Quem está logado. Guardada — é o caso de teste do 401 sem cookie (RF-11). */
export async function GET(): Promise<Response> {
  const guarda = await exigirOperadorNaApi()

  if (!guarda.autorizado) return guarda.resposta

  return responder({ operador: guarda.operador }, 200)
}
