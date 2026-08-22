import type { Aceite, AceiteId, TermoConsentimento } from './modelo'
import { TERMO_V1_0 } from './v1-0'

/**
 * Termo de consentimento — fachada do módulo (T03, RF-08, RF-09).
 *
 * O que sai daqui é dado puro: nenhuma dependência de Node, nenhuma de React.
 * O texto precisa atravessar servidor, navegador (T06) e impressão (T20) sem
 * que ninguém decida o que fazer com ele antes da apresentação.
 *
 * `integridade.ts` fica deliberadamente de fora desta fachada: importa
 * `node:crypto` e arrastaria isso para o bundle do formulário.
 */

export type {
  Aceite,
  AceiteId,
  Bloco,
  Secao,
  SecaoId,
  SecaoObrigatoria,
  SituacaoTermo,
  TermoConsentimento,
} from './modelo'
export { SECOES_OBRIGATORIAS } from './modelo'
export { TERMO_V1_0 } from './v1-0'

/**
 * Todas as versões já publicadas, indexadas pelo identificador gravado em
 * `consentimento.versao_termo`.
 *
 * Versão **aprovada** nunca sai daqui, nem depois de superada: um cadastro de
 * hoje pode ser auditado depois que a versão vigente já mudou duas vezes, e a
 * auditoria precisa reconstituir o texto exato.
 *
 * Rascunho superado é o único caso que sai. Sob rascunho o guard recusa
 * registrar consentimento, então nenhum `consentimento.versao_termo` pode
 * apontar para ele — mantê-lo aqui sugeriria uma prova que não existe. O
 * histórico dele é assunto do git.
 */
export const TERMOS_PUBLICADOS: Readonly<Record<string, TermoConsentimento>> = {
  [TERMO_V1_0.versao]: TERMO_V1_0,
}

/**
 * Versão vigente — a que T04 grava em `consentimento.versao_termo` a cada
 * cadastro, e a que `/termo` publica.
 */
export const TERMO_VIGENTE: TermoConsentimento = TERMO_V1_0

/** Rota pública com o texto integral (T03, item 5 do escopo). */
export const ROTA_TERMO = '/termo'

/**
 * Atributos do link para o termo, a partir do formulário de cadastro.
 *
 * `target="_blank"` não é preferência estética: o critério de aceitação da T03
 * exige que abrir o termo e voltar **não apague o que já foi preenchido**.
 * Navegação na mesma aba desmonta o formulário, e o participante que está na
 * fila do evento reescreve tudo. Abrir em aba nova é o único jeito de não
 * depender de rascunho salvo em armazenamento local — que, num formulário com
 * e-mail, telefone e idade de menor, seria dado pessoal deixado no aparelho.
 *
 * `rel` acompanha por segurança: sem `noopener`, a aba aberta ganha referência
 * à janela do formulário.
 *
 * Constante, e não trecho de JSX solto em T06, para que o teste consiga
 * verificar a exigência sem precisar renderizar o formulário.
 */
export const LINK_TERMO = {
  href: ROTA_TERMO,
  target: '_blank',
  rel: 'noopener noreferrer',
} as const

/**
 * Os aceites que **impedem** a conclusão do cadastro se ficarem desmarcados.
 *
 * T05 valida contra esta lista, e T06 desenha o formulário a partir dela. Se a
 * regra vivesse na UI, um aceite opcional viraria bloqueante no dia em que
 * alguém copiasse o `required` da caixa de cima.
 */
export function aceitesObrigatorios(termo: TermoConsentimento = TERMO_VIGENTE): readonly Aceite[] {
  return termo.aceites.filter((aceite) => aceite.obrigatorio)
}

/** Um aceite pelo identificador. `undefined` se a versão vigente não o tiver. */
export function aceitePorId(
  id: AceiteId,
  termo: TermoConsentimento = TERMO_VIGENTE,
): Aceite | undefined {
  return termo.aceites.find((aceite) => aceite.id === id)
}

/** Uma versão só serve de base legal depois de aprovada e sem pendências. */
export function termoEstaAprovado(termo: TermoConsentimento = TERMO_VIGENTE): boolean {
  return termo.situacao === 'aprovado' && termo.pendencias.length === 0
}

/**
 * Barra a coleta de dados sob uma versão que ainda é rascunho.
 *
 * Chamado por T05 antes de aceitar um cadastro em produção. A alternativa
 * — confiar em alguém lembrar de aprovar o texto antes do evento — falha
 * silenciosamente e do pior jeito possível: com dado de menor de idade já
 * coletado sob um termo que ninguém validou.
 *
 * Em desenvolvimento e em teste o cadastro roda normalmente; o que não pode é
 * um ambiente com participante real gravar consentimento contra rascunho.
 *
 * @throws se o termo não estiver aprovado, listando o que falta.
 */
export function assegurarTermoAprovado(termo: TermoConsentimento = TERMO_VIGENTE): void {
  if (termoEstaAprovado(termo)) return

  const pendencias =
    termo.pendencias.length > 0
      ? termo.pendencias.map((p) => `\n  - ${p}`).join('')
      : '\n  - situação da versão ainda é "rascunho".'

  throw new Error(
    `O termo ${termo.versao} não está aprovado; nenhum consentimento pode ser registrado sob ele.${pendencias}`,
  )
}
