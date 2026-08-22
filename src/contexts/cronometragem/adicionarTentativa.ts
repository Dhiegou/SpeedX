import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { Pitch } from '@/contexts/inscricao/contrato'
import * as schema from '@/db/schema'
import { violouUnicidade } from '@/infra/idempotencia'
import type { TentativaResolvida } from './modelo'

/**
 * Inclui uma Tentativa em Pitch adicional para quem já está cadastrado (RF-24).
 *
 * O caso real: a pessoa se inscreveu só no Pitch 1, viu a corrida e resolveu
 * disputar o 2. Sem isto, o Operador a mandaria preencher o formulário de novo
 * e o evento acabaria com dois cadastros para a mesma pessoa — o que estraga a
 * Exportação, a Classificação e o expurgo de T15 de uma vez só.
 *
 * **A Tentativa nasce Pendente, e Pendente não tem autoria.** A constraint
 * `tentativa_autoria_coerente_com_estado` (T02) exige `operador_id` nulo
 * enquanto o estado for `pendente`, porque ninguém agiu sobre a Tentativa
 * ainda — é a mesma regra que vale para as Tentativas criadas na Inscrição.
 * Consequência assumida: **não fica registrado quem incluiu**. RF-23 cobre
 * gravação e alteração de Tempo, e incluir uma Tentativa vazia não é nenhuma
 * das duas. Se o organizador quiser esse rastro, custa um valor novo no enum
 * `tipo_lancamento` e uma migração — decisão para T21, anotada lá.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export type ComandoDeInclusao = {
  readonly participanteId: string
  readonly pitch: Pitch
}

export type ResultadoDeInclusao =
  | { readonly situacao: 'criada'; readonly tentativa: TentativaResolvida }
  /** RF-25 pela porta da frente: já existe Tentativa desta pessoa neste Pitch. */
  | { readonly situacao: 'ja_existe' }
  | { readonly situacao: 'participante_inexistente' }
  | { readonly situacao: 'pitch_invalido' }

/** Violação de chave estrangeira do Postgres, atravessando o embrulho do Drizzle. */
function violouChaveEstrangeira(erro: unknown): boolean {
  let atual: unknown = erro

  while (atual !== null && typeof atual === 'object') {
    if ((atual as { code?: unknown }).code === '23503') return true
    atual = (atual as { cause?: unknown }).cause
  }

  return false
}

export async function adicionarTentativa(
  db: Db,
  comando: ComandoDeInclusao,
): Promise<ResultadoDeInclusao> {
  if (comando.pitch !== 1 && comando.pitch !== 2) return { situacao: 'pitch_invalido' }

  try {
    const [criada] = await db
      .insert(schema.tentativa)
      .values({ participanteId: comando.participanteId, pitch: comando.pitch })
      .returning({
        id: schema.tentativa.id,
        participanteId: schema.tentativa.participanteId,
        pitch: schema.tentativa.pitch,
        estado: schema.tentativa.estado,
        tempoMs: schema.tentativa.tempoMs,
        resolvidoEm: schema.tentativa.resolvidoEm,
        operadorId: schema.tentativa.operadorId,
      })

    if (criada === undefined) throw new Error('INSERT de tentativa não devolveu linha.')

    return {
      situacao: 'criada',
      tentativa: { ...criada, pitch: comando.pitch },
    }
  } catch (erro) {
    // Quem decide as duas recusas abaixo é o banco, não uma consulta prévia.
    // Conferir antes com um SELECT abriria janela entre a checagem e a escrita,
    // e dois Operadores incluindo a mesma pessoa ao mesmo tempo é exatamente o
    // cenário que RF-12 admite como normal.
    if (violouUnicidade(erro)) return { situacao: 'ja_existe' }
    if (violouChaveEstrangeira(erro)) return { situacao: 'participante_inexistente' }

    throw erro
  }
}
