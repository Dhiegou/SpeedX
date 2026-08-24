import { db } from '@/db'
import { verificarBanco } from '@/infra/saude'
import { env } from '@/shared/env'
import { registrarOperacao } from '@/shared/log'

/**
 * `GET /api/saude` — o sinal que o monitor externo lê (T16 §1, RNF-05).
 *
 * **É a única rota que fala com o banco sem passar por um caso de uso**, e o
 * lint tem uma exceção nominal para este arquivo. A regra existe para impedir
 * que uma rota contorne a regra de negócio pelo caminho de baixo; aqui não há
 * regra de negócio a contornar — a pergunta é sobre o processo, não sobre o
 * domínio. `tests/fronteiras.test.ts` confere que a exceção continua com um
 * arquivo de largura.
 *
 * **Público, e por isso mudo sobre infraestrutura.** O monitor não tem como se
 * autenticar, então qualquer um alcança esta rota. O corpo diz se está de pé,
 * há quanto tempo o banco respondeu e qual versão está no ar — e nada mais.
 * Host, porta, nome de banco e mensagem de driver ficam no log, onde já existe
 * controle de acesso.
 *
 * **503 quando o banco não responde, e não 200 com um campo `ok: false`.** O
 * monitor de qualquer provedor decide por código de status; um 200 com a má
 * notícia escondida no corpo é uma indisponibilidade que ninguém é avisado.
 */

const SEM_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' } as const

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const inicio = Date.now()
  const banco = await verificarBanco(db())

  const corpo = {
    situacao: banco.alcancavel ? ('ok' as const) : ('degradado' as const),
    versao: env().APP_VERSION,
    // Do relógio do servidor, o mesmo que carimba `resolvido_em` (SDD FL-10).
    // Serve ao item de T21 que confere a sincronia sem entrar na máquina.
    instante: new Date().toISOString(),
    banco: banco.alcancavel
      ? { alcancavel: true, latenciaMs: banco.latenciaMs }
      : { alcancavel: false },
  }

  registrarOperacao({
    evento: 'saude.verificacao',
    resultado: banco.alcancavel ? 'sucesso' : 'erro',
    status: banco.alcancavel ? 200 : 503,
    duracaoMs: Date.now() - inicio,
    // O detalhe do erro sai aqui, e só aqui.
    ...(banco.alcancavel ? {} : { motivo: `${banco.motivo}: ${banco.detalhe}` }),
  })

  return Response.json(corpo, {
    status: banco.alcancavel ? 200 : 503,
    headers: SEM_CACHE,
  })
}
