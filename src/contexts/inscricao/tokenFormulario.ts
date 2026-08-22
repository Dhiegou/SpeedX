import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/shared/env'

/**
 * Token de formulário: prova de que o envio veio de uma página carregada por
 * este servidor, e há quanto tempo (RNF-12).
 *
 * A alternativa óbvia — o cliente mandar quantos segundos levou preenchendo —
 * pergunta ao suspeito se ele é culpado. Qualquer script escreve `4000` no
 * campo. Aqui o instante é **emitido e assinado pelo servidor** na renderização
 * do formulário (T06) e devolvido intacto no envio: para mentir sobre o tempo é
 * preciso forjar o HMAC.
 *
 * O que isto **não** é: não é sessão, não é CSRF, não é uso único. É um carimbo
 * de hora que o cliente não consegue alterar. Um atacante que carregue a página
 * uma vez e reaproveite o token por horas passa por aqui — e é aceitável, porque
 * a barreira que ele venceu custa um pedido de página, enquanto um CAPTCHA
 * custaria segundos de **cada** participante (T05, decisão sobre CAPTCHA).
 */

/**
 * Validade do token. Não é o prazo de paciência de quem preenche: é o teto de
 * quanto tempo um token capturado continua servindo. Cobre a jornada inteira do
 * evento com folga, para que ninguém receba "recarregue a página" na fila.
 */
const VALIDADE_MS = 6 * 60 * 60 * 1000

/**
 * Tolerância para o instante vir do futuro.
 *
 * Emissão e verificação podem cair em instâncias diferentes, com relógios
 * separados por alguns segundos. Sem folga, um envio legítimo viraria
 * "adulterado" por causa de NTP.
 */
const TOLERANCIA_FUTURO_MS = 60_000

const SEPARADOR = '.'

/**
 * Chave própria, derivada do segredo da aplicação.
 *
 * `SESSION_SECRET` assina a sessão do Operador (BC-04). Usar o mesmo material
 * bruto para as duas coisas faz com que um token de formulário e um cookie de
 * sessão sejam produzidos pela mesma chave — separá-los por rótulo custa uma
 * linha e evita que uma fraqueza em um vire fraqueza no outro.
 */
function chave(): Buffer {
  return createHmac('sha256', env().SESSION_SECRET).update('token-formulario/v1').digest()
}

function assinar(emitidoEm: number): string {
  return createHmac('sha256', chave()).update(String(emitidoEm)).digest('base64url')
}

/** Emitido pelo servidor ao renderizar o formulário (T06). */
export function emitirTokenFormulario(agora: number = Date.now()): string {
  return `${String(agora)}${SEPARADOR}${assinar(agora)}`
}

export type VereditoToken =
  /** Veio, confere e o preenchimento levou tempo de gente. */
  | 'valido'
  /** Não veio nenhum token: nem passou pelo formulário. */
  | 'ausente'
  /** Formato quebrado, assinatura errada ou instante no futuro. */
  | 'adulterado'
  /** Página aberta há tempo demais. Recarregar resolve. */
  | 'expirado'
  /** Enviado rápido demais para ter sido digitado. */
  | 'rapido_demais'

export type ExameDoToken = {
  readonly veredito: VereditoToken
  /** Quantos segundos faltam, quando esperar resolve. Zero nos demais casos. */
  readonly esperarSegundos: number
  /**
   * Quanto tempo passou entre a página carregar e o envio chegar.
   *
   * Sai daqui de graça, porque o instante de emissão já está no token e é
   * assinado. É a métrica de "tempo mediano de preenchimento" do PRD §7 sem
   * nenhum evento de telemetria saindo do navegador (T06 §8, T16). Zero quando
   * o token não confere, porque aí o número não significa nada.
   */
  readonly decorridoMs: number
}

/** Comparação em tempo constante, tolerante a tamanhos diferentes. */
function iguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}

export function verificarTokenFormulario(token: unknown, agora: number = Date.now()): ExameDoToken {
  const nada = { esperarSegundos: 0, decorridoMs: 0 } as const

  if (typeof token !== 'string' || token.length === 0) {
    return { veredito: 'ausente', ...nada }
  }

  const corte = token.indexOf(SEPARADOR)
  if (corte <= 0) return { veredito: 'adulterado', ...nada }

  const emitidoEmTexto = token.slice(0, corte)
  const assinatura = token.slice(corte + 1)
  const emitidoEm = Number(emitidoEmTexto)

  if (!Number.isSafeInteger(emitidoEm) || emitidoEm <= 0) {
    return { veredito: 'adulterado', ...nada }
  }

  // A assinatura é conferida antes do relógio: enquanto ela não bate, o
  // instante é um número escolhido por quem enviou e não merece interpretação.
  if (!iguais(assinatura, assinar(emitidoEm))) {
    return { veredito: 'adulterado', ...nada }
  }

  const decorrido = agora - emitidoEm

  if (decorrido < -TOLERANCIA_FUTURO_MS) return { veredito: 'adulterado', ...nada }
  if (decorrido > VALIDADE_MS) return { veredito: 'expirado', ...nada }

  const minimoMs = env().FORMULARIO_SEGUNDOS_MINIMOS * 1000

  if (decorrido < minimoMs) {
    return {
      veredito: 'rapido_demais',
      esperarSegundos: Math.max(1, Math.ceil((minimoMs - decorrido) / 1000)),
      decorridoMs: decorrido,
    }
  }

  return { veredito: 'valido', esperarSegundos: 0, decorridoMs: decorrido }
}
