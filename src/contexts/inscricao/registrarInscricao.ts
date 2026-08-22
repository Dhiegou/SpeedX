import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { assegurarTermoAprovado, TERMO_VIGENTE } from './consentimento'
import type { Pitch } from './contrato'
import { InscricaoInvalidaError, paraErrosDeValidacao } from './erros'
import { esquemaInscricao, type Inscricao } from './schema'

/**
 * Caso de uso: registrar uma Inscrição (RF-01 a RF-10).
 *
 * Domínio puro no que importa: não sabe o que é HTTP, não lê `request`, não
 * devolve status. T05 embrulha isto num endpoint; o teste chama direto.
 *
 * A operação inteira é uma transação porque as invariantes de BC-01 atravessam
 * quatro tabelas: Participante sem Consentimento não pode existir (RF-08), e
 * menor sem Responsável também não (RNF-07). Gravar em quatro passos sem
 * transação cria exatamente esses estados sempre que algo falhar no meio.
 */

/** Aceita qualquer driver Postgres do Drizzle: `pg` em produção, PGlite nos testes. */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** O que a tela de confirmação precisa mostrar (RF-10). */
export type InscricaoRegistrada = {
  readonly participanteId: string
  readonly nome: string
  readonly sobrenome: string
  readonly pitches: readonly Pitch[]
  readonly versaoTermo: string
}

/**
 * Valida a entrada crua e devolve a Inscrição.
 *
 * Separado do registro porque T05 precisa validar sem gravar (resposta de erro
 * antes de tocar o banco) e porque o teste da regra não deveria exigir banco.
 *
 * @throws {InscricaoInvalidaError} com a lista completa de problemas.
 */
export function validarInscricao(entrada: unknown): Inscricao {
  const resultado = esquemaInscricao.safeParse(entrada)

  if (!resultado.success) {
    throw new InscricaoInvalidaError(paraErrosDeValidacao(resultado.error, entrada))
  }

  return resultado.data
}

/**
 * Grava a Inscrição.
 *
 * O guard do termo roda **aqui**, e não só no endpoint de T05: qualquer caminho
 * que chegue a gravar consentimento passa por esta função, e é o único ponto
 * onde a garantia não depende de quem chamou.
 *
 * @throws {InscricaoInvalidaError} se a entrada for inválida.
 * @throws {Error} se o termo vigente não estiver aprovado.
 */
export async function registrarInscricao(db: Db, entrada: unknown): Promise<InscricaoRegistrada> {
  assegurarTermoAprovado()

  const inscricao = validarInscricao(entrada)

  return db.transaction(async (tx) => {
    const [participante] = await tx
      .insert(schema.participante)
      .values({
        nome: inscricao.nome,
        sobrenome: inscricao.sobrenome,
        email: inscricao.email,
        telefone: inscricao.telefone,
        idade: inscricao.idade,
      })
      .returning({ id: schema.participante.id })

    if (participante === undefined) {
      throw new Error('Inserção do Participante não retornou identificador.')
    }

    if (inscricao.tipo === 'menor') {
      await tx.insert(schema.responsavel).values({
        participanteId: participante.id,
        nome: inscricao.responsavel.nome,
        sobrenome: inscricao.responsavel.sobrenome,
        telefone: inscricao.responsavel.telefone,
      })
    }

    await tx.insert(schema.consentimento).values({
      participanteId: participante.id,
      // A versão vigente, e não uma constante literal: é ela que permite
      // reconstituir anos depois o texto exato que esta pessoa aceitou.
      versaoTermo: TERMO_VIGENTE.versao,
      aceiteParticipante: true,
      // `null` para maior de idade. O tipo `adulto` não carrega aceite de
      // responsável porque, para ele, o conceito não existe.
      aceiteResponsavel: inscricao.tipo === 'menor' ? true : null,
      aceiteCompartilhamento: inscricao.aceiteCompartilhamento,
    })

    // A Tentativa nasce Pendente na Inscrição (SDD BC-02), uma por Pitch
    // declarado. `inscrito_em` vem do relógio do servidor, pelo default da
    // tabela: nunca do dispositivo de quem se inscreveu.
    await tx
      .insert(schema.tentativa)
      .values(inscricao.pitches.map((pitch) => ({ participanteId: participante.id, pitch })))

    return {
      participanteId: participante.id,
      nome: inscricao.nome,
      sobrenome: inscricao.sobrenome,
      pitches: inscricao.pitches,
      versaoTermo: TERMO_VIGENTE.versao,
    }
  })
}
