import { describe, expect, it } from 'vitest'
import { emitirTokenFormulario, verificarTokenFormulario } from './tokenFormulario'

/**
 * O token de formulário (T05, RNF-12).
 *
 * O teste que mais importa é o de adulteração: o valor do token é um instante
 * legível: `1787266453274.xxxx`. Se a assinatura não fosse conferida, bastaria
 * a qualquer pessoa trocar o número por outro e o carimbo de hora viraria um
 * campo controlado por quem envia — o mesmo problema que o token existe para
 * resolver.
 */

const AGORA = 1_787_266_453_274

describe('verificarTokenFormulario', () => {
  it('aceita token emitido pelo servidor há tempo de gente preencher', () => {
    const token = emitirTokenFormulario(AGORA - 30_000)

    expect(verificarTokenFormulario(token, AGORA).veredito).toBe('valido')
  })

  it('RNF-12 — recusa envio rápido demais e diz quantos segundos faltam', () => {
    const exame = verificarTokenFormulario(emitirTokenFormulario(AGORA - 500), AGORA)

    expect(exame.veredito).toBe('rapido_demais')
    expect(exame.esperarSegundos).toBeGreaterThan(0)
    expect(exame.esperarSegundos).toBeLessThanOrEqual(3)
  })

  it('RNF-12 — instante trocado sem refazer a assinatura é adulteração', () => {
    // O ataque óbvio: pegar um token novo e recuar o instante para escapar do
    // tempo mínimo. Sem esta verificação, a barreira inteira seria decorativa.
    const token = emitirTokenFormulario(AGORA)
    const assinatura = token.slice(token.indexOf('.') + 1)

    const forjado = `${String(AGORA - 60_000)}.${assinatura}`

    expect(verificarTokenFormulario(forjado, AGORA).veredito).toBe('adulterado')
  })

  it('recusa assinatura trocada, token sem separador e token vazio', () => {
    const token = emitirTokenFormulario(AGORA - 30_000)
    const instante = token.slice(0, token.indexOf('.'))

    expect(verificarTokenFormulario(`${instante}.naoEhAAssinatura`, AGORA).veredito).toBe(
      'adulterado',
    )
    expect(verificarTokenFormulario('semseparador', AGORA).veredito).toBe('adulterado')
    expect(verificarTokenFormulario(`.${token}`, AGORA).veredito).toBe('adulterado')
  })

  it('distingue token ausente de token inválido', () => {
    // T06 precisa da diferença: sem token é página velha ou requisição forjada;
    // com token quebrado é outra coisa. Colapsar os dois esconde o defeito.
    expect(verificarTokenFormulario(undefined, AGORA).veredito).toBe('ausente')
    expect(verificarTokenFormulario('', AGORA).veredito).toBe('ausente')
    expect(verificarTokenFormulario(42, AGORA).veredito).toBe('ausente')
  })

  it('expira token velho, e a mensagem disso é "recarregue", não "você é robô"', () => {
    const seteHoras = 7 * 60 * 60 * 1000

    expect(verificarTokenFormulario(emitirTokenFormulario(AGORA - seteHoras), AGORA).veredito).toBe(
      'expirado',
    )
  })

  it('tolera relógios dessincronizados por poucos segundos', () => {
    // Emissão e verificação podem cair em instâncias diferentes. Sem folga,
    // NTP transformaria envio legítimo em "adulterado".
    const emitidoNoFuturo = emitirTokenFormulario(AGORA + 5_000)

    expect(verificarTokenFormulario(emitidoNoFuturo, AGORA).veredito).not.toBe('adulterado')
  })

  it('recusa token do futuro distante', () => {
    expect(
      verificarTokenFormulario(emitirTokenFormulario(AGORA + 86_400_000), AGORA).veredito,
    ).toBe('adulterado')
  })

  it('emite tokens distintos para instantes distintos', () => {
    expect(emitirTokenFormulario(AGORA)).not.toBe(emitirTokenFormulario(AGORA + 1))
  })
})
