import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { Pitch } from '@/contexts/inscricao/contrato'
import * as schema from '@/db/schema'
import { normalizarNoBanco, padraoDeBusca } from './busca'
import type {
  EstadoDaTentativa,
  ItemDaFila,
  LancamentoRegistrado,
  ParticipanteEncontrado,
  TentativaDoParticipante,
} from './modelo'

/**
 * As leituras do contexto: a Fila, a busca global e a trilha de auditoria.
 *
 * Ficam aqui, e não em T10, porque são domínio: a Fila **é** a definição de
 * "quem ainda não tem tempo neste Pitch" (RF-14), e a derivação dos quatro
 * últimos dígitos do telefone (RF-15) é uma regra de fronteira — o número
 * completo não atravessa o contexto (SDD §2). A rota apenas serializa.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Teto de itens devolvidos.
 *
 * A Fila de um Pitch começa o dia com mais de mil pendentes. Mandar tudo de uma
 * vez castiga a rede do tablet e a memória do navegador para mostrar uma lista
 * que ninguém rola até o fim — o Operador busca pelo nome (RF-16). Quem chama
 * recebe `truncado` junto e avisa na tela que há mais.
 */
export const LIMITE_DA_FILA = 200

/** Teto da busca global, menor: ali o Operador procura uma pessoa específica. */
export const LIMITE_DA_BUSCA = 50

/** Resultado paginado por teto, com o aviso de que sobrou coisa de fora. */
export type Pagina<T> = {
  readonly itens: readonly T[]
  /** Verdadeiro quando o teto cortou resultados. A tela precisa dizer isso. */
  readonly truncado: boolean
}

/** Aplica o teto pedindo um item a mais, que é como se sabe que há mais. */
function paginar<T>(linhas: readonly T[], limite: number): Pagina<T> {
  return { itens: linhas.slice(0, limite), truncado: linhas.length > limite }
}

const ULTIMOS_4 = sql<string>`right(${schema.participante.telefone}, 4)`

/** `nome` ou `sobrenome` casam o trecho buscado, sem acento e sem caixa. */
function casaONome(padrao: string) {
  return or(
    sql`${normalizarNoBanco(schema.participante.nome)} like ${padrao}`,
    sql`${normalizarNoBanco(schema.participante.sobrenome)} like ${padrao}`,
  )
}

/**
 * A Fila de um Pitch: Tentativas Pendentes, da inscrição mais antiga para a mais
 * recente (RF-14).
 *
 * Ausentes e resolvidas ficam de fora — é a definição de Fila, e é o que RF-21
 * quer dizer com "removendo-o da fila sem excluir o cadastro".
 *
 * A busca é por **trecho**, sem acento e sem caixa (RF-16): "neto" acha
 * "Assumpção Neto" e "joao" acha "João". O raciocínio e a medição que levaram a
 * essa forma estão em `busca.ts`.
 */
export async function listarFila(
  db: Db,
  pitch: Pitch,
  filtro: { busca?: string; limite?: number } = {},
): Promise<Pagina<ItemDaFila>> {
  const limite = filtro.limite ?? LIMITE_DA_FILA
  const padrao = padraoDeBusca(filtro.busca)

  const linhas = await db
    .select({
      tentativaId: schema.tentativa.id,
      participanteId: schema.participante.id,
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      // Derivados no banco: assim o telefone completo não chega nem a trafegar
      // para dentro do processo da aplicação (RNF-08).
      ultimos4Telefone: ULTIMOS_4,
      inscritoEm: schema.tentativa.inscritoEm,
    })
    .from(schema.tentativa)
    .innerJoin(schema.participante, eq(schema.participante.id, schema.tentativa.participanteId))
    .where(
      and(
        eq(schema.tentativa.pitch, pitch),
        eq(schema.tentativa.estado, 'pendente'),
        padrao === null ? undefined : casaONome(padrao),
      ),
    )
    .orderBy(asc(schema.tentativa.inscritoEm))
    .limit(limite + 1)

  return paginar(linhas, limite)
}

/** Quantas Tentativas ainda esperam neste Pitch. O painel mostra em fonte grande. */
export async function contarPendentes(db: Db, pitch: Pitch): Promise<number> {
  const [linha] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.tentativa)
    .where(and(eq(schema.tentativa.pitch, pitch), eq(schema.tentativa.estado, 'pendente')))

  return linha?.total ?? 0
}

