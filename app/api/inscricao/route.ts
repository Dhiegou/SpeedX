import type { NextRequest } from 'next/server'
import { submeter } from '@/contexts/inscricao/servico'
import type { ResultadoSubmissao } from '@/contexts/inscricao/submeterInscricao'
import { registrarOperacao, type ResultadoOperacao } from '@/shared/log'
import { ehTipo, enderecoDeOrigem } from '@/shared/requisicao'

/**
 * `POST /api/inscricao` — cadastro público (RF-01, RNF-12, RNF-13, RNF-17).
 *
 * Esta rota não decide nada sobre inscrição. Ela lê a requisição, chama o caso
 * de uso e traduz a situação devolvida em status HTTP. Toda regra — validação,
 * idempotência, limite, anti-automação — está em `submeterInscricao`, onde o
 * teste alcança sem subir servidor e onde um segundo caminho de entrada (a
 * digitação das fichas de papel de T20) reaproveita sem copiar.
 *
 * Executa inteiramente no servidor. A credencial do banco não é importável
 * daqui — o lint de T01 recusa `@/db` em `app/**`, e a rota chega ao banco
 * apenas pela porta nomeada do contexto (restrição 3 do anexo do PRD).
 */

const TIPO_ESPERADO = 'application/json'

/**
 * Teto do corpo aceito. Uma inscrição válida não passa de 1 KB; o limite existe
 * para que ninguém ocupe memória do servidor mandando megabytes de JSON.
 */
const TAMANHO_MAXIMO = 16 * 1024

/** Nunca em cache: cada envio é um efeito, não um documento. */
const CABECALHOS = { 'Cache-Control': 'no-store' } as const

type Registro = {
  resultado: ResultadoOperacao
  motivo?: string
  campos?: readonly string[]
  preenchimentoMs?: number
}

type CorpoDeErro = {
  readonly erro: { readonly codigo: string; readonly mensagem: string }
}

function responder(corpo: unknown, status: number, extras: Record<string, string> = {}): Response {
  return Response.json(corpo, { status, headers: { ...CABECALHOS, ...extras } })
}

function falha(codigo: string, mensagem: string, status: number, extras = {}): Response {
  return responder({ erro: { codigo, mensagem } } satisfies CorpoDeErro, status, extras)
}

/**
 * Situação do caso de uso → resposta HTTP.
 *
 * O `switch` é exaustivo sobre a união fechada de `ResultadoSubmissao`: uma
 * situação nova sem tradução aqui não compila, em vez de virar 500 silencioso.
 */
function traduzir(resultado: ResultadoSubmissao): {
  resposta: Response
  registro: Registro
} {
  switch (resultado.situacao) {
    case 'criada':
      return {
        resposta: responder(resultado.corpo, 201),
        // O tempo de preenchimento é a métrica de conclusão do PRD §7, e chega
        // aqui sem nenhum evento de telemetria sair do navegador: o instante da
        // carga do formulário já vem assinado no token.
        registro: { resultado: 'sucesso', preenchimentoMs: resultado.preenchimentoMs },
      }

    case 'repetida':
      // 200, e não 201: nada foi criado agora. O corpo é o da primeira vez.
      return {
        resposta: responder(resultado.corpo, 200),
        registro: { resultado: 'repetida', motivo: 'idempotencia' },
      }

    case 'descartada':
      // Indistinguível de sucesso para quem enviou, de propósito (honeypot).
      return {
        resposta: responder(resultado.corpo, 201),
        registro: { resultado: 'descartada', motivo: 'honeypot' },
      }

    case 'invalida':
      return {
        resposta: responder({ erros: resultado.erros }, 422),
        registro: {
          resultado: 'recusada',
          motivo: 'validacao',
          // Nomes de campo, jamais valores: `email`, nunca o e-mail (RNF-08).
          campos: resultado.erros.map((e) => e.campo),
        },
      }

    case 'chave_ausente':
      return {
        resposta: falha(
          'chave_idempotencia_ausente',
          'Cabeçalho Idempotency-Key obrigatório, com um UUID gerado uma vez por envio.',
          400,
        ),
        registro: { resultado: 'recusada', motivo: 'chave_ausente' },
      }

    case 'chave_em_conflito':
      return {
        resposta: falha(
          'chave_idempotencia_em_conflito',
          'Esta chave de idempotência já foi usada para outro envio. Gere uma nova.',
          409,
        ),
        registro: { resultado: 'recusada', motivo: 'chave_em_conflito' },
      }

    case 'formulario_expirado':
      return {
        resposta: falha(
          'formulario_expirado',
          'A página ficou aberta tempo demais. Recarregue e envie de novo.',
          400,
        ),
        registro: { resultado: 'recusada', motivo: 'formulario_expirado' },
      }

    case 'automacao_suspeita':
      return {
        resposta: falha(
          'envio_rapido_demais',
          'O envio chegou rápido demais. Aguarde alguns segundos e tente de novo.',
          429,
          { 'Retry-After': String(Math.max(1, resultado.esperarSegundos)) },
        ),
        registro: { resultado: 'limitada', motivo: 'anti_automacao' },
      }

    case 'limite_excedido':
      return {
        resposta: falha(
          'limite_excedido',
          `Muitos cadastros a partir desta conexão. Tente novamente em ${String(Math.ceil(resultado.esperarSegundos / 60))} minuto(s).`,
          429,
          { 'Retry-After': String(resultado.esperarSegundos) },
        ),
        registro: { resultado: 'limitada', motivo: 'limite_ip' },
      }

    case 'termo_nao_aprovado':
      // 503 e não 500: o sistema está íntegro, a base legal é que não está.
      return {
        resposta: falha(
          'termo_nao_aprovado',
          'O cadastro está indisponível no momento. Procure a organização no ponto de inscrição.',
          503,
        ),
        registro: { resultado: 'erro', motivo: 'termo_nao_aprovado' },
      }
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const inicio = Date.now()

  const registrar = (entrada: Registro, status: number): void => {
    registrarOperacao({
      evento: 'inscricao.cadastro',
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
    registrar({ resultado: 'recusada', motivo: 'corpo_ilegivel' }, 400)
    return falha('corpo_invalido', 'Corpo da requisição não é JSON válido.', 400)
  }

  try {
    const resultado = await submeter({
      corpo,
      chave: request.headers.get('idempotency-key'),
      origem: enderecoDeOrigem(request.headers),
    })

    const { resposta, registro } = traduzir(resultado)
    registrar(registro, resposta.status)

    return resposta
  } catch (erro) {
    // O detalhe fica no log do servidor; para quem enviou, uma frase e nada
    // mais. Mensagem de erro de banco na resposta é superfície de ataque, e o
    // corpo que a produziu pode ter dado pessoal dentro.
    registrar(
      { resultado: 'erro', motivo: erro instanceof Error ? erro.message : 'desconhecido' },
      500,
    )

    return falha(
      'falha_interna',
      'Não foi possível concluir o cadastro agora. Tente novamente em instantes.',
      500,
    )
  }
}
