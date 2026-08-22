import type { NextRequest } from 'next/server'
import { procurarParticipantes } from '@/contexts/cronometragem/servico'
import { esquemaBusca } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, instanteDoServidor, responder } from '../_apoio'
import { formatTempo } from '@/shared/tempo'

/**
 * `GET /api/painel/participante?busca=` — busca global, fora da Fila (RF-22, RF-24).
 *
 * A Fila mostra só quem ainda não correu, e é isso que a torna útil. Mas
 * corrigir um tempo e incluir alguém num Pitch adicional tratam justamente de
 * quem **saiu** da Fila — já lançado ou marcado como ausente. Sem esta rota,
 * essas duas operações não teriam como alcançar ninguém.
 *
 * Devolve as Tentativas de cada pessoa nos dois Pitches, com estado e Tempo,
 * porque é essa a decisão que o Operador toma em seguida: corrigir esta, ou
 * incluir naquela outra.
 *
 * Mesma projeção de dado pessoal da Fila: nome, sobrenome e quatro dígitos.
 */

export function GET(request: NextRequest): Promise<Response> {
  return comRegistro('cronometragem.busca_participante', async () => {
    const guarda = await exigirOperadorNaApi()
    if (!guarda.autorizado) {
      return {
        resposta: guarda.resposta,
        registro: { resultado: 'recusada', motivo: 'sem_sessao' },
      }
    }

    const busca = esquemaBusca.safeParse(request.nextUrl.searchParams.get('busca') ?? undefined)
    if (!busca.success) {
      return {
        resposta: falha('busca_invalida', 'Termo de busca longo demais.', 400),
        registro: { resultado: 'recusada', motivo: 'busca_invalida' },
      }
    }

    // Busca vazia devolve vazio, e não a base inteira: na Fila o campo em
    // branco significa "mostre a fila"; aqui significaria despejar os 2000
    // cadastros do evento numa resposta só.
    const pagina = await procurarParticipantes({ busca: busca.data ?? '' })

    return {
      resposta: responder(
        {
          truncado: pagina.truncado,
          itens: pagina.itens.map((p) => ({
            participanteId: p.participanteId,
            nome: p.nome,
            sobrenome: p.sobrenome,
            ultimos4Telefone: p.ultimos4Telefone,
            tentativas: p.tentativas.map((t) => ({
              tentativaId: t.tentativaId,
              pitch: t.pitch,
              estado: t.estado,
              tempoMs: t.tempoMs,
              tempo: t.tempoMs === null ? null : formatTempo(t.tempoMs),
              resolvidoEm: t.resolvidoEm?.toISOString() ?? null,
            })),
          })),
        },
        200,
        instanteDoServidor(),
      ),
      registro: { resultado: 'sucesso' },
    }
  })
}
