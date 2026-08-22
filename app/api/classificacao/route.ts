import type { NextRequest } from 'next/server'
import { documentoDaClassificacao } from '@/contexts/classificacao/projecao'
import { registrarOperacao } from '@/shared/log'

/**
 * `GET /api/classificacao` — a tabela pública (T12, RF-26 a RF-31).
 *
 * **Pública, sem autenticação** (RF-26), e é por isso que tudo o que ela pode
 * dizer foi decidido antes de chegar aqui: o modelo de BC-03 não tem e-mail,
 * telefone, idade nem sobrenome, e o sobrenome de quem tem menos de 18 já saiu
 * abreviado da projeção (RNF-09). Esta rota não filtra nada — ela não teria o
 * que filtrar.
 *
 * **O documento vai inteiro, de uma vez.** Filtro por Pitch e busca por nome
 * acontecem no dispositivo (SDD BC-03, T12 escopo 5). Uma requisição por tecla
 * digitada, com 2000 pessoas buscando ao mesmo tempo, é o cenário que derruba o
 * sistema — e é o cenário que RNF-01 mede.
 *
 * **A borda absorve o pico, não o banco.** `s-maxage=15` mantém a defasagem
 * bem dentro dos 30 s de RNF-03, e `stale-while-revalidate=30` faz a
 * atualização acontecer em segundo plano: ninguém espera a projeção ser
 * reconstruída. Com 500 acessos simultâneos, o banco vê no máximo uma consulta
 * a cada quinze segundos.
 */

/**
 * Janela de cache na borda, em segundos.
 *
 * Quinze, e não trinta: RNF-03 dá trinta segundos entre o lançamento e a
 * aparição pública, e a borda não é a única defasagem do caminho — há o tempo
 * da consulta, o da rede e o do polling da página. Gastar metade do orçamento
 * no cache deixa a outra metade para o resto.
 */
const JANELA_DE_CACHE_S = 15

/** Enquanto revalida, serve o antigo. Ninguém espera a projeção nova. */
const TOLERANCIA_S = 30

const CACHE = `public, s-maxage=${String(JANELA_DE_CACHE_S)}, stale-while-revalidate=${String(TOLERANCIA_S)}`

/**
 * A rota é dinâmica; quem guarda é a borda.
 *
 * Sem isto o Next tentaria pré-renderizar no build, e a classificação do evento
 * seria a de zero participantes, congelada no dia do deploy.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const inicio = Date.now()

  try {
    const { documento, etiqueta } = await documentoDaClassificacao()

    const cabecalhos = {
      'Cache-Control': CACHE,
      ETag: etiqueta,
      // A resposta muda de tamanho conforme o cliente aceita compressão; sem
      // isto, uma borda pode servir a versão comprimida a quem não a entende.
      Vary: 'Accept-Encoding',
    }

    // Revalidação barata do polling (FL-08): se nada mudou, 304 e nenhum byte
    // de corpo. É o que torna o intervalo curto de T13 sustentável com 2000
    // aparelhos atualizando.
    if (request.headers.get('if-none-match') === etiqueta) {
      registrarOperacao({
        evento: 'classificacao.leitura',
        resultado: 'repetida',
        status: 304,
        duracaoMs: Date.now() - inicio,
      })

      return new Response(null, { status: 304, headers: cabecalhos })
    }

    registrarOperacao({
      evento: 'classificacao.leitura',
      resultado: 'sucesso',
      status: 200,
      duracaoMs: Date.now() - inicio,
      // Quantas linhas, não quais. O número serve à métrica de T16.
      referencia: String(documento.total),
    })

    return Response.json(documento, { status: 200, headers: cabecalhos })
  } catch (erro) {
    registrarOperacao({
      evento: 'classificacao.leitura',
      resultado: 'erro',
      status: 503,
      duracaoMs: Date.now() - inicio,
      motivo: erro instanceof Error ? erro.message : 'desconhecido',
    })

    // 503 e não 500: a classificação é uma leitura, e o cliente deve tentar de
    // novo. `no-store` para que a borda não guarde a falha pelos quinze
    // segundos seguintes — seria o pior momento possível para cachear.
    return Response.json(
      {
        erro: {
          codigo: 'indisponivel',
          mensagem: 'Classificação indisponível. Tente em instantes.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
