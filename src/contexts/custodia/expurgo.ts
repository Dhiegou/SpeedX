import { asc, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { expurgarSessoesInativas } from '@/contexts/identidade/sessao'
import { IDADE_MAIORIDADE } from '@/contexts/inscricao/idades'
import * as schema from '@/db/schema'
import { expurgarMecanismo } from '@/infra/higiene'

/**
 * O expurgo (T15 — RNF-11, RF-09).
 *
 * A Custódia é o contexto cuja atividade principal acontece depois que todos os
 * outros pararam. Isto é a última coisa que este sistema faz.
 *
 * **Duas operações, e a diferença entre elas é quem pediu.**
 *
 * | | quando | alcance |
 * |---|---|---|
 * | total | 10 dias depois do evento (PE-02) | todo mundo |
 * | individual | a qualquer momento, a pedido | uma pessoa |
 *
 * A individual é a que o termo promete por e-mail e no ponto de inscrição
 * (D-20, D-22), e por isso precisa ser executável **no dia**, por quem está lá,
 * e não por um script que roda depois. As duas deixam registro.
 *
 * **O que sobrevive: números, e só.** O termo permite guardar "apenas números
 * que não identificam ninguém, como tempos e quantidade de participantes". Foi
 * o que se implementou — `resumoAnonimo` é gerado antes de apagar e sai pelo
 * terminal e pelo log. Nada disso volta para uma tabela: uma linha guardada é
 * uma linha que alguém, daqui a um ano, cruza com outra coisa.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// ---------------------------------------------------------------------------
// O que existe agora — lido antes, porque depois não há mais o que ler
// ---------------------------------------------------------------------------

export type ContagemDaBase = {
  readonly participante: number
  readonly responsavel: number
  readonly consentimento: number
  readonly tentativa: number
  readonly lancamento: number
  readonly sessao: number
  readonly chaveIdempotencia: number
  readonly limiteTaxa: number
}

/** Ordem fixa: é a que sai no terminal e a que o teste compara. */
const TABELAS = [
  ['participante', schema.participante],
  ['responsavel', schema.responsavel],
  ['consentimento', schema.consentimento],
  ['tentativa', schema.tentativa],
  ['lancamento', schema.lancamento],
  ['sessao', schema.sessao],
  ['chaveIdempotencia', schema.chaveIdempotencia],
  ['limiteTaxa', schema.limiteTaxa],
] as const

/**
 * Quantas linhas cada tabela tem.
 *
 * Serve a dois momentos e é a mesma consulta nos dois: ao ensaio, que mostra o
 * que sairia, e à conferência depois do expurgo, que precisa dar zero em todas.
 * Contar de um jeito antes e de outro depois seria comparar duas perguntas
 * diferentes e chamar o resultado de verificação.
 */
export async function contarBase(db: Db): Promise<ContagemDaBase> {
  const pares = await Promise.all(
    TABELAS.map(async ([nome, tabela]) => {
      const [linha] = await db.select({ total: sql<number>`count(*)::int` }).from(tabela)
      return [nome, linha?.total ?? 0] as const
    }),
  )

  return Object.fromEntries(pares) as unknown as ContagemDaBase
}

// ---------------------------------------------------------------------------
// O resumo anônimo — o único vestígio que o termo autoriza
// ---------------------------------------------------------------------------

export type ResumoDeCockpit = {
  readonly cockpit: number
  readonly tentativas: number
  readonly validas: number
  readonly ausentes: number
  readonly pendentes: number
  readonly melhorMs: number | null
  readonly medianaMs: number | null
  readonly piorMs: number | null
}

export type ResumoAnonimo = {
  readonly geradoEm: string
  readonly participantes: number
  readonly menoresDeIdade: number
  readonly cockpits: readonly ResumoDeCockpit[]
}

/**
 * Os números do evento, sem ninguém dentro.
 *
 * **Nenhum campo aqui identifica pessoa, e isso é uma propriedade da consulta,
 * não uma promessa do comentário.** Só há `count`, `min`, `max` e um percentil:
 * não existe caminho por onde um nome, um telefone ou um id chegue ao resultado.
 * Nem a classificação com nome público sobrevive — nome identifica, e o termo
 * autoriza guardar "números que não identificam ninguém".
 *
 * A contagem de menores é agregada, e continua sendo um número: 160 de 2000 não
 * diz quem são os 160. A idade individual, essa vai embora com o resto.
 */
export async function resumoAnonimo(db: Db, agora: Date = new Date()): Promise<ResumoAnonimo> {
  const [totais] = await db
    .select({
      participantes: sql<number>`count(*)::int`,
      menores: sql<number>`count(*) filter (where ${schema.participante.idade} < ${IDADE_MAIORIDADE})::int`,
    })
    .from(schema.participante)

  const cockpits = await db
    .select({
      cockpit: schema.tentativa.cockpit,
      tentativas: sql<number>`count(*)::int`,
      validas: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'valida')::int`,
      ausentes: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'ausente')::int`,
      pendentes: sql<number>`count(*) filter (where ${schema.tentativa.estado} = 'pendente')::int`,
      melhorMs: sql<number | null>`min(${schema.tentativa.tempoMs})::int`,
      medianaMs: sql<
        number | null
      >`(percentile_cont(0.5) within group (order by ${schema.tentativa.tempoMs}))::int`,
      piorMs: sql<number | null>`max(${schema.tentativa.tempoMs})::int`,
    })
    .from(schema.tentativa)
    .groupBy(schema.tentativa.cockpit)
    .orderBy(asc(schema.tentativa.cockpit))

  return {
    geradoEm: agora.toISOString(),
    participantes: totais?.participantes ?? 0,
    menoresDeIdade: totais?.menores ?? 0,
    cockpits,
  }
}

