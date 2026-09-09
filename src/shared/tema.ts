import { cookies } from 'next/headers'

/**
 * Tema da interface: claro ou escuro (PRD-front §5.1).
 *
 * **Este arquivo é o único lugar que sabe o nome do cookie de tema**, pelo mesmo
 * motivo que o de sessão tem o seu (`identidade/servico.ts`): nome de cookie
 * espalhado por três arquivos é a garantia de que um deles fica para trás
 * quando o nome muda.
 *
 * **Por que cookie e não `localStorage`.** As páginas públicas navegam por
 * âncora comum, não pelo `Link` do Next — os 4,7 KB do roteador de cliente não
 * cabem no orçamento (RNF-04) —, então toda navegação é recarga completa e
 * estado em memória morreria entre a inscrição e a classificação. `localStorage`
 * resolveria a persistência e criaria dois custos que este projeto não paga:
 * um script bloqueante no `<head>` para aplicar o tema antes da primeira
 * pintura, e o risco de divergência de hidratação por o servidor não saber o
 * que o navegador guardou. O cookie chega junto com a requisição, então o
 * servidor **já pinta no tema certo** e não existe piscada.
 *
 * Tema é preferência de interface, não dado pessoal: não esbarra em RNF-08 nem
 * no que o termo de consentimento promete.
 */

export const TEMAS = ['claro', 'escuro'] as const

export type Tema = (typeof TEMAS)[number]

export const NOME_DO_COOKIE_DE_TEMA = 'speedx_tema'

/**
 * O padrão é o claro **sempre**, e de propósito não é `prefers-color-scheme`.
 *
 * A maioria das pessoas deixa o aparelho no escuro, mas essa preferência foi
 * formada dentro de casa, e este evento é ao ar livre: seguir o sistema
 * operacional entregaria o tema pior por padrão para mais da metade das
 * pessoas, no exato ambiente em que ele é pior. O sistema não sabe onde a
 * pessoa está; nós sabemos. A escolha continua sendo dela, pelo botão do
 * cabeçalho, e a partir daí é respeitada e lembrada.
 */
export const TEMA_PADRAO: Tema = 'claro'

export function ehTema(valor: string | undefined): valor is Tema {
  return valor !== undefined && (TEMAS as readonly string[]).includes(valor)
}

export function alternar(tema: Tema): Tema {
  return tema === 'claro' ? 'escuro' : 'claro'
}

/**
 * O tema desta requisição.
 *
 * Lido no servidor, no layout raiz. Um valor desconhecido no cookie — cookie
 * velho, editado à mão, truncado por proxy — cai no padrão em vez de quebrar a
 * página: preferência de interface não é lugar para erro fatal.
 */
export async function temaDaRequisicao(): Promise<Tema> {
  const valor = (await cookies()).get(NOME_DO_COOKIE_DE_TEMA)?.value

  return ehTema(valor) ? valor : TEMA_PADRAO
}
