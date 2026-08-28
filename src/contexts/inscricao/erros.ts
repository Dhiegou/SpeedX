import type { ZodError, core } from 'zod'

/**
 * Erros de validação da Inscrição (RNF-17).
 *
 * O requisito pede mensagem específica por campo, e não um "dados inválidos"
 * único. A forma `{ campo, codigo, mensagem }` separa três leitores diferentes:
 * o formulário de T06 precisa do **campo** para destacar a linha certa, o teste
 * e o suporte precisam do **código** estável, e a pessoa precisa da
 * **mensagem**. Reaproveitar a mensagem como identificador quebraria os testes
 * na primeira vez que alguém melhorasse a redação.
 */

/**
 * Códigos de erro. União fechada de propósito: acrescentar uma regra sem
 * declarar o código aqui não compila, e é assim que a lista continua completa
 * quando T06 for desenhar as mensagens.
 */
export type CodigoErro =
  | 'campo_obrigatorio'
  | 'tipo_invalido'
  | 'nome_formato'
  | 'nome_tamanho'
  | 'email_formato'
  | 'email_tamanho'
  | 'telefone_formato'
  | 'idade_nao_inteira'
  | 'idade_minima'
  | 'idade_maxima'
  | 'cockpit_ausente'
  | 'cockpit_invalido'
  | 'cockpit_repetido'
  | 'consentimento_recusado'
  | 'responsavel_ausente'
  | 'aceite_responsavel_ausente'

export type ErroDeValidacao = {
  /** Caminho do campo, com ponto para aninhamento: `responsavel.telefone`. */
  readonly campo: string
  readonly codigo: CodigoErro
  readonly mensagem: string
}

/**
 * Entrada recusada pelo domínio.
 *
 * Carrega a lista inteira, e não o primeiro erro: quem preenche formulário em
 * celular na fila do evento não deve descobrir os problemas um por vez.
 */
export class InscricaoInvalidaError extends Error {
  readonly erros: readonly ErroDeValidacao[]

  constructor(erros: readonly ErroDeValidacao[]) {
    super(`Inscrição inválida: ${erros.map((e) => e.campo).join(', ')}`)
    this.name = 'InscricaoInvalidaError'
    this.erros = erros
  }
}

/** Erro cujo código a regra declarou explicitamente, via `params.codigo`. */
function codigoDeclarado(issue: core.$ZodIssue): CodigoErro | undefined {
  if (issue.code !== 'custom') return undefined

  const codigo = issue.params?.['codigo']

  return typeof codigo === 'string' ? (codigo as CodigoErro) : undefined
}

/**
 * Segue o caminho do erro dentro da entrada crua.
 *
 * Existe para distinguir "faltou preencher" de "veio no formato errado". A via
 * óbvia seria `issue.input`, mas o Zod só popula esse campo em algumas
 * configurações: confiar nele fazia todo tipo errado ser reportado como campo
 * ausente, e a mensagem chegava errada à pessoa.
 */
function valorNoCaminho(entrada: unknown, caminho: readonly PropertyKey[]): unknown {
  let atual = entrada

  for (const passo of caminho) {
    if (atual === null || typeof atual !== 'object') return undefined
    atual = (atual as Record<PropertyKey, unknown>)[passo]
  }

  return atual
}

/**
 * Converte o erro do Zod na lista estruturada.
 *
 * Quase toda regra do esquema declara o próprio código. O que sobra para o
 * fallback são as falhas de forma, que o Zod detecta antes de qualquer regra
 * nossa rodar: campo ausente e campo de tipo errado.
 *
 * @param entrada a entrada crua, usada só para saber se o campo veio vazio.
 */
export function paraErrosDeValidacao(
  erro: ZodError,
  entrada?: unknown,
): readonly ErroDeValidacao[] {
  return erro.issues.map((issue) => ({
    campo: issue.path.join('.') || '(raiz)',
    codigo:
      codigoDeclarado(issue) ??
      (issue.code === 'invalid_type' && valorNoCaminho(entrada, issue.path) === undefined
        ? 'campo_obrigatorio'
        : 'tipo_invalido'),
    mensagem: issue.message,
  }))
}
