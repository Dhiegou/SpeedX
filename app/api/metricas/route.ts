import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { lerPainelDoDia } from '@/contexts/custodia/servico'
import { registrarOperacao } from '@/shared/log'

/**
 * `GET /api/metricas` — o painel do dia (T16 §5, PRD §7).
 *
 * Os números que o time olha durante o evento: inscritos por hora, situação de
 * cada Pitch, ritmo de Lançamentos, taxa de correção e — o que mais importa —
 * quantas Tentativas continuam pendentes.
 *
 * **Exige sessão de Operador, e a razão não é o dado.** O corpo é só contagem;
 * nada aqui identifica ninguém. O que se protege é a informação operacional:
 * "1.462 inscritos e 293 pendências às 16h" é um retrato do evento que não
 * precisa estar aberto, e uma rota pública que faz seis consultas agregadas por
 * chamada é um amplificador de carga de graça no dia em que a carga importa.
 *
 * **Distinta de `/api/saude`, de propósito.** Aquela responde "o processo está
 * de pé" e é pública porque um monitor não sabe autenticar-se. Esta responde
 * "o evento está indo bem", que é outra pergunta, com outro público e outra
 * frequência. Juntá-las faria a rota que o monitor bate a cada minuto carregar
 * seis agregações — e cair junto com o banco, apagando justamente o sinal que
 * distingue "banco fora" de "aplicação fora".
 */

const SEM_CACHE = { 'Cache-Control': 'no-store' } as const

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const inicio = Date.now()
  const guarda = await exigirOperadorNaApi()

  if (!guarda.autorizado) {
    registrarOperacao({
      evento: 'observabilidade.painel',
      resultado: 'recusada',
      motivo: 'sem_sessao',
      status: 401,
      duracaoMs: Date.now() - inicio,
    })

    return guarda.resposta
  }

  try {
    const painel = await lerPainelDoDia()

    registrarOperacao({
      evento: 'observabilidade.painel',
      resultado: 'sucesso',
      status: 200,
      duracaoMs: Date.now() - inicio,
      referencia: guarda.operador.id,
      // Contagem no log, e não só no corpo: assim a métrica primária do PRD §7
      // fica registrada ao longo do dia em vez de existir só na tela de quem
      // estava olhando na hora.
      contagens: { pendencias: painel.pendencias, inscritos: painel.inscritos.total },
    })

    return Response.json(painel, { status: 200, headers: SEM_CACHE })
  } catch (erro) {
    registrarOperacao({
      evento: 'observabilidade.painel',
      resultado: 'erro',
      status: 503,
      duracaoMs: Date.now() - inicio,
      motivo: erro instanceof Error ? erro.message : 'desconhecido',
    })

    return Response.json(
      { erro: { codigo: 'indisponivel', mensagem: 'Métricas indisponíveis no momento.' } },
      { status: 503, headers: SEM_CACHE },
    )
  }
}
