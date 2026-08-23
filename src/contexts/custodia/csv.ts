/**
 * Geração de CSV para planilha (T14).
 *
 * O destino deste arquivo é o Excel do organizador, em português. Três decisões
 * vêm disso, e nenhuma é preferência de formato:
 *
 * **1. Separador `;`.** O Excel em configuração pt-BR usa a vírgula como
 * separador decimal e espera `;` entre colunas. Um CSV com vírgula abre com
 * tudo numa coluna só, e a reação natural é achar que a exportação está
 * quebrada.
 *
 * **2. BOM UTF-8.** Sem ele, o Excel no Windows lê o arquivo como ANSI e
 * "Assumpção" vira "AssumpÃ§Ã£o". O BOM custa três bytes e é o que faz um
 * arquivo com 34% de nomes acentuados abrir legível.
 *
 * **3. Proteção contra fórmula.** Ver `escapar`.
 */

const SEPARADOR = ';'
/** O Excel exige CRLF para reconhecer a quebra dentro de campo entre aspas. */
const FIM_DE_LINHA = '\r\n'

/**
 * Marca de ordem de bytes, escrita como escape.
 *
 * É um caractere invisível: como literal cru, ele sobrevive mal a cópia entre
 * editores e some sem deixar sinal — e o sintoma seria "Assumpção" abrindo como
 * "AssumpÃ§Ã£o" na planilha do organizador, meses depois, sem ninguém saber por
 * quê.
 */
export const BOM = '\uFEFF'

/**
 * Caracteres que fazem o Excel tratar o campo como fórmula.
 *
 * Um Participante digita o próprio nome no formulário público, e o campo aceita
 * qualquer texto. Se alguém se cadastrar como `=1+1` — ou como algo bem menos
 * inocente —, o Excel do organizador **executa** aquilo ao abrir o arquivo.
 * Isso se chama injeção de fórmula em CSV, e o caminho está todo aberto neste
 * sistema: entrada pública, sem autenticação, que sai num arquivo aberto por
 * alguém de confiança numa máquina de trabalho.
 *
 * A T14 não pede isso. Pedir seria supor que quem escreveu a task conhecia o
 * ataque; não tratar seria supor que ninguém vai tentar.
 */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/

/**
 * Escapa um valor para uma célula.
 *
 * Duas camadas. A primeira é o CSV: campo com separador, aspas ou quebra de
 * linha vai entre aspas, e aspas internas dobram. A segunda é o Excel: um campo
 * que **começa** com `=`, `+`, `-` ou `@` recebe um apóstrofo na frente, que o
 * Excel consome ao exibir e que impede a interpretação como fórmula.
 *
 * O apóstrofo aparece se o arquivo for lido como texto puro. É o preço, e é
 * barato: um telefone que comece com `+55` sai como `'+55` num editor de texto
 * e como `+55` na planilha, que é onde ele vai ser lido.
 */
export function escapar(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''

  const texto = String(valor)

  const seguro = INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto

  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

/** Uma linha do arquivo, já escapada. */
export function linha(valores: readonly (string | number | null | undefined)[]): string {
  return valores.map(escapar).join(SEPARADOR) + FIM_DE_LINHA
}

/**
 * Nome de arquivo com data, para o organizador não acabar com quatro
 * `exportacao.csv` na pasta de downloads sem saber qual é qual.
 */
export function nomeDoArquivo(prefixo: string, agora: Date = new Date()): string {
  const dd = (n: number) => String(n).padStart(2, '0')

  const data = `${String(agora.getFullYear())}-${dd(agora.getMonth() + 1)}-${dd(agora.getDate())}`
  const hora = `${dd(agora.getHours())}${dd(agora.getMinutes())}`

  return `${prefixo}-${data}-${hora}.csv`
}
