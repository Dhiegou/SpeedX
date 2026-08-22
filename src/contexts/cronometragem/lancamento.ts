import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { Pitch } from '@/contexts/inscricao/contrato'
import * as schema from '@/db/schema'
import {
  chaveValida,
  consultarEfeito,
  digerir,
  guardarEfeito,
  violouUnicidade,
} from '@/infra/idempotencia'
import { TEMPO_MAXIMO_MS } from '@/shared/tempo'
import { explicarRecusa, permite, TRANSICOES, type Acao } from './maquinaDeEstados'
import type { EstadoDaTentativa, TentativaResolvida } from './modelo'

/**
 * As três transições de Tempo da Tentativa (RF-17, RF-21, RF-22, RF-23, RF-25).
 *
 * `registrarTempo`, `corrigirTempo` e `marcarAusente` são a mesma operação com
 * parâmetros diferentes: travar a linha, conferir se a transição existe a partir
 * do estado atual, escrever o novo estado, registrar quem fez, guardar o efeito
 * sob a chave de idempotência. Escrevê-las três vezes seria manter três cópias
 * da parte difícil — a concorrência — e é justamente a parte que ninguém
 * revisa três vezes com o mesmo cuidado.
 *
 * A API são as três funções nomeadas, porque é assim que o painel pensa. O
 * motor é um só.
 *
 * **Concorrência (RF-12).** A linha da Tentativa é travada com `SELECT ... FOR
 * UPDATE` dentro da transação. Dois Operadores lançando o mesmo tempo ao mesmo
 * tempo: um entra, o outro espera o lock, lê o estado já mudado e recebe uma
 * recusa legível. Nunca uma sobrescrita silenciosa — que é o defeito que faria
 * um Tempo medido desaparecer sem deixar rastro no meio do evento.
 *
 * Escolhi `FOR UPDATE` em vez do `UPDATE ... WHERE estado = ?` que a task
 * sugere como alternativa porque a correção **precisa** do valor anterior para
 * a trilha de auditoria (RF-23), e lê-lo antes sem travar reabriria exatamente
 * a janela que o compare-and-set fecha.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Um escopo só para as três ações: a chave é única no banco inteiro. */
export const ESCOPO_LANCAMENTO = 'lancamento'

export type ComandoDeLancamento = {
  readonly tentativaId: string
  readonly operadorId: string
  /** `Idempotency-Key`. Obrigatória: reenvio é a regra, não a exceção (FL-06). */
  readonly chave: string | null
  /** Milissegundos inteiros. Ausente em `marcarAusente`. */
  readonly tempoMs?: number
  readonly agora?: number
}

export type ResultadoDeLancamento =
  | {
      readonly situacao: 'aplicado'
      readonly tentativa: TentativaResolvida
      readonly lancamentoId: string
    }
  /** Mesma chave, mesmo comando: devolve o efeito guardado, sem reexecutar. */
  | {
      readonly situacao: 'repetida'
      readonly tentativa: TentativaResolvida
      readonly lancamentoId: string
    }
  | { readonly situacao: 'chave_ausente' }
  /** Mesma chave, outro comando. Não é reenvio: é colisão. */
  | { readonly situacao: 'chave_em_conflito' }
  | { readonly situacao: 'tentativa_inexistente' }
  /**
   * A transição não existe a partir do estado atual — inclui o caso de RF-25,
   * um segundo registro sobre Tentativa que já tem Tempo.
   *
   * Carrega o estado e, quando há, o Tempo que já está lá: o painel precisa
   * disso para oferecer a correção em vez de só dizer "não deu" (T11).
   */
  | {
      readonly situacao: 'transicao_recusada'
      readonly estadoAtual: EstadoDaTentativa
      readonly tempoMsAtual: number | null
      /** Quando o Tempo atual foi lançado. Nulo se a Tentativa está Pendente. */
      readonly resolvidoEmAtual: Date | null
      /** **Nome** de quem resolveu, não o UUID. T10 monta o 409 com isto. */
      readonly operadorAtual: string | null
      readonly mensagem: string
    }
  | { readonly situacao: 'tempo_invalido'; readonly mensagem: string }

/** O que fica guardado sob a chave. Datas viram texto ao passar pelo JSONB. */
type EfeitoDeLancamento = {
  readonly tentativaId: string
  readonly participanteId: string
  readonly pitch: number
  readonly estado: EstadoDaTentativa
  readonly tempoMs: number | null
  readonly resolvidoEm: string | null
  readonly operadorId: string | null
  readonly lancamentoId: string
}

function comoPitch(valor: number): Pitch {
  // O banco garante `pitch in (1,2)` por constraint; isto é o estreitamento de
  // tipo que o TypeScript não deduz de um smallint.
  return valor === 2 ? 2 : 1
}

