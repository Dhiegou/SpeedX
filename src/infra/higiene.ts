import { lt, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { registrarOperacao } from '@/shared/log'

/**
 * Higiene contínua das tabelas de mecanismo (T15 §4).
 *
 * Duas tabelas crescem a cada requisição e não têm dono no domínio:
 * `chave_idempotencia`, uma linha por escrita efetivada, e `limite_taxa`, uma
 * linha por operação contada. Nenhuma das duas serve para coisa alguma depois
 * que sua janela passa — e `limite_taxa` guarda o HMAC de um endereço IP, que
 * é dado pessoal pseudonimizado. Deixá-las crescer é guardar sem finalidade,
 * que é o oposto do que RNF-11 pede.
 *
 * **Por que isto é `infra/` e não Custódia.** As duas tabelas são mecanismo:
 * `infra/` é a camada que conhece o banco e não conhece regra de negócio. O
 * expurgo de T15 compõe esta função com as demais; ela sozinha não sabe o que é
 * um Participante nem o que é um prazo de retenção.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Quanto tempo uma linha de mecanismo sobrevive: 48 h (T15 §4).
 *
 * Folgadamente acima de qualquer janela em uso — a maior configurável é
 * `RATE_LIMIT_JANELA_SEGUNDOS`, limitada a um dia em `env.ts` justamente para
 * que esta constante não possa apagar uma marca que o limite ainda usaria. A
 * idempotência precisa de menos ainda: um reenvio de formulário acontece em
 * segundos, não em dias.
 */
export const IDADE_MAXIMA_DE_MECANISMO_MS = 48 * 60 * 60 * 1000

export type ContagemDeHigiene = {
  readonly chaveIdempotencia: number
  readonly limiteTaxa: number
}

async function contar(db: Db, consulta: Promise<{ total: number }[]>): Promise<number> {
  const [linha] = await consulta
  return linha?.total ?? 0
}

/**
 * Apaga chaves de idempotência e marcas de limite mais velhas que o corte.
 *
 * Conta antes de apagar, na mesma transação: `rowCount` existe no driver de
 * produção e não no PGlite da suíte, e um número que só aparece em um dos dois
 * ambientes é um número que o teste não verifica.
 */
export async function expurgarMecanismo(
  db: Db,
  agora: number = Date.now(),
  idadeMs: number = IDADE_MAXIMA_DE_MECANISMO_MS,
): Promise<ContagemDeHigiene> {
  const corte = new Date(agora - idadeMs)

  return db.transaction(async (tx) => {
    const chaveIdempotencia = await contar(
      tx,
      tx
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.chaveIdempotencia)
        .where(lt(schema.chaveIdempotencia.criadoEm, corte)),
    )

    const limiteTaxa = await contar(
      tx,
      tx
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.limiteTaxa)
        .where(lt(schema.limiteTaxa.ocorridoEm, corte)),
    )

    await tx.delete(schema.chaveIdempotencia).where(lt(schema.chaveIdempotencia.criadoEm, corte))
    await tx.delete(schema.limiteTaxa).where(lt(schema.limiteTaxa.ocorridoEm, corte))

    return { chaveIdempotencia, limiteTaxa }
  })
}

/**
 * De quanto em quanto tempo um processo repete a varredura.
 *
 * Uma hora. As tabelas toleram folga — o corte é de 48 h — e o que não se
 * tolera é uma varredura por requisição no dia em que 2000 pessoas se
 * inscrevem em algumas horas.
 */
export const INTERVALO_DE_HIGIENE_MS = 60 * 60 * 1000

let ultimaVarredura = 0

/**
 * A higiene automática (critério de aceitação de T15).
 *
 * **Oportunista, e não agendada.** Não há agendador neste sistema: a
 * hospedagem ainda não está escolhida (PE-05) e um `cron` que só existe em um
 * provedor viraria dívida no dia da migração. O gatilho é o próprio caminho que
 * cria as linhas — toda escrita idempotente passa por `consultarEfeito` —, e um
 * relógio de módulo garante que só a primeira de cada hora faça alguma coisa.
 *
 * **Não é aguardada, e é isso que a mantém fora do caminho da requisição.** A
 * varredura roda solta; se falhar, o registro sai no log e a inscrição da
 * pessoa segue normalmente. O oposto — a inscrição falhar porque a faxina
 * falhou — seria trocar um problema que ninguém vê por um que todo mundo vê.
 *
 * **O que se paga:** em ambiente sem processo longo, a função pode ser
 * interrompida antes de terminar. Não há dano: o DELETE é idempotente e a
 * próxima requisição depois da hora tenta de novo. E o comando de terminal
 * `npm run expurgar -- --higiene` faz a mesma coisa sob demanda, para quando o
 * ambiente não colaborar.
 */
export function agendarHigiene(db: Db, agora: number = Date.now()): void {
  if (agora - ultimaVarredura < INTERVALO_DE_HIGIENE_MS) return

  // Marcado **antes** de começar: duas requisições simultâneas depois da hora
  // encontrariam as duas o relógio vencido, e a segunda varreria de novo à toa.
  ultimaVarredura = agora

  void expurgarMecanismo(db, agora)
    .then((contagens) => {
      // Silêncio quando não havia nada a fazer. Uma linha de log por hora
      // dizendo "apaguei zero" é ruído no agregador durante o evento inteiro.
      if (contagens.chaveIdempotencia + contagens.limiteTaxa === 0) return

      registrarOperacao({ evento: 'infra.higiene', resultado: 'sucesso', contagens })
    })
    .catch((erro: unknown) => {
      registrarOperacao({
        evento: 'infra.higiene',
        resultado: 'erro',
        motivo: erro instanceof Error ? erro.message : 'desconhecido',
      })
    })
}

/** Zera o relógio de módulo. Existe para o teste; a aplicação nunca chama. */
export function reiniciarHigiene(): void {
  ultimaVarredura = 0
}