// ---------------------------------------------------------------------------
// Expurgo total
// ---------------------------------------------------------------------------

export type ResultadoDoExpurgo = {
  readonly resumo: ResumoAnonimo
  readonly antes: ContagemDaBase
  readonly depois: ContagemDaBase
}

/**
 * Apaga tudo o que identifica alguém.
 *
 * **Uma transação só.** Um expurgo pela metade é o pior desfecho possível: fica
 * uma base que ninguém sabe mais o que contém, com o Participante apagado e o
 * Responsável dele de pé — e a promessa do termo já vencida.
 *
 * **A ordem de apagar é: `participante` primeiro, e o resto vem junto.**
 * Responsável, Consentimento e Tentativa apontam para ele com `on delete
 * cascade`, e Lançamento aponta para Tentativa do mesmo jeito. Escrever os
 * cinco DELETEs à mão pareceria mais explícito e seria mais frágil: uma tabela
 * nova que alguém acrescente com chave em cascata some sozinha aqui, e seria
 * esquecida numa lista escrita à mão.
 *
 * **`operador` não é apagado.** A conta do Operador não é dado do participante,
 * e é ela que permite entrar no painel depois do expurgo para conferir que a
 * base está vazia. O que vai embora são as sessões — elas ligam uma pessoa a
 * uma janela de tempo e não servem a nada depois do evento. Tirar o site do ar
 * é o passo seguinte do procedimento, e está em `docs/retencao.md`.
 *
 * O resumo anônimo é calculado **antes**, dentro da mesma transação, porque
 * depois não haveria de onde tirá-lo.
 */
export async function expurgarTudo(db: Db, agora: Date = new Date()): Promise<ResultadoDoExpurgo> {
  return db.transaction(async (tx) => {
    const resumo = await resumoAnonimo(tx, agora)
    const antes = await contarBase(tx)

    await tx.delete(schema.participante)
    await tx.delete(schema.sessao)
    await tx.delete(schema.chaveIdempotencia)
    await tx.delete(schema.limiteTaxa)

    const depois = await contarBase(tx)

    return { resumo, antes, depois }
  })
}

// ---------------------------------------------------------------------------
// Exclusão individual, a pedido
// ---------------------------------------------------------------------------

/** O que se sabe de alguém antes de apagar — o bastante para escolher a pessoa certa. */
export type CandidatoAExclusao = {
  readonly id: string
  readonly nome: string
  readonly sobrenome: string
  readonly ultimos4Telefone: string
  readonly idade: number
}

/**
 * Procura por e-mail, que é como o pedido chega (D-22).
 *
 * `participante.email` **não é único** — uma família com um e-mail só é o caso
 * previsto, não a exceção. Por isso a busca devolve lista: quem atende o pedido
 * confere de quem é antes de apagar, em vez de o comando escolher por conta
 * própria e apagar o irmão errado.
 *
 * Comparação sem distinção de caixa: ninguém escreve o próprio e-mail duas
 * vezes do mesmo jeito, e recusar o pedido por causa de uma maiúscula seria
 * transformar um direito em pegadinha.
 */
