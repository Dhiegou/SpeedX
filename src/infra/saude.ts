import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'

/**
 * Sondagem de saúde (T16 §1 — RNF-05).
 *
 * Responde a uma pergunta só: **este processo consegue falar com o banco
 * agora?** Não é diagnóstico, não é métrica e não substitui nenhum dos dois. É
 * o sinal que o monitor externo lê a cada minuto para decidir se acorda alguém.
 *
 * **Tem prazo, e o prazo é a parte que importa.** Um banco fora do ar costuma
 * não recusar a conexão: ele aceita e não responde. Uma sondagem sem limite de
 * tempo herda essa espera, o monitor estoura o próprio tempo limite e registra
 * "sem resposta" — que é indistinguível de a aplicação inteira ter caído. Com
 * limite, a resposta é rápida e diz **qual** das duas coisas aconteceu, que é a
 * diferença entre reiniciar o banco e reiniciar a aplicação às onze da manhã do
 * evento.
 *
 * A consulta é `select 1`: não toca em tabela, não pega bloqueio e não aparece
 * em nada que o expurgo de T15 apague. Medir o banco com uma consulta de
 * verdade daria um número mais realista e transformaria o health check num
 * gerador de carga a cada 60 segundos, por dez horas.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Teto da sondagem.
 *
 * **Um segundo, e não os 200 ms que este arquivo dizia primeiro.** A primeira
 * versão amarrou o teto ao critério de aceitação de T16 (`/api/saude` em
 * 300 ms), o que soa correto e está errado: são duas grandezas diferentes. O
 * critério descreve o regime — medido, com o banco de pé, em 13 a 33 ms. Este
 * teto existe para distinguir **banco pendurado** de banco lento, e um teto
 * apertado transforma a segunda coisa na primeira.
 *
 * O que revelou o erro foi o log da própria sondagem: a **primeira** chamada
 * depois de subir o processo levou 191 ms, porque ela inclui a abertura da
 * primeira conexão do pool. Com teto de 200, o monitor que bate em
 * `/api/saude` logo após um deploy tinha chance real de receber `degradado`
 * de um sistema perfeitamente saudável — um alarme falso no minuto em que
 * alguém está olhando, que é a maneira mais rápida de um alerta perder crédito.
 *
 * Um segundo continua muito abaixo do tempo limite de qualquer monitor (a
 * ordem é de cinco a dez segundos), e muito acima de qualquer `select 1` que
 * não esteja preso.
 */
export const LIMITE_DA_SONDAGEM_MS = 1_000

export type SaudeDoBanco =
  | { readonly alcancavel: true; readonly latenciaMs: number }
  | {
      readonly alcancavel: false
      readonly motivo: 'tempo_esgotado' | 'erro'
      readonly detalhe: string
    }

/**
 * Corre a sondagem contra o relógio.
 *
 * O `Promise.race` deixa a consulta perdida rodando até o driver desistir
 * sozinho — não há como cancelá-la de fora. Isso é aceitável aqui e não seria
 * num caminho de escrita: `select 1` não segura recurso nem deixa efeito, e a
 * conexão volta para o pool quando o driver terminar.
 */
export async function verificarBanco(
  db: Db,
  limiteMs: number = LIMITE_DA_SONDAGEM_MS,
): Promise<SaudeDoBanco> {
  const inicio = Date.now()
  let expirar: ReturnType<typeof setTimeout> | undefined

  const prazo = new Promise<'tempo_esgotado'>((resolver) => {
    expirar = setTimeout(() => {
      resolver('tempo_esgotado')
    }, limiteMs)
  })

  try {
    const desfecho = await Promise.race([
      db.execute(sql`select 1`).then(() => 'respondeu' as const),
      prazo,
    ])

    if (desfecho === 'tempo_esgotado') {
      return {
        alcancavel: false,
        motivo: 'tempo_esgotado',
        detalhe: `sem resposta em ${String(limiteMs)} ms`,
      }
    }

    return { alcancavel: true, latenciaMs: Date.now() - inicio }
  } catch (erro) {
    // O detalhe fica aqui dentro e vai para o log. **Não** vai para o corpo da
    // resposta: `/api/saude` é público, e a mensagem de erro do driver carrega
    // host, porta e nome de banco.
    return {
      alcancavel: false,
      motivo: 'erro',
      detalhe: erro instanceof Error ? erro.message : 'desconhecido',
    }
  } finally {
    clearTimeout(expirar)
  }
}
