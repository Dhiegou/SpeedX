import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import {
  chaveValida,
  consultarEfeito,
  digerir,
  guardarEfeito,
  violouUnicidade,
} from '@/infra/idempotencia'
import { termoEstaAprovado } from './consentimento'
import type { Cockpit } from './contrato'
import { InscricaoInvalidaError, type ErroDeValidacao } from './erros'
import {
  consumirLimite,
  ESCOPO_CADASTRO,
  identificarOrigem,
  politicaCadastro,
  verificarLimite,
} from './limiteDeTaxa'
import { registrarInscricao, validarInscricao } from './registrarInscricao'
import { verificarTokenFormulario } from './tokenFormulario'

/**
 * Caso de uso de borda: recebe um envio de formulário e decide o que acontece
 * com ele (T05).
 *
 * `registrarInscricao` (T04) responde "esta inscrição é válida e foi gravada".
 * Falta tudo o que a rede acrescenta e o domínio não deveria saber: o mesmo
 * envio chegando duas vezes, a origem que já mandou vinte, o robô que preencheu
 * o campo invisível. Nada disso é regra de Inscrição, e nada disso cabe numa
 * rota — a rota traduz para HTTP, não decide.
 *
 * A saída é uma união fechada de situações. A rota mapeia situação para status;
 * acrescentar uma situação sem lhe dar status não compila.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Campo invisível no formulário. Só preenchido por quem não enxerga a tela. */
export const CAMPO_HONEYPOT = 'empresa'

/** Token emitido na renderização do formulário (T06). */
export const CAMPO_TOKEN = 'token'

/** Campos de controle: fora da inscrição e fora da digestão de idempotência. */
const CAMPOS_DE_CONTROLE = new Set<string>([CAMPO_HONEYPOT, CAMPO_TOKEN])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** O que a tela de confirmação mostra (RF-10). Nada além disto sai daqui. */
export type RespostaInscricao = {
  readonly nome: string
  readonly sobrenome: string
  readonly cockpits: readonly Cockpit[]
}

export type ComandoInscricao = {
  /** Corpo cru da requisição. Ainda não é uma Inscrição. */
  readonly corpo: unknown
  /** Cabeçalho `Idempotency-Key`. */
  readonly chave: string | null
  /** Endereço de origem, em claro. Vira HMAC antes de tocar o banco. */
  readonly origem: string | null
  readonly agora?: number
}

export type ResultadoSubmissao =
  | {
      readonly situacao: 'criada'
      readonly corpo: RespostaInscricao
      /** Tempo entre a carga do formulário e o envio, para a métrica do PRD §7. */
      readonly preenchimentoMs: number
    }
  /** Reenvio da mesma chave: devolve a resposta guardada, sem gravar de novo. */
  | { readonly situacao: 'repetida'; readonly corpo: RespostaInscricao }
  /** Honeypot: nada é gravado, e quem enviou não descobre isso. */
  | { readonly situacao: 'descartada'; readonly corpo: RespostaInscricao }
  | { readonly situacao: 'invalida'; readonly erros: readonly ErroDeValidacao[] }
  | { readonly situacao: 'chave_ausente' }
  /** Mesma chave, envio diferente. Não é reenvio: é colisão. */
  | { readonly situacao: 'chave_em_conflito' }
  | { readonly situacao: 'automacao_suspeita'; readonly esperarSegundos: number }
  | { readonly situacao: 'formulario_expirado' }
  | { readonly situacao: 'limite_excedido'; readonly esperarSegundos: number }
  /** Termo vigente virou rascunho: coletar seria coletar sem base legal. */
  | { readonly situacao: 'termo_nao_aprovado' }

function campo(corpo: unknown, nome: string): unknown {
  return corpo !== null && typeof corpo === 'object'
    ? (corpo as Record<string, unknown>)[nome]
    : undefined
}

/**
 * Resposta plausível para quem caiu no honeypot.
 *
 * Um 4xx aqui ensinaria o autor do robô que o campo invisível é a armadilha, e
 * a próxima versão dele passaria. Devolver algo que parece sucesso custa nada e
 * mantém a armadilha útil.
 */
function respostaDeFachada(corpo: unknown): RespostaInscricao {
  const texto = (nome: string): string => {
    const valor = campo(corpo, nome)
    return typeof valor === 'string' ? valor.trim().slice(0, 60) : ''
  }

  const enviados = campo(corpo, 'cockpits')
  const cockpits = Array.isArray(enviados)
    ? enviados.filter((p): p is Cockpit => p === 1 || p === 2)
    : []

  return {
    nome: texto('nome'),
    sobrenome: texto('sobrenome'),
    cockpits: cockpits.length > 0 ? cockpits : [1],
  }
}

