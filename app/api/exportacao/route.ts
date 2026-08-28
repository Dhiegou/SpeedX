import type { NextRequest } from 'next/server'
import { ehTipoValido, nomeDe, TIPOS } from '@/contexts/custodia'
import { exportar } from '@/contexts/custodia/servico'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { registrarOperacao } from '@/shared/log'

/**
 * `GET /api/exportacao?tipo=completa|repasse|pendencias` — a saída da base
 * (T14, RF-34, RF-35, RNF-10).
 *
 * **É a rota mais perigosa do sistema**, e o oposto de tudo que a Classificação
 * faz: ali o modelo não tem campo para dado pessoal; aqui o documento é a base
 * inteira, com e-mail, telefone, idade e dados de Responsável de menores de
 * idade. Três consequências:
 *
 * 1. **Exige sessão, sem exceção e sem token de URL.** Um link assinado que
 *    funcionasse sem cookie seria compartilhável — e um arquivo com o telefone
 *    de 2000 pessoas encaminhado num grupo de mensagens não volta atrás.
 * 2. **Toda exportação deixa rastro** (item 3 do escopo), com quem e quando.
 * 3. **Um tipo por requisição, escolhido por união fechada.** Não há filtro
 *    livre: o que separa a lista de repasse da base completa é uma consulta
 *    diferente, não um parâmetro que alguém pode manipular.
 */

/** Nunca em cache, em lugar nenhum. Nem borda, nem navegador, nem histórico. */
const SEM_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  // Uma exportação guardada em cache compartilhado seria servida ao próximo
  // que pedisse a mesma URL — inclusive sem sessão, dependendo da borda.
  Vary: 'Cookie',
} as const

export const dynamic = 'force-dynamic'

/**
 * Sessenta segundos, e não o padrão da plataforma (T19 §6).
 *
 * É a única rota que monta a base inteira num documento antes de responder — as
 * demais devolvem uma tela de fila ou uma projeção pronta. Com 2000 linhas isso
 * leva menos de um segundo, mas quem pede a exportação costuma pedi-la no fim
 * do evento, uma vez, e o custo de errar para menos é o Operador recebendo um
 * arquivo truncado sem saber que truncou. T18 mede o tempo real; até lá o teto
 * é o maior que o plano oferece.
 */
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<Response> {
  const inicio = Date.now()

  const guarda = await exigirOperadorNaApi()

  if (!guarda.autorizado) {
    registrarOperacao({
      evento: 'custodia.exportacao',
      resultado: 'recusada',
      motivo: 'sem_sessao',
      status: 401,
      duracaoMs: Date.now() - inicio,
    })

    return guarda.resposta
  }

  const tipo = request.nextUrl.searchParams.get('tipo') ?? 'completa'

  if (!ehTipoValido(tipo)) {
    registrarOperacao({
      evento: 'custodia.exportacao',
      resultado: 'recusada',
      motivo: 'tipo_invalido',
      status: 400,
      duracaoMs: Date.now() - inicio,
    })

    return Response.json(
      {
        erro: {
          codigo: 'tipo_invalido',
          mensagem: `Tipo inválido. Use um de: ${TIPOS.join(', ')}.`,
        },
      },
      { status: 400, headers: SEM_CACHE },
    )
  }

  try {
    const conteudo = await exportar(tipo)

    // O rastro sai **antes** do corpo, e não depois: uma exportação em fluxo
    // pode ser interrompida no meio, e o que precisa ficar registrado é que
    // alguém pediu a base — não que conseguiu baixá-la inteira.
    registrarOperacao({
      evento: 'custodia.exportacao',
      resultado: 'sucesso',
      status: 200,
      duracaoMs: Date.now() - inicio,
      motivo: tipo,
      // Quem exportou. É o identificador do Operador, não o nome — a forma
      // fechada de `EntradaDeLog` não carrega nome de pessoa (RNF-08).
      referencia: guarda.operador.id,
    })

    return new Response(conteudo, {
      status: 200,
      headers: {
        ...SEM_CACHE,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeDe(tipo)}"`,
      },
    })
  } catch (erro) {
    registrarOperacao({
      evento: 'custodia.exportacao',
      resultado: 'erro',
      status: 500,
      duracaoMs: Date.now() - inicio,
      motivo: erro instanceof Error ? erro.message : 'desconhecido',
    })

    return Response.json(
      { erro: { codigo: 'falha_interna', mensagem: 'Não foi possível gerar a exportação.' } },
      { status: 500, headers: SEM_CACHE },
    )
  }
}