/**
 * Busca global de Participante, **fora** da Fila.
 *
 * A Fila só mostra quem ainda não correu, e é isso que a torna útil. Mas RF-22
 * (corrigir um tempo) e RF-24 (incluir num Pitch adicional) tratam justamente
 * de quem **saiu** da Fila — já lançado ou marcado como ausente. Sem esta
 * consulta, o Operador não teria como alcançá-los.
 *
 * Devolve as Tentativas de cada pessoa nos dois Pitches, com estado e Tempo,
 * porque é essa a decisão que o Operador vai tomar em seguida: corrigir esta,
 * ou incluir naquele outro.
 */
export async function buscarParticipantes(
  db: Db,
  filtro: { busca: string; limite?: number },
): Promise<Pagina<ParticipanteEncontrado>> {
  const limite = filtro.limite ?? LIMITE_DA_BUSCA
  const padrao = padraoDeBusca(filtro.busca)

  // Busca vazia devolve vazio, e não a base inteira. Na Fila o campo em branco
  // significa "mostre a fila"; aqui significaria "despeje os 2000 cadastros".
  if (padrao === null) return { itens: [], truncado: false }

  const pessoas = await db
    .select({
      participanteId: schema.participante.id,
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      ultimos4Telefone: ULTIMOS_4,
    })
    .from(schema.participante)
    .where(casaONome(padrao))
    .orderBy(asc(schema.participante.nome), asc(schema.participante.sobrenome))
    .limit(limite + 1)

  const pagina = paginar(pessoas, limite)

  if (pagina.itens.length === 0) return { itens: [], truncado: pagina.truncado }

  const tentativas = await db
    .select({
      tentativaId: schema.tentativa.id,
      participanteId: schema.tentativa.participanteId,
      pitch: schema.tentativa.pitch,
      estado: schema.tentativa.estado,
      tempoMs: schema.tentativa.tempoMs,
      resolvidoEm: schema.tentativa.resolvidoEm,
    })
    .from(schema.tentativa)
    .where(
      inArray(
        schema.tentativa.participanteId,
        pagina.itens.map((p) => p.participanteId),
      ),
    )
    .orderBy(asc(schema.tentativa.pitch))

  const porParticipante = new Map<string, TentativaDoParticipante[]>()

  for (const t of tentativas) {
    const lista = porParticipante.get(t.participanteId) ?? []
    lista.push({
      tentativaId: t.tentativaId,
      pitch: t.pitch === 2 ? 2 : 1,
      estado: t.estado,
      tempoMs: t.tempoMs,
      resolvidoEm: t.resolvidoEm,
    })
    porParticipante.set(t.participanteId, lista)
  }

  return {
    itens: pagina.itens.map((p) => ({
      ...p,
      tentativas: porParticipante.get(p.participanteId) ?? [],
    })),
    truncado: pagina.truncado,
  }
}

/**
 * A trilha de Lançamentos de uma Tentativa, do mais antigo para o mais recente
 * (RF-23).
 *
 * Traz o **nome** do Operador junto, e não só o identificador: o pedido de
 * RF-23 é "consultar um lançamento revela autor e momento", e um UUID não
 * revela autor para quem está mediando uma contestação no dia do evento.
 *
 * A tabela é append-only: correção gera linha nova, nunca altera a anterior.
 * Por isso esta consulta é o histórico completo, não o estado atual.
 */
export async function historicoDaTentativa(
  db: Db,
  tentativaId: string,
): Promise<readonly LancamentoRegistrado[]> {
  return db
    .select({
      id: schema.lancamento.id,
      tipo: schema.lancamento.tipo,
      tempoMsAnterior: schema.lancamento.tempoMsAnterior,
      tempoMsNovo: schema.lancamento.tempoMsNovo,
      operadorId: schema.lancamento.operadorId,
      operadorNome: schema.operador.nome,
      ocorridoEm: schema.lancamento.ocorridoEm,
    })
    .from(schema.lancamento)
    .innerJoin(schema.operador, eq(schema.operador.id, schema.lancamento.operadorId))
    .where(eq(schema.lancamento.tentativaId, tentativaId))
    .orderBy(asc(schema.lancamento.ocorridoEm))
}

/** Estado atual de uma Tentativa, para a tela decidir o que oferecer. */
export async function estadoDaTentativa(
  db: Db,
  tentativaId: string,
): Promise<EstadoDaTentativa | null> {
  const [linha] = await db
    .select({ estado: schema.tentativa.estado })
    .from(schema.tentativa)
    .where(eq(schema.tentativa.id, tentativaId))
    .limit(1)

  return linha?.estado ?? null
}
