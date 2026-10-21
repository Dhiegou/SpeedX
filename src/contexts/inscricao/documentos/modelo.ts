import type { Bloco } from '../consentimento'

/**
 * Documentos informativos: a política de privacidade e os termos de uso (D-109).
 *
 * **Não são o termo de consentimento, e a diferença é jurídica.** O termo é ato
 * de vontade: versão aprovada, protegida por hash e gravada em cada cadastro.
 * Estes dois informam, e existem independentemente de alguém aceitar. Por isso
 * não têm situação de rascunho, não têm aceite e não bloqueiam cadastro.
 *
 * **Onde houver sobreposição, eles remetem ao termo em vez de reescrevê-lo.** Um
 * texto que repete o termo com outras palavras é um texto que um dia vai dizer
 * outra coisa sobre retenção ou repasse, e o termo é o que vale.
 */

/** Uma frase que termina num link: a remissão ao termo, ou à ANPD. */
export type Remissao = {
  readonly tipo: 'remissao'
  readonly texto: string
  readonly rotulo: string
  readonly href: string
}

export type BlocoDeDocumento = Bloco | Remissao

export type SecaoDeDocumento = {
  readonly id: string
  readonly titulo: string
  readonly blocos: readonly BlocoDeDocumento[]
}

export type DocumentoLegal = {
  readonly versao: string
  /** ISO `AAAA-MM-DD`. */
  readonly publicadoEm: string
  readonly titulo: string
  readonly secoes: readonly SecaoDeDocumento[]
}
