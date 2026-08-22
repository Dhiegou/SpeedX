/**
 * A fronteira de privacidade, em uma função.
 *
 * Este é o único ponto do caminho público que toca um sobrenome (RNF-09).
 * Nenhum outro módulo de Classificação recebe sobrenome completo: a projeção
 * chama esta função e descarta a origem.
 *
 * **A regra tem duas metades desde 2026-08-19** (ver D-21 no `CONTEXT.md`):
 * maior de idade aparece por extenso — "Dhiego Ferreira" —, porque numa lista
 * de 2000 pessoas "Dhiego F." não distingue ninguém de "Dhiego Fernandes";
 * menor de 18 aparece com a inicial — "Lucas M." —, porque nome completo de
 * adolescente ao lado do horário e do local em que ele esteve é exposição de
 * outra natureza.
 */

/**
 * Idade a partir da qual o sobrenome aparece por extenso na página pública.
 *
 * Existe uma constante de mesmo nome e mesmo valor em `inscricao/schema.ts`,
 * onde decide se o cadastro exige Responsável (RNF-07). A duplicação é imposta
 * pela arquitetura: o lint proíbe um contexto de importar o outro, e é essa
 * proibição que sustenta RNF-08. Se um dia a maioridade mudar, os dois
 * arquivos mudam juntos.
 */
export const IDADE_MAIORIDADE = 18

/**
 * A regra de RNF-09, em um lugar só.
 *
 * Recebe idade e devolve decisão. Quem chama é a projeção (T12), que lê a
 * idade do banco e **não** a repassa adiante: o modelo público continua sem o
 * campo, e é isso que mantém RNF-08 como propriedade estrutural em vez de
 * disciplina de código.
 */
export function deveAbreviarSobrenome(idade: number): boolean {
  return idade < IDADE_MAIORIDADE
}

export type OpcoesNomePublico = {
  /**
   * `true` reduz o sobrenome à inicial. Obrigatório de propósito: sem valor
   * padrão, nenhum caller decide por omissão qual dos dois formatos publicar.
   */
  abreviarSobrenome: boolean
}

/**
 * Constrói o Nome Público a partir do nome e do sobrenome completos.
 *
 * Não normaliza caixa do sobrenome por extenso: "da Silva" precisa continuar
 * "da Silva", e title case erraria. O que chega aqui é o que a pessoa digitou,
 * apenas com espaço em excesso removido.
 *
 * @throws se o nome for vazio — um Participante sem nome não deveria existir
 * (RF-02 torna o campo obrigatório), e falhar alto é melhor que publicar "F.".
 */
export function paraNomePublico(
  nome: string,
  sobrenome: string,
  opcoes: OpcoesNomePublico,
): string {
  const primeiro = nome.trim()
  if (primeiro.length === 0) {
    throw new Error('Nome Público exige um nome; recebido vazio.')
  }

  const sobrenomeLimpo = sobrenome.trim().replace(/\s+/g, ' ')
  if (sobrenomeLimpo.length === 0) {
    return primeiro
  }

  if (!opcoes.abreviarSobrenome) {
    return `${primeiro} ${sobrenomeLimpo}`
  }

  // `[...]` e não `[0]`: sobrenome iniciado por caractere fora do BMP quebraria
  // ao meio com índice de unidade de código.
  const inicial = [...sobrenomeLimpo][0]

  return inicial === undefined ? primeiro : `${primeiro} ${inicial.toLocaleUpperCase('pt-BR')}.`
}
