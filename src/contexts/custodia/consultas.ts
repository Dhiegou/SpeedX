import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'

/**
 * As leituras da Custódia — o único lugar do sistema autorizado a cruzar dado
 * pessoal de Inscrição com resultado de Cronometragem (SDD BC-05).
 *
 * Essa autorização é a razão de este contexto existir. Ela precisa ser um ponto
 * único, nomeado e auditável, e não uma capacidade difusa que qualquer consulta
 * possa exercer: o lint permite só a este diretório importar os dois lados, e
 * `tests/fronteiras.test.ts` falha se a permissão vazar para outro lugar.
 *
 * **Leitura em lotes, não de uma vez.** Quatro mil linhas com dados de
 * Responsável cabem em memória, mas a exportação é o único ponto do sistema que
 * carrega a base inteira — e é o que roda no fim do evento, quando o servidor já
 * passou dez horas trabalhando. Ler por lotes mantém o pico de memória constante
 * independentemente do tamanho da massa.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Quantas linhas por ida ao banco. */
export const TAMANHO_DO_LOTE = 500

/** Uma linha da exportação completa: uma Tentativa, com o Participante junto. */
export type LinhaDaExportacao = {
  participanteId: string
  nome: string
  sobrenome: string
  email: string
  telefone: string
  idade: number
  responsavelNome: string | null
  responsavelSobrenome: string | null
  responsavelTelefone: string | null
  consentimentoVersao: string | null
  consentimentoRegistradoEm: Date | null
  aceiteCompartilhamento: boolean | null
  inscritoEm: Date
  pitch: number
  estado: 'pendente' | 'valida' | 'ausente'
  tempoMs: number | null
  resolvidoEm: Date | null
  operador: string | null
  qtdCorrecoes: number
}

/**
 * Percorre a exportação completa em lotes.
 *
 * Ordenada por `(participante_id, pitch)`: as duas linhas de quem correu os dois
 * Pitches ficam juntas na planilha, e o par serve de cursor estável — paginar
 * por `OFFSET` reordenaria silenciosamente se algo fosse gravado no meio da
 * leitura, e no fim do evento ainda há Operador lançando.
 */
export async function* lerExportacaoCompleta(db: Db): AsyncGenerator<LinhaDaExportacao> {
  let cursor: { participanteId: string; pitch: number } | null = null

  for (;;) {
    const lote: LinhaDaExportacao[] = await db
      .select({
        participanteId: schema.participante.id,
        nome: schema.participante.nome,
        sobrenome: schema.participante.sobrenome,
        email: schema.participante.email,
        telefone: schema.participante.telefone,
        idade: schema.participante.idade,
        responsavelNome: schema.responsavel.nome,
        responsavelSobrenome: schema.responsavel.sobrenome,
        responsavelTelefone: schema.responsavel.telefone,
        consentimentoVersao: schema.consentimento.versaoTermo,
        consentimentoRegistradoEm: schema.consentimento.registradoEm,
        aceiteCompartilhamento: schema.consentimento.aceiteCompartilhamento,
        inscritoEm: schema.tentativa.inscritoEm,
        pitch: schema.tentativa.pitch,
        estado: schema.tentativa.estado,
        tempoMs: schema.tentativa.tempoMs,
        resolvidoEm: schema.tentativa.resolvidoEm,
        operador: schema.operador.nome,
        // Quantas vezes o tempo foi corrigido. É o número que o organizador
        // olha primeiro quando alguém contesta um resultado (RF-23).
        qtdCorrecoes: sql<number>`(
          select count(*)::int from ${schema.lancamento}
          where ${schema.lancamento.tentativaId} = ${schema.tentativa.id}
            and ${schema.lancamento.tipo} = 'correcao'
        )`,
      })
      .from(schema.tentativa)
      .innerJoin(schema.participante, eq(schema.participante.id, schema.tentativa.participanteId))
      // `left` nos três: Responsável só existe para menores, Consentimento pode
      // faltar em massa de teste antiga, e Operador não existe para Pendente.
      .leftJoin(schema.responsavel, eq(schema.responsavel.participanteId, schema.participante.id))
      .leftJoin(
        schema.consentimento,
        eq(schema.consentimento.participanteId, schema.participante.id),
      )
      .leftJoin(schema.operador, eq(schema.operador.id, schema.tentativa.operadorId))
      .where(
        cursor === null
          ? undefined
          : or(
              gt(schema.participante.id, cursor.participanteId),
              and(
                eq(schema.participante.id, cursor.participanteId),
                gt(schema.tentativa.pitch, cursor.pitch),
              ),
            ),
      )
      .orderBy(asc(schema.participante.id), asc(schema.tentativa.pitch))
      .limit(TAMANHO_DO_LOTE)

    if (lote.length === 0) return

    for (const linha of lote) yield linha

    const ultima = lote[lote.length - 1]
    if (ultima === undefined || lote.length < TAMANHO_DO_LOTE) return

    cursor = { participanteId: ultima.participanteId, pitch: ultima.pitch }
  }
}