function reidratar(efeito: EfeitoDeLancamento): {
  tentativa: TentativaResolvida
  lancamentoId: string
} {
  return {
    tentativa: {
      id: efeito.tentativaId,
      participanteId: efeito.participanteId,
      pitch: comoPitch(efeito.pitch),
      estado: efeito.estado,
      tempoMs: efeito.tempoMs,
      resolvidoEm: efeito.resolvidoEm === null ? null : new Date(efeito.resolvidoEm),
      operadorId: efeito.operadorId,
    },
    lancamentoId: efeito.lancamentoId,
  }
}

/**
 * Faixa plausível de Tempo.
 *
 * O teto é o mesmo de `parseTempo` (T02), e existe para pegar erro de
 * digitação: um lançamento de duas horas numa corrida de minutos é dedo escorregando
 * no teclado, não resultado. Aqui a conferência é refeita porque o caso de uso
 * também é alcançável pela digitação das fichas de papel de T20, que não passa
 * pelo mesmo caminho de tela.
 */
function conferirTempo(tempoMs: unknown): string | null {
  if (typeof tempoMs !== 'number' || !Number.isInteger(tempoMs)) {
    return 'Tempo inválido: informe milissegundos inteiros.'
  }

  if (tempoMs <= 0) return 'Tempo inválido: 00:00.00 não é um resultado de corrida.'

  if (tempoMs > TEMPO_MAXIMO_MS) {
    return 'Tempo inválido: ultrapassa o limite de 99:59.99. Confira a digitação.'
  }

  return null
}

