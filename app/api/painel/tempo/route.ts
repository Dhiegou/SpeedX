import type { NextRequest } from 'next/server'
import { corrigir, registrar } from '@/contexts/cronometragem/servico'
import { esquemaLancamento } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, lerCorpo, responder } from '../_apoio'
import { traduzirLancamento } from '../_traduzir'

/**
 * `/api/painel/tempo` — o lançamento e a correção (RF-17, RF-22, RF-23, RF-25).
 *
 * `POST` registra um Tempo; `PATCH` troca um já registrado. Verbos diferentes
 * para operações diferentes de propósito: são transições distintas na máquina
 * de estados, com trilhas de auditoria distintas, e um `POST` que às vezes
 * corrige seria exatamente a sobrescrita silenciosa que D-49 recusou.
 *
 * Esta rota não decide nada sobre cronometragem. Lê a requisição, valida a
 * forma, chama o caso de uso e traduz situação em status.
 */

const EVENTO_REGISTRO = 'cronometragem.registro'
const EVENTO_CORRECAO = 'cronometragem.correcao'

async function lancar(
  request: NextRequest,
  evento: string,
  executar: (comando: {
    tentativaId: string
    tempoMs: number
    operadorId: string
    chave: string
  }) => Promise<Parameters<typeof traduzirLancamento>[0]>,
): Promise<Response> {
  return comRegistro(evento, async () => {
    const guarda = await exigirOperadorNaApi()
    if (!guarda.autorizado) {
      return {
        resposta: guarda.resposta,
        registro: { resultado: 'recusada', motivo: 'sem_sessao' },
      }
    }

    const corpo = await lerCorpo(request)
    if (!corpo.ok) {
      return { resposta: corpo.resposta, registro: { resultado: 'recusada', motivo: corpo.motivo } }
    }

    const analise = esquemaLancamento.safeParse(corpo.corpo)
    if (!analise.success) {
      const erros = analise.error.issues.map((i) => ({
        campo: i.path.join('.') || '(raiz)',
        mensagem: i.message,
      }))

      return {
        resposta: responder({ erros }, 422),
        registro: {
          resultado: 'recusada',
          motivo: 'validacao',
          // Nomes de campo, jamais valores.
          campos: erros.map((e) => e.campo),
        },
      }
    }

    return traduzirLancamento(
      await executar({
        tentativaId: analise.data.tentativaId,
        tempoMs: analise.data.tempo,
        operadorId: guarda.operador.id,
        chave: analise.data.chave,
      }),
    )
  })
}

export function POST(request: NextRequest): Promise<Response> {
  return lancar(request, EVENTO_REGISTRO, registrar)
}

export function PATCH(request: NextRequest): Promise<Response> {
  return lancar(request, EVENTO_CORRECAO, corrigir)
}

/** Qualquer outro verbo é engano de cliente, não caminho a suportar. */
export function GET(): Response {
  return falha('metodo_nao_suportado', 'Use POST para registrar ou PATCH para corrigir.', 405)
}