export async function procurarPorEmail(
  db: Db,
  email: string,
): Promise<readonly CandidatoAExclusao[]> {
  return db
    .select({
      id: schema.participante.id,
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      ultimos4Telefone: sql<string>`right(${schema.participante.telefone}, 4)`,
      idade: schema.participante.idade,
    })
    .from(schema.participante)
    .where(sql`lower(${schema.participante.email}) = lower(${email})`)
    .orderBy(asc(schema.participante.nome), asc(schema.participante.sobrenome))
}

export type ResultadoDaExclusao = {
  readonly participanteId: string
  readonly encontrado: boolean
  /** Se o telefone já pode ter sido repassado — obriga a encaminhar o pedido. */
  readonly autorizouRepasse: boolean
  readonly eraMenorDeIdade: boolean
  readonly tentativasRemovidas: number
  readonly lancamentosRemovidos: number
}

/**
 * Apaga uma pessoa e tudo que a ela se liga.
 *
 * **Lê antes de apagar, e não é detalhe.** `autorizouRepasse` só existe
 * enquanto a linha de Consentimento existe; depois do DELETE não há como
 * responder se o telefone daquela pessoa foi para a FIAP e para a escolinha —
 * e o termo promete encaminhar o pedido a quem recebeu. Perguntar depois seria
 * tarde para sempre.
 *
 * A Tentativa sai junto por cascata, e com ela a linha da Classificação: a
 * projeção lê `tentativa`, então não existe estado onde a pessoa esteja apagada
 * e continue na tabela pública. O que existe é atraso — o memo de cinco
 * segundos da projeção somado ao cache de borda de quinze e à tolerância de
 * trinta —, e menos de um minuto é o pior caso.
 */
export async function excluirParticipante(
  db: Db,
  participanteId: string,
): Promise<ResultadoDaExclusao> {
  return db.transaction(async (tx) => {
    const [pessoa] = await tx
      .select({
        idade: schema.participante.idade,
        autorizouRepasse: schema.consentimento.aceiteCompartilhamento,
      })
      .from(schema.participante)
      .leftJoin(
        schema.consentimento,
        eq(schema.consentimento.participanteId, schema.participante.id),
      )
      .where(eq(schema.participante.id, participanteId))
      .limit(1)

    if (pessoa === undefined) {
      return {
        participanteId,
        encontrado: false,
        autorizouRepasse: false,
        eraMenorDeIdade: false,
        tentativasRemovidas: 0,
        lancamentosRemovidos: 0,
      }
    }

    const [contagem] = await tx
      .select({
        tentativas: sql<number>`count(*)::int`,
        lancamentos: sql<number>`(
          select count(*)::int from ${schema.lancamento}
          where ${schema.lancamento.tentativaId} in (
            select ${schema.tentativa.id} from ${schema.tentativa}
            where ${schema.tentativa.participanteId} = ${participanteId}
          )
        )`,
      })
      .from(schema.tentativa)
      .where(eq(schema.tentativa.participanteId, participanteId))

    await tx.delete(schema.participante).where(eq(schema.participante.id, participanteId))

    return {
      participanteId,
      encontrado: true,
      autorizouRepasse: pessoa.autorizouRepasse === true,
      eraMenorDeIdade: pessoa.idade < IDADE_MAIORIDADE,
      tentativasRemovidas: contagem?.tentativas ?? 0,
      lancamentosRemovidos: contagem?.lancamentos ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Higiene, composta
// ---------------------------------------------------------------------------

export type ContagemDaHigiene = {
  readonly chaveIdempotencia: number
  readonly limiteTaxa: number
  readonly sessao: number
}

/**
 * A faxina sob demanda: mecanismo velho e sessão morta.
 *
 * Junta o que `infra/higiene.ts` faz sozinho a cada hora com o expurgo de
 * sessões, que mora em Identidade porque a tabela é de lá. A Custódia compõe as
 * duas coisas — é o contexto responsável pelo ciclo de vida do dado —, e nenhum
 * dos dois lados precisa conhecer o outro.
 */
export async function higienizar(db: Db, agora: Date = new Date()): Promise<ContagemDaHigiene> {
  const [antes] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.sessao)
  await expurgarSessoesInativas(db, agora.getTime())
  const [depois] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.sessao)

  const mecanismo = await expurgarMecanismo(db, agora.getTime())

  return { ...mecanismo, sessao: (antes?.total ?? 0) - (depois?.total ?? 0) }
}
