import type { NextRequest } from 'next/server'
import { fila, pendentes } from '@/contexts/cronometragem/servico'
import { esquemaBusca } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, instanteDoServidor, responder } from '../_apoio'

/**
 * `GET /api/painel/fila?busca=` — a visão de trabalho do Operador (RF-14, RF-16).
 *
 * Fila única: o evento tem um Cockpit só (D-107), e um `cockpit=` que ainda
 * chegue na consulta é ignorado como qualquer parâmetro desconhecido.
 *
 * **O que cada item carrega, e por quê tão pouco:** identificador, nome,
 * sobrenome, o número de inscrição e o instante da inscrição.
 * Nada mais. RF-15 pede o suficiente para distinguir dois homônimos, não para
 * conhecer a pessoa — e-mail, idade, telefone e dado de Responsável não têm
 * uso nenhum no painel, então não atravessam a fronteira do contexto (SDD §2).
 * Desde D-114 nem os quatro últimos dígitos do telefone: o número basta.
 *
 * `truncado` diz à tela que o teto cortou resultados. Sem esse aviso, uma lista
 * de 200 pareceria a fila inteira, e o Operador procuraria no lugar errado a
 * pessoa que está bem ali na posição 201.
 */

export function GET(request: NextRequest): Promise<Response> {
  return comRegistro('cronometragem.fila', async () => {
    const guarda = await exigirOperadorNaApi()
    if (!guarda.autorizado) {
      return {
        resposta: guarda.resposta,
        registro: { resultado: 'recusada', motivo: 'sem_sessao' },
      }
    }

    const parametros = request.nextUrl.searchParams

    const busca = esquemaBusca.safeParse(parametros.get('busca') ?? undefined)
    if (!busca.success) {
      return {
        resposta: falha('busca_invalida', 'Termo de busca longo demais.', 400),
        registro: { resultado: 'recusada', motivo: 'busca_invalida' },
      }
    }

    const [pagina, total] = await Promise.all([fila({ busca: busca.data }), pendentes()])

    return {
      resposta: responder(
        {
          // A contagem é da Fila inteira, não da página: é o número que o
          // painel mostra em fonte grande, e ele não pode encolher porque
          // alguém digitou uma letra na busca.
          pendentes: total,
          truncado: pagina.truncado,
          itens: pagina.itens.map((i) => ({
            tentativaId: i.tentativaId,
            participanteId: i.participanteId,
            nome: i.nome,
            sobrenome: i.sobrenome,
            numero: i.numero,
            inscritoEm: i.inscritoEm.toISOString(),
          })),
        },
        200,
        instanteDoServidor(),
      ),
      registro: { resultado: 'sucesso' },
    }
  })
}
