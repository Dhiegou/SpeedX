import { IDADE_MAIORIDADE, IDADE_MAXIMA, IDADE_MINIMA } from './idades'

/**
 * A ficha de papel da contingência (T20, RNF-06, D-09).
 *
 * **Por que os campos moram aqui e não no gerador.** A ficha impressa e o
 * formulário da tela precisam coletar exatamente a mesma coisa — não por
 * simetria, mas porque a digitação posterior passa pelo **mesmo** caso de uso e
 * pelas mesmas validações (T20 §3, RNF-13). Um campo que existe na tela e falta
 * no papel vira uma pergunta feita ao participante horas depois, por telefone,
 * quando ele já foi embora. Um campo que existe no papel e não na tela é
 * trabalho jogado fora e dado coletado sem finalidade — o oposto do que o termo
 * promete.
 *
 * `tests/contingencia.test.ts` compara esta lista com o que `esquemaInscricao`
 * de fato exige, nos dois sentidos. É o que impede que a próxima mudança no
 * cadastro deixe o papel para trás.
 *
 * O que **não** está aqui é a apresentação: tamanho, ordem visual, quantas
 * fichas por folha. Isso é do gerador (`scripts/gerar-fichas.ts`).
 */

export type CampoDaFicha = {
  /** A mesma chave que o corpo do cadastro usa. É por ela que o teste compara. */
  readonly chave: string
  readonly rotulo: string
  /** Instrução de preenchimento, curta. Vai impressa em cinza sob o campo. */
  readonly ajuda?: string
  /** Quantos quadradinhos de escrita a linha recebe. Só apresentação. */
  readonly largura: 'inteira' | 'metade'
}

/** Os dados de quem vai correr. Mesma ordem da tela (T06). */
export const CAMPOS_DO_PARTICIPANTE: readonly CampoDaFicha[] = [
  { chave: 'nome', rotulo: 'Nome', largura: 'metade' },
  { chave: 'sobrenome', rotulo: 'Sobrenome', largura: 'metade' },
  {
    chave: 'email',
    rotulo: 'E-mail',
    ajuda: 'Em letra de forma. É por aqui que falamos com você depois.',
    largura: 'inteira',
  },
  {
    chave: 'telefone',
    rotulo: 'Telefone com DDD',
    ajuda: 'Exemplo: (11) 98765-4321',
    largura: 'metade',
  },
  {
    chave: 'idade',
    rotulo: 'Idade',
    ajuda: `De ${String(IDADE_MINIMA)} a ${String(IDADE_MAXIMA)} anos. Menos de ${String(IDADE_MAIORIDADE)} exige o bloco do responsável.`,
    largura: 'metade',
  },
]

/**
 * Os dados do Responsável, exigidos de quem tem menos de 18 (RF-05, RNF-07).
 *
 * O bloco vai **na mesma ficha**, e não numa segunda folha: duas folhas se
 * separam, e uma ficha de menor de idade sem o bloco assinado é um cadastro que
 * não pode ser digitado — o caso de uso recusa, e com razão.
 */
export const CAMPOS_DO_RESPONSAVEL: readonly CampoDaFicha[] = [
  { chave: 'responsavel.nome', rotulo: 'Nome do responsável', largura: 'metade' },
  { chave: 'responsavel.sobrenome', rotulo: 'Sobrenome do responsável', largura: 'metade' },
  {
    chave: 'responsavel.telefone',
    rotulo: 'Telefone do responsável',
    ajuda: 'Com DDD. É o contato do dia do evento.',
    largura: 'metade',
  },
]

/**
 * A escolha de Cockpit (RF-03).
 *
 * Não é campo de escrita: são duas caixas para marcar, e ao menos uma precisa
 * estar marcada. Na tela isso é um par de caixas; no papel, o mesmo.
 */
export const CAMPO_COCKPITS = { chave: 'cockpits', rotulo: 'Vou correr em' } as const

/**
 * Toda chave que a ficha coleta, para o teste comparar com o esquema.
 *
 * `consentimento` e `aceiteResponsavel` não entram: no papel eles não são campo,
 * são **assinatura**. A equivalência deles é verificada à parte, contra os
 * aceites do termo.
 */
export const CHAVES_DA_FICHA: readonly string[] = [
  ...CAMPOS_DO_PARTICIPANTE.map((c) => c.chave),
  CAMPO_COCKPITS.chave,
  ...CAMPOS_DO_RESPONSAVEL.map((c) => c.chave),
]
