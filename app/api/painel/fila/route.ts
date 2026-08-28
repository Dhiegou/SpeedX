import type { NextRequest } from 'next/server'
import { fila, pendentes } from '@/contexts/cronometragem/servico'
import { esquemaBusca, esquemaCockpit } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, instanteDoServidor, responder } from '../_apoio'

/**
 * `GET /api/painel/fila?cockpit=1&busca=` — a visão de trabalho do Operador
 * (RF-13, RF-14, RF-16).
 *
 * **O que cada item carrega, e por quê tão pouco:** identificador, nome,
 * sobrenome, os quatro últimos dígitos do telefone e o instante da inscrição.
 * Nada mais. RF-15 pede o suficiente para distinguir dois homônimos, não para
 * conhecer a pessoa — e-mail, idade, telefone completo e dado de Responsável
 * não têm uso nenhum no painel, então não atravessam a fronteira do contexto
 * (SDD §2). A derivação dos quatro dígitos acontece no banco, em `consultas.ts`.
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

    const cockpit = esquemaCockpit.safeParse(parametros.get('cockpit'))
    if (!cockpit.success) {
      return {
        resposta: falha('cockpit_invalido', 'Informe cockpit=1 ou cockpit=2.', 400),
        registro: { resultado: 'recusada', motivo: 'cockpit_invalido' },
      }
    }

    const busca = esquemaBusca.safeParse(parametros.get('busca') ?? undefined)
    if (!busca.success) {
      return {
        resposta: falha('busca_invalida', 'Termo de busca longo demais.', 400),
        registro: { resultado: 'recusada', motivo: 'busca_invalida' },
      }
    }

    const [pagina, total] = await Promise.all([
      fila(cockpit.data, { busca: busca.data }),
      pendentes(cockpit.data),
    ])

    return {
      resposta: responder(
        {
          cockpit: cockpit.data,
          // A contagem é do Cockpit inteiro, não da página: é o número que o
          // painel mostra em fonte grande, e ele não pode encolher porque
          // alguém digitou uma letra na busca.
          pendentes: total,
          truncado: pagina.truncado,
          itens: pagina.itens.map((i) => ({
            tentativaId: i.tentativaId,
            participanteId: i.participanteId,
            nome: i.nome,
            sobrenome: i.sobrenome,
            ultimos4Telefone: i.ultimos4Telefone,
            inscritoEm: i.inscritoEm.toISOString(),
          })),
        },
        200,
        instanteDoServidor(),
      ),
      registro: { resultado: 'sucesso', motivo: `cockpit_${String(cockpit.data)}` },
    }
  })
}
