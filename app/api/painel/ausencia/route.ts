import type { NextRequest } from 'next/server'
import { ausentar } from '@/contexts/cronometragem/servico'
import { esquemaAusencia } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, lerCorpo, responder } from '../_apoio'
import { traduzirLancamento } from '../_traduzir'

/**
 * `/api/painel/ausencia` — marca quem não compareceu (RF-21).
 *
 * Rota própria, e não um campo no corpo de `/tempo`, porque é outra transição:
 * sai da Fila, permanece na Exportação, não aparece na Classificação. Misturar
 * as duas num endpoint só faria um corpo malformado transformar uma ausência
 * num lançamento de tempo zero.
 *
 * **Não é exclusão.** O cadastro continua inteiro; é a Fila que muda.
 */

export function POST(request: NextRequest): Promise<Response> {
  return comRegistro('cronometragem.ausencia', async () => {
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

    const analise = esquemaAusencia.safeParse(corpo.corpo)
    if (!analise.success) {
      const erros = analise.error.issues.map((i) => ({
        campo: i.path.join('.') || '(raiz)',
        mensagem: i.message,
      }))

      return {
        resposta: responder({ erros }, 422),
        registro: { resultado: 'recusada', motivo: 'validacao', campos: erros.map((e) => e.campo) },
      }
    }

    return traduzirLancamento(
      await ausentar({
        tentativaId: analise.data.tentativaId,
        operadorId: guarda.operador.id,
        chave: analise.data.chave,
      }),
    )
  })
}
