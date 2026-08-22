import type { NextRequest } from 'next/server'
import { registrarOperacao, type ResultadoOperacao } from '@/shared/log'
import { ehTipo } from '@/shared/requisicao'

/**
 * O que toda rota do painel repete (T10).
 *
 * Cinco regras valem para todas, e escrevê-las seis vezes é como cinco delas
 * deixam de valer numa: `no-store` sempre, JSON sempre, corpo pequeno, erro com
 * forma fixa, e um registro estruturado por requisição.
 *
 * O que **não** está aqui é a guarda de sessão. Cada rota chama
 * `exigirOperadorNaApi` por conta própria, e é de propósito: um `withAuth`
 * embrulhando o handler faz a proteção sumir do arquivo que ela protege, e
 * `tests/painelGuarda.test.ts` deixaria de conseguir afirmar qualquer coisa
 * lendo a rota. A repetição de duas linhas compra uma verificação estrutural.
 */

/**
 * Nunca em cache (T10, regra 5).
 *
 * O Operador não pode ver Fila obsoleta: uma pessoa já lançada reaparecendo na
 * lista vira um segundo lançamento tentado, e a fila física para enquanto ele
 * entende o que houve.
 */
export const SEM_CACHE = { 'Cache-Control': 'no-store' } as const

/** Uma credencial ou um lançamento não passam de alguns bytes. */
export const TAMANHO_MAXIMO = 4 * 1024

export const TIPO_ESPERADO = 'application/json'

export function responder(
  corpo: unknown,
  status: number,
  extras: Record<string, string> = {},
): Response {
  return Response.json(corpo, { status, headers: { ...SEM_CACHE, ...extras } })
}

export function falha(
  codigo: string,
  mensagem: string,
  status: number,
  extras: Record<string, string> = {},
): Response {
  return responder({ erro: { codigo, mensagem } }, status, extras)
}

/**
 * Instante do servidor, em cabeçalho (T10, regra 6).
 *
 * O painel usa para mostrar defasagem se a resposta demorar. Vai como cabeçalho
 * próprio e não como `Date` porque `Date` tem resolução de segundo e pode ser
 * reescrito por borda ou proxy — e o ponto aqui é justamente comparar com o
 * relógio autoritativo, o mesmo que carimba `resolvido_em` (SDD FL-10).
 */
export function instanteDoServidor(): Record<string, string> {
  return { 'X-Instante-Servidor': new Date().toISOString() }
}

export type Registro = {
  resultado: ResultadoOperacao
  motivo?: string
  referencia?: string
  campos?: readonly string[]
}

/** Envolve o handler com registro e a rede de segurança do 500. */
export async function comRegistro(
  evento: string,
  executar: () => Promise<{ resposta: Response; registro: Registro }>,
): Promise<Response> {
  const inicio = Date.now()

  try {
    const { resposta, registro } = await executar()

    registrarOperacao({
      evento,
      status: resposta.status,
      duracaoMs: Date.now() - inicio,
      ...registro,
    })

    return resposta
  } catch (erro) {
    // O detalhe fica no log do servidor; para o Operador, uma frase. Mensagem
    // de erro de banco na resposta é superfície de ataque, e o corpo que a
    // produziu pode ter dado pessoal dentro.
    registrarOperacao({
      evento,
      status: 500,
      duracaoMs: Date.now() - inicio,
      resultado: 'erro',
      motivo: erro instanceof Error ? erro.message : 'desconhecido',
    })

    return falha('falha_interna', 'Não foi possível concluir a operação. Tente de novo.', 500)
  }
}

/** Lê e confere o corpo JSON. Devolve a resposta de recusa quando não serve. */
export async function lerCorpo(
  request: NextRequest,
): Promise<{ ok: true; corpo: unknown } | { ok: false; resposta: Response; motivo: string }> {
  if (!ehTipo(request.headers, TIPO_ESPERADO)) {
    return {
      ok: false,
      motivo: 'tipo_nao_suportado',
      resposta: falha('tipo_nao_suportado', 'Envie o corpo como application/json.', 415),
    }
  }

  const tamanho = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanho) && tamanho > TAMANHO_MAXIMO) {
    return {
      ok: false,
      motivo: 'corpo_grande_demais',
      resposta: falha('corpo_grande_demais', 'Corpo da requisição grande demais.', 413),
    }
  }

  try {
    return { ok: true, corpo: await request.json() }
  } catch {
    return {
      ok: false,
      motivo: 'corpo_ilegivel',
      resposta: falha('corpo_invalido', 'Corpo da requisição não é JSON válido.', 400),
    }
  }
}
