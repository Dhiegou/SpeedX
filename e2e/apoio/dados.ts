/**
 * A massa que os testes de ponta a ponta esperam encontrar (T17).
 *
 * **Nomes inventados e distintos de propósito.** O seed de `db/seed.ts` sorteia
 * de uma lista de nomes comuns, com homônimos deliberados — o que é certo para
 * exercitar a busca e errado para um teste que precisa achar **uma** pessoa e
 * lançar o tempo dela. Um teste que busca "Ana" e encontra três é um teste que
 * falha na terça e passa na quarta.
 *
 * O sobrenome comum a todos é o que faz uma busca só trazer a lista inteira, na
 * ordem de inscrição — que é o que RF-19 precisa para cinco lançamentos
 * seguidos sem tirar a mão do teclado.
 */

export const SOBRENOME_DE_ENSAIO = 'Ensaio'

/** Cinco pendentes no Pitch 1, para os cinco lançamentos de RF-19. */
export const CORREDORES_DE_ENSAIO = [
  { nome: 'Alice', idade: 28 },
  { nome: 'Bruno', idade: 34 },
  { nome: 'Carla', idade: 22 },
  { nome: 'Diego', idade: 41 },
  { nome: 'Elisa', idade: 19 },
] as const

/**
 * Uma menor de idade, com Responsável — a linha que prova RNF-09 na
 * Classificação pública: aparece "Marina R.", nunca "Marina Ribeirão".
 */
export const MENOR_DE_ENSAIO = {
  nome: 'Marina',
  sobrenome: 'Ribeirão',
  idade: 15,
  email: 'marina.menor@exemplo.test',
  telefone: '11955550001',
  responsavel: { nome: 'Heloísa', sobrenome: 'Ribeirão', telefone: '11955550002' },
} as const

/**
 * Uma adulta já classificada, com tempo — para a Classificação ter linha certa
 * de conferir, e para o teste de vazamento ter um sobrenome completo que
 * **pode** aparecer, ao lado de um que não pode.
 */
export const ADULTA_CLASSIFICADA = {
  nome: 'Otília',
  sobrenome: 'Vasconcelos',
  idade: 30,
  email: 'otilia@exemplo.test',
  telefone: '11955550003',
  tempoMs: 71_230,
} as const

export const OPERADORA = {
  usuario: 'ensaio',
  nome: 'Operadora de Ensaio',
  /**
   * Senha de um banco descartável, recriado a cada execução e nunca exposto
   * fora da máquina. Está no repositório de propósito: um segredo que precisa
   * ser combinado entre o preparo e o teste, e que não protege nada, é
   * configuração — escondê-lo num arquivo à parte só faria a suíte falhar em
   * máquina nova.
   */
  senha: 'ensaio-de-ponta-a-ponta-2026',
} as const

/** Quantos participantes o seed acrescenta por cima dos nomeados acima. */
export const PARTICIPANTES_DO_SEED = 40