/**
 * Campos que ficam **fora** da digestão de idempotência.
 *
 * O token muda a cada carga da página: um reenvio legítimo depois de recarregar
 * traria outro, e se ele entrasse na digestão a retentativa mais comum viraria
 * conflito. O honeypot nunca chega até aqui com conteúdo.
 *
 * O mecanismo em si mora em `@/infra/idempotencia` desde T09, quando
 * Cronometragem passou a precisar dele e não pôde importar Inscrição.
 */
const FORA_DA_DIGESTAO: ReadonlySet<string> = CAMPOS_DE_CONTROLE

export async function submeterInscricao(
  db: Db,
  comando: ComandoInscricao,
): Promise<ResultadoSubmissao> {
  const agora = comando.agora ?? Date.now()

  // Primeiro de tudo: quem caiu na armadilha sai por aqui, sem aprender nada
  // sobre as demais regras — nem sequer que a chave de idempotência existe.
  const isca = campo(comando.corpo, CAMPO_HONEYPOT)
  if (typeof isca === 'string' && isca.trim() !== '') {
    return { situacao: 'descartada', corpo: respostaDeFachada(comando.corpo) }
  }

  const chave = comando.chave
  if (!chaveValida(chave)) return { situacao: 'chave_ausente' }

  const digestao = digerir(comando.corpo, FORA_DA_DIGESTAO)
  const guardado = await consultarEfeito<RespostaInscricao>(db, chave, ESCOPO_CADASTRO, digestao)

  if (guardado.situacao === 'conflito') return { situacao: 'chave_em_conflito' }

  if (guardado.situacao === 'repetida') {
    // A comparação de digestão está dentro de `consultarEfeito`. Sem ela, dois
    // formulários que por acidente compartilhassem a chave fariam o segundo
    // participante receber a confirmação com o **nome do primeiro** —
    // vazamento, não só defeito.
    return { situacao: 'repetida', corpo: guardado.corpo }
  }

  // O token é examinado **depois** do reenvio idempotente: uma retentativa de
  // algo já aceito não deve ser reexaminada por anti-automação.
  const token = verificarTokenFormulario(campo(comando.corpo, CAMPO_TOKEN), agora)

  if (token.veredito === 'expirado') return { situacao: 'formulario_expirado' }
  if (token.veredito !== 'valido') {
    return { situacao: 'automacao_suspeita', esperarSegundos: token.esperarSegundos }
  }

  if (!termoEstaAprovado()) return { situacao: 'termo_nao_aprovado' }

  let inscricao
  try {
    // A mesma validação roda de novo dentro de `registrarInscricao`, e é de
    // propósito: aquela garante a regra para todo caminho de gravação (D-25).
    // Esta existe para responder 422 sem abrir transação.
    inscricao = validarInscricao(comando.corpo)
  } catch (erro) {
    if (erro instanceof InscricaoInvalidaError) {
      return { situacao: 'invalida', erros: erro.erros }
    }

    throw erro
  }

  const identificador = identificarOrigem(comando.origem)
  const veredito = await verificarLimite(db, politicaCadastro(), identificador, agora)

  if (!veredito.permitido) {
    return { situacao: 'limite_excedido', esperarSegundos: veredito.esperarSegundos }
  }

  const resposta: RespostaInscricao = {
    nome: inscricao.nome,
    sobrenome: inscricao.sobrenome,
    cockpits: inscricao.cockpits,
  }

  try {
    await db.transaction(async (tx) => {
      // Cadastro, cota e chave na mesma transação. Se qualquer um falhar, os
      // três somem: é isso que faz o reenvio devolver a resposta original em
      // vez de um segundo Participante (SDD §4.3, FL-03).
      await registrarInscricao(tx, comando.corpo)
      await consumirLimite(tx, ESCOPO_CADASTRO, identificador)
      await guardarEfeito(tx, chave, ESCOPO_CADASTRO, digestao, resposta)
    })
  } catch (erro) {
    if (!violouUnicidade(erro)) throw erro

    // Dois envios da mesma chave ao mesmo tempo: um gravou, o outro esbarrou na
    // chave primária. O que perdeu a corrida devolve o efeito do que ganhou —
    // que é exatamente o que idempotência promete.
    const efeito = await consultarEfeito<RespostaInscricao>(db, chave, ESCOPO_CADASTRO, digestao)

    if (efeito.situacao !== 'repetida') return { situacao: 'chave_em_conflito' }

    return { situacao: 'repetida', corpo: efeito.corpo }
  }

  return { situacao: 'criada', corpo: resposta, preenchimentoMs: token.decorridoMs }
}
