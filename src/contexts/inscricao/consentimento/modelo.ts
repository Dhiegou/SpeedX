/**
 * Forma do Termo de Consentimento (T03, RF-08, RF-09).
 *
 * O termo é dado estruturado, não uma string de HTML. O motivo é operacional:
 * o mesmo texto precisa sair em três lugares — a rota pública `/termo`, o
 * formulário de T06 e a ficha impressa de contingência de T20 (D-09) — e uma
 * string com marcação embutida obriga cada um deles a reinterpretar o texto.
 * Estruturado, cada superfície decide só a apresentação.
 *
 * A estrutura também é o que torna RF-09 verificável por teste: a lista de
 * seções obrigatórias existe como constante, e a ausência de qualquer uma
 * quebra a suíte em vez de passar despercebida numa revisão de texto.
 */

/** Bloco de conteúdo dentro de uma seção. Sem marcação — quem renderiza decide. */
export type Bloco =
  | { readonly tipo: 'paragrafo'; readonly texto: string }
  | { readonly tipo: 'lista'; readonly itens: readonly string[] }

/**
 * Identificadores estáveis das seções exigidas por RF-09.
 *
 * São chaves, não títulos: o título pode ser reescrito para ficar mais claro
 * sem que o teste de cobertura de RF-09 pare de encontrar a seção.
 */
export const SECOES_OBRIGATORIAS = [
  'dados-coletados',
  'finalidade',
  'exposicao-publica',
  'retencao',
  'exclusao',
] as const

export type SecaoObrigatoria = (typeof SECOES_OBRIGATORIAS)[number]

/**
 * Seções adicionais, que o termo pode conter mas RF-09 não exige.
 *
 * `compartilhamento` não é exigida pelo requisito e ainda assim é obrigatória
 * na prática desde 2026-08-19: a partir do momento em que um dado sai da
 * organização do evento, dizer só a finalidade interna esconde o que mais
 * importa para quem lê.
 */
export type SecaoOpcional = 'introducao' | 'compartilhamento' | 'menores' | 'seguranca'

export type SecaoId = SecaoObrigatoria | SecaoOpcional

export type Secao = {
  readonly id: SecaoId
  readonly titulo: string
  /**
   * RF-09 exige que a exposição pública do nome seja declarada **em destaque**.
   * A flag carrega essa exigência até a apresentação; sem ela, o destaque
   * dependeria de alguém lembrar de estilizar a seção certa.
   */
  readonly destaque?: boolean
  readonly blocos: readonly Bloco[]
}

/**
 * Situação da versão.
 *
 * `rascunho` não é rótulo editorial: enquanto o organizador não aprova o texto
 * por escrito (PE-04) e o canal de exclusão não é definido (PE-03), não existe
 * base legal para coletar dado nenhum sob esta versão. Ver `assegurarTermoAprovado`.
 */
export type SituacaoTermo = 'rascunho' | 'aprovado'

export type AceiteId = 'participante' | 'responsavel' | 'compartilhamento'

/**
 * Uma caixa de aceite do formulário.
 *
 * `obrigatorio` é dado, e não convenção, porque a diferença entre as duas
 * caixas é jurídica: sem o aceite do termo não existe cadastro (RF-08), e sem
 * o aceite do repasse existe cadastro normalmente — só não existe repasse.
 * Deixar isso a cargo de quem escrever a UI em T06 é convidar o erro que mais
 * machuca: bloquear o envio numa caixa opcional transforma "opcional" em
 * obrigatório sem que ninguém decida isso.
 */
export type Aceite = {
  readonly id: AceiteId
  /** Texto exibido junto à caixa. Primeira pessoa. */
  readonly texto: string
  /** `false` significa que o cadastro conclui com a caixa desmarcada. */
  readonly obrigatorio: boolean
  /** Quando presente, a caixa só é exibida se a condição valer. */
  readonly aplicaSe?: 'menor-de-18'
}

export type TermoConsentimento = {
  /**
   * Identificador da versão, gravado em `consentimento.versao_termo` a cada
   * cadastro. É o que permite reconstituir, anos depois, o texto exato que a
   * pessoa aceitou — guardar "aceitou" sem guardar "aceitou o quê" não serve
   * de prova.
   */
  readonly versao: string
  readonly situacao: SituacaoTermo
  /** Data de publicação da versão, ISO `AAAA-MM-DD`. */
  readonly publicadoEm: string
  readonly titulo: string
  readonly secoes: readonly Secao[]
  /** As caixas de aceite do formulário, na ordem em que aparecem. */
  readonly aceites: readonly Aceite[]
  /** O que impede esta versão de ser aprovada. Vazio em versão `aprovado`. */
  readonly pendencias: readonly string[]
}