/** Uma linha da lista de repasse: o mínimo que a promessa do termo permite. */
export type LinhaDeRepasse = {
  nome: string
  sobrenome: string
  telefone: string
}

/**
 * Quem **autorizou** o repasse do telefone à FIAP e à escolinha (D-23).
 *
 * O filtro está na consulta, e é a única forma correta de fazer isto. Exportar
 * todo mundo com uma coluna `autorizou` e pedir que filtrem do outro lado
 * entrega o telefone de quem recusou no instante em que o arquivo sai daqui —
 * e é exatamente o que a caixa opcional do formulário existe para impedir.
 *
 * Uma pessoa aparece **uma vez**, mesmo tendo corrido os dois Pitches: isto é
 * uma lista de contato, não uma lista de tentativas.
 */
export async function lerListaDeRepasse(db: Db): Promise<readonly LinhaDeRepasse[]> {
  return db
    .select({
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      telefone: schema.participante.telefone,
    })
    .from(schema.participante)
    .innerJoin(
      schema.consentimento,
      eq(schema.consentimento.participanteId, schema.participante.id),
    )
    .where(eq(schema.consentimento.aceiteCompartilhamento, true))
    .orderBy(asc(schema.participante.nome), asc(schema.participante.sobrenome))
}

/** Uma Tentativa que ficou sem desfecho. */
export type Pendencia = {
  tentativaId: string
  nome: string
  sobrenome: string
  ultimos4Telefone: string
  pitch: number
  inscritoEm: Date
}

/**
 * Tentativas sem tempo e sem marcação de ausência — a métrica primária do
 * PRD §7, cuja meta é **zero** ao fim do evento.
 *
 * Existe para ser rodada **durante** o evento, não depois: uma pendência
 * descoberta às dezoito horas ainda dá para resolver chamando a pessoa; a mesma
 * pendência descoberta no dia seguinte é um resultado perdido para sempre.
 *
 * Traz só os quatro últimos dígitos do telefone, como a Fila do painel: quem
 * lê este relatório precisa identificar a pessoa na arquibancada, não ligar
 * para ela.
 */
export async function lerPendencias(db: Db): Promise<readonly Pendencia[]> {
  return db
    .select({
      tentativaId: schema.tentativa.id,
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      ultimos4Telefone: sql<string>`right(${schema.participante.telefone}, 4)`,
      pitch: schema.tentativa.pitch,
      inscritoEm: schema.tentativa.inscritoEm,
    })
    .from(schema.tentativa)
    .innerJoin(schema.participante, eq(schema.participante.id, schema.tentativa.participanteId))
    .where(and(eq(schema.tentativa.estado, 'pendente'), isNull(schema.tentativa.resolvidoEm)))
    .orderBy(asc(schema.tentativa.pitch), asc(schema.tentativa.inscritoEm))
}
