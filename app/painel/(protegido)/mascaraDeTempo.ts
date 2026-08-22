/**
 * Máscara do campo de tempo (T11, escopo 2).
 *
 * O Operador digita `12345` e vê `01:23.45`. Sem dois-pontos, sem ponto, sem
 * tirar a mão do teclado numérico — porque a T11 dá quinze segundos para um
 * lançamento inteiro (RNF-16) e cada tecla de pontuação é um dedo procurando
 * uma posição que não está no caminho.
 *
 * **Os dígitos entram pela direita**, como num relógio de forno: o primeiro
 * dígito é o centésimo mais à direita, e os anteriores empurram para a
 * esquerda. É como toda máscara de tempo e de dinheiro funciona, e é o que
 * permite corrigir um erro com um único backspace.
 *
 * Isto é entrada, não conversão. A conversão canônica continua sendo
 * `parseTempo` de `shared/tempo.ts`, e o que sai daqui é feito para ser aceito
 * por ela — inclusive quando está errado, para que a recusa venha de um lugar
 * só (T02: duas implementações de arredondamento produzem duas classificações).
 */

/** Sete dígitos cobrem `999:59.99`, o teto que `parseTempo` aceita. */
const MAXIMO_DE_DIGITOS = 7

/** Só dígito entra. O resto some — inclusive o que o teclado do tablet insere. */
export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, MAXIMO_DE_DIGITOS)
}

/**
 * Dígitos acumulados → `mm:ss.cc`.
 *
 * Devolve vazio para entrada vazia, e não `00:00.00`: um campo que se preenche
 * sozinho ao ganhar foco faz o Operador achar que já digitou.
 *
 * **Não corrige valor implausível.** `9999` vira `00:99.99`, que `parseTempo`
 * recusa — e é exatamente o que deve acontecer: ver `00:99.99` na tela diz ao
 * Operador que ele errou a digitação, enquanto um clamp silencioso para
 * `00:59.99` gravaria um tempo que o cronômetro nunca mediu.
 */
export function formatarDigitacao(digitos: string): string {
  const limpo = apenasDigitos(digitos)

  if (limpo === '') return ''

  const preenchido = limpo.padStart(6, '0')
  const centesimos = preenchido.slice(-2)
  const segundos = preenchido.slice(-4, -2)
  const minutos = preenchido.slice(0, -4)

  return `${minutos}:${segundos}.${centesimos}`
}

/**
 * O que o Operador **quis** digitar, lido do valor do campo.
 *
 * O campo exibe o texto já formatado, então o que chega no `onChange` traz os
 * zeros que a própria máscara colocou. Extrair só os dígitos de `00:00.01` e
 * guardar devolve `000001`, e a tecla seguinte empurra tudo para a esquerda:
 * digitar `1`, `2`, `3` produzia `000:00.12` em vez de `00:01.23`.
 *
 * Descartar os zeros à esquerda desfaz o preenchimento da máscara e devolve a
 * sequência que a pessoa de fato teclou. Um campo com todos os dígitos zerados
 * vira vazio, que é o certo: apagar tudo tem de limpar o campo.
 */
export function digitosDoCampo(valor: string): string {
  return apenasDigitos(valor).replace(/^0+/, '')
}

/**
 * O texto exibido cabe em `parseTempo`?
 *
 * Não reimplementa a validação — só evita abrir a tela de confirmação com um
 * valor que o servidor vai recusar, o que custaria dois Enter e a paciência de
 * quem está com fila na frente. A recusa de verdade continua sendo do servidor
 * (restrição 2 do anexo do PRD).
 */
export function pareceCompleto(digitos: string): boolean {
  return apenasDigitos(digitos).length >= 3
}
