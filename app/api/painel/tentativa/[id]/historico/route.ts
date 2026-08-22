import { historico } from '@/contexts/cronometragem/servico'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, responder } from '../../../_apoio'
import { formatHoraDoEvento, formatTempo } from '@/shared/tempo'

/**
 * `GET /api/painel/tentativa/:id/historico` — a trilha de auditoria (RF-23).
 *
 * "Consultar um lançamento revela autor e momento." Revela com o **nome** do
 * Operador, não com o UUID: quem abre esta tela está mediando uma contestação
 * no dia do evento, e não vai cruzar identificadores à mão.
 *
 * A tabela é append-only — correção gera linha nova, nunca altera a anterior —,
 * então isto é a história completa da Tentativa, em ordem. É a resposta ao
 * contraindicador do PRD §7: "contestação de resultado que o sistema não
 * consiga esclarecer".
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function GET(
  _request: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  return comRegistro('cronometragem.historico', async () => {
    const guarda = await exigirOperadorNaApi()
    if (!guarda.autorizado) {
      return {
        resposta: guarda.resposta,
        registro: { resultado: 'recusada', motivo: 'sem_sessao' },
      }
    }

    const { id } = await contexto.params

    if (!UUID.test(id)) {
      return {
        resposta: falha('tentativa_invalida', 'Identificador de tentativa inválido.', 400),
        registro: { resultado: 'recusada', motivo: 'id_invalido' },
      }
    }

    const lancamentos = await historico(id)

    return {
      resposta: responder(
        {
          tentativaId: id,
          lancamentos: lancamentos.map((l) => ({
            id: l.id,
            tipo: l.tipo,
            tempoMsAnterior: l.tempoMsAnterior,
            tempoAnterior: l.tempoMsAnterior === null ? null : formatTempo(l.tempoMsAnterior),
            tempoMsNovo: l.tempoMsNovo,
            tempoNovo: l.tempoMsNovo === null ? null : formatTempo(l.tempoMsNovo),
            operador: l.operadorNome,
            ocorridoEm: l.ocorridoEm.toISOString(),
            hora: formatHoraDoEvento(l.ocorridoEm),
          })),
        },
        200,
      ),
      registro: { resultado: 'sucesso', referencia: id },
    }
  })
}