async function aplicar(
  db: Db,
  acao: Acao,
  comando: ComandoDeLancamento,
): Promise<ResultadoDeLancamento> {
  const transicao = TRANSICOES[acao]
  const agora = new Date(comando.agora ?? Date.now())

  if (!chaveValida(comando.chave)) return { situacao: 'chave_ausente' }
  const chave = comando.chave

  if (transicao.exigeTempo) {
    const problema = conferirTempo(comando.tempoMs)
    if (problema !== null) return { situacao: 'tempo_invalido', mensagem: problema }
  }

  // O operador entra na digestão junto com o resto: se duas pessoas usarem a
  // mesma chave por acidente, a segunda recebe conflito em vez da confirmação
  // de um lançamento que ela não fez (mesmo raciocínio de D-28).
  const digestao = digerir({
    acao,
    tentativaId: comando.tentativaId,
    operadorId: comando.operadorId,
    tempoMs: comando.tempoMs ?? null,
  })

  const guardado = await consultarEfeito<EfeitoDeLancamento>(db, chave, ESCOPO_LANCAMENTO, digestao)

  if (guardado.situacao === 'conflito') return { situacao: 'chave_em_conflito' }

  if (guardado.situacao === 'repetida') {
    return { situacao: 'repetida', ...reidratar(guardado.corpo) }
  }

  try {
    return await db.transaction(async (tx) => {
      // A trava. Tudo o que vem depois enxerga um estado que mais ninguém pode
      // mudar até esta transação terminar.
      // O `left join` traz o nome de quem resolveu a Tentativa, quando há
      // alguém: é o que permite à T10 responder "Tempo já registrado por Marina
      // às 14h32" em vez de um 409 seco. `for('update', { of: ... })` trava
      // apenas a linha da Tentativa — sem o `of`, o Postgres tentaria travar
      // também a linha do Operador, e dois lançamentos de pessoas diferentes
      // passariam a disputar um lock que nada tem a ver com a corrida.
      const [atual] = await tx
        .select({
          id: schema.tentativa.id,
          participanteId: schema.tentativa.participanteId,
          pitch: schema.tentativa.pitch,
          estado: schema.tentativa.estado,
          tempoMs: schema.tentativa.tempoMs,
          resolvidoEm: schema.tentativa.resolvidoEm,
          operadorNome: schema.operador.nome,
        })
        .from(schema.tentativa)
        .leftJoin(schema.operador, eq(schema.operador.id, schema.tentativa.operadorId))
        .where(eq(schema.tentativa.id, comando.tentativaId))
        .for('update', { of: schema.tentativa })
        .limit(1)

      if (atual === undefined) return { situacao: 'tentativa_inexistente' as const }

      if (!permite(acao, atual.estado)) {
        return {
          situacao: 'transicao_recusada' as const,
          estadoAtual: atual.estado,
          tempoMsAtual: atual.tempoMs,
          resolvidoEmAtual: atual.resolvidoEm,
          operadorAtual: atual.operadorNome,
          mensagem: explicarRecusa(acao, atual.estado),
        }
      }

      const tempoNovo = transicao.exigeTempo ? (comando.tempoMs ?? null) : null

      const [atualizada] = await tx
        .update(schema.tentativa)
        .set({
          estado: transicao.destino,
          tempoMs: tempoNovo,
          operadorId: comando.operadorId,
          // A correção preserva o instante original: é o desempate de RF-31, e
          // mexer nele faria um acerto de digitação mudar a posição de terceiros.
          ...(transicao.carimbaResolucao ? { resolvidoEm: agora } : {}),
        })
        .where(eq(schema.tentativa.id, comando.tentativaId))
        .returning({
          id: schema.tentativa.id,
          participanteId: schema.tentativa.participanteId,
          pitch: schema.tentativa.pitch,
          estado: schema.tentativa.estado,
          tempoMs: schema.tentativa.tempoMs,
          resolvidoEm: schema.tentativa.resolvidoEm,
          operadorId: schema.tentativa.operadorId,
        })

      if (atualizada === undefined) throw new Error('UPDATE de tentativa não devolveu linha.')

      const [lancamento] = await tx
        .insert(schema.lancamento)
        .values({
          tentativaId: comando.tentativaId,
          tipo: transicao.tipoDeLancamento,
          // A correção guarda o valor anterior; o registro não tem anterior; a
          // ausência não tem nenhum dos dois. A constraint do banco recusa
          // qualquer outra combinação (T02).
          tempoMsAnterior: transicao.tipoDeLancamento === 'correcao' ? atual.tempoMs : null,
          tempoMsNovo: tempoNovo,
          operadorId: comando.operadorId,
          ocorridoEm: agora,
        })
        .returning({ id: schema.lancamento.id })

      if (lancamento === undefined) throw new Error('INSERT de lançamento não devolveu linha.')

      const efeito: EfeitoDeLancamento = {
        tentativaId: atualizada.id,
        participanteId: atualizada.participanteId,
        pitch: atualizada.pitch,
        estado: atualizada.estado,
        tempoMs: atualizada.tempoMs,
        resolvidoEm: atualizada.resolvidoEm?.toISOString() ?? null,
        operadorId: atualizada.operadorId,
        lancamentoId: lancamento.id,
      }

      // Estado, auditoria e chave na mesma transação. Se qualquer um falhar, os
      // três somem — é o que faz o reenvio devolver o resultado original em vez
      // de um segundo Lançamento (SDD §4.3, FL-06).
      await guardarEfeito(tx, chave, ESCOPO_LANCAMENTO, digestao, efeito)

      return { situacao: 'aplicado' as const, ...reidratar(efeito) }
    })
  } catch (erro) {
    if (!violouUnicidade(erro)) throw erro

    // Dois envios da mesma chave ao mesmo tempo: um gravou, o outro esbarrou na
    // chave primária. O que perdeu a corrida devolve o efeito do que ganhou —
    // que é exatamente o que idempotência promete.
    const efeito = await consultarEfeito<EfeitoDeLancamento>(db, chave, ESCOPO_LANCAMENTO, digestao)

    if (efeito.situacao !== 'repetida') return { situacao: 'chave_em_conflito' }

    return { situacao: 'repetida', ...reidratar(efeito.corpo) }
  }
}

/**
 * Lança o Tempo de uma Tentativa (RF-17, RF-23).
 *
 * Vale a partir de Pendente e de Ausente — quem foi dado como ausente e
 * apareceu depois corre e tem o tempo lançado direto.
 *
 * Sobre Tentativa que já tem Tempo, **recusa** em vez de sobrescrever (RF-25),
 * devolvendo o valor que já está lá para o painel oferecer a correção.
 */
export function registrarTempo(
  db: Db,
  comando: ComandoDeLancamento,
): Promise<ResultadoDeLancamento> {
  return aplicar(db, 'registrar', comando)
}

/**
 * Troca o Tempo de uma Tentativa já resolvida (RF-22).
 *
 * Gera linha nova na trilha, com anterior e novo (RF-23). **Não** altera
 * `resolvido_em`, que é o desempate de RF-31.
 */
export function corrigirTempo(
  db: Db,
  comando: ComandoDeLancamento,
): Promise<ResultadoDeLancamento> {
  return aplicar(db, 'corrigir', comando)
}

/**
 * Marca a Tentativa como Ausente (RF-21).
 *
 * Sai da Fila, permanece na Exportação, não aparece na Classificação. **Não é
 * exclusão**: o cadastro continua inteiro.
 */
export function marcarAusente(
  db: Db,
  comando: Omit<ComandoDeLancamento, 'tempoMs'>,
): Promise<ResultadoDeLancamento> {
  return aplicar(db, 'ausentar', comando)
}
