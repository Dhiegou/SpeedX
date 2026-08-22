/**
 * Especificação de impressão do QR code (T07).
 *
 * A regra que governa tudo aqui vem da Denso Wave, que criou o formato: um QR
 * é legível até cerca de **dez vezes** a largura do símbolo. Ler a 50 cm exige,
 * portanto, no mínimo 50 mm de lado — e "no mínimo" é literal: abaixo disso a
 * câmera do celular não resolve os módulos e a pessoa começa a se aproximar,
 * afastar e girar o aparelho, que é exatamente a fila que o PRD §7 lista como
 * contraindicador.
 *
 * Estas funções são puras e testadas. O cálculo mora aqui, e não no script que
 * gera a imagem, porque quem vai conferir o material impresso precisa poder
 * verificar o número sem executar nada.
 */

/** Proporção máxima entre distância de leitura e largura do símbolo. */
export const RAZAO_DISTANCIA_TAMANHO = 10

/**
 * Área de silêncio exigida pela norma: quatro módulos de margem branca em volta.
 *
 * É a parte que mais se perde na diagramação — alguém encosta o QR na borda do
 * cartaz ou põe texto colado nele, e o leitor deixa de encontrar o símbolo.
 */
export const MODULOS_DE_SILENCIO = 4

/** Largura mínima do símbolo, em milímetros, para a distância de leitura dada. */
export function larguraMinimaMm(distanciaCm: number): number {
  if (!Number.isFinite(distanciaCm) || distanciaCm <= 0) {
    throw new Error('Distância de leitura precisa ser um número positivo de centímetros.')
  }

  return (distanciaCm * 10) / RAZAO_DISTANCIA_TAMANHO
}

/**
 * Tamanho de cada módulo (o quadradinho) na impressão.
 *
 * Serve para conferir o material contra a resolução da gráfica: módulo abaixo
 * de ~0,5 mm começa a borrar em impressão comum, por melhor que esteja o resto.
 */
export function moduloMm(larguraMm: number, modulos: number): number {
  if (modulos <= 0) throw new Error('Um QR tem ao menos um módulo por lado.')

  return larguraMm / (modulos + MODULOS_DE_SILENCIO * 2)
}

/** Recomendação de impressão para uma distância de leitura. */
export type Recomendacao = {
  readonly distanciaCm: number
  readonly larguraMm: number
  readonly moduloMm: number
  /** `false` quando o módulo fica pequeno demais para impressão comum. */
  readonly imprimivel: boolean
}

/** Módulo abaixo disto borra em impressão comum de escritório. */
export const MODULO_MINIMO_MM = 0.5

export function recomendar(distanciaCm: number, modulos: number): Recomendacao {
  const larguraMm = larguraMinimaMm(distanciaCm)
  const modulo = moduloMm(larguraMm, modulos)

  return {
    distanciaCm,
    larguraMm,
    moduloMm: modulo,
    imprimivel: modulo >= MODULO_MINIMO_MM,
  }
}

/**
 * Conta os módulos por lado a partir do SVG gerado.
 *
 * O gerador escreve o número no `viewBox`, já incluindo a área de silêncio.
 * Ler dali evita manter em dois lugares um valor que muda com o tamanho da URL:
 * um domínio mais longo empurra o QR para uma versão maior, com mais módulos e
 * módulos menores no mesmo papel.
 */
export function modulosDoSvg(svg: string): number {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)

  if (viewBox === null) throw new Error('SVG sem viewBox: não dá para contar os módulos.')

  const lado = Number(viewBox[1])

  return lado - MODULOS_DE_SILENCIO * 2
}
