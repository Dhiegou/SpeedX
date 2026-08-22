import { describe, expect, it } from 'vitest'
import { formatTempo, parseTempo, TempoInvalidoError, TEMPO_MAXIMO_MS } from './tempo'

describe('parseTempo', () => {
  it('RF-17 — 1 minuto, 23 segundos e 45 centésimos', () => {
    expect(parseTempo('01:23.45')).toBe(83_450)
  })

  it('aceita minuto com um dígito', () => {
    expect(parseTempo('1:23.45')).toBe(83_450)
  })

  it('ignora espaço em volta', () => {
    expect(parseTempo('  01:23.45  ')).toBe(83_450)
  })

  it('recusa centésimo com um dígito só — 4 ou 40 seria adivinhação', () => {
    expect(() => parseTempo('1:23.4')).toThrow(TempoInvalidoError)
  })

  it('recusa segundo igual ou acima de 60', () => {
    expect(() => parseTempo('01:60.00')).toThrow(TempoInvalidoError)
    expect(() => parseTempo('01:99.00')).toThrow(TempoInvalidoError)
  })

  it('recusa formatos que não são tempo', () => {
    for (const entrada of ['', 'abc', '123', '1:2:3', '01,23.45', '-01:23.45', '01:23']) {
      expect(() => parseTempo(entrada)).toThrow(TempoInvalidoError)
    }
  })

  it('recusa zero — não é resultado de corrida', () => {
    expect(() => parseTempo('00:00.00')).toThrow(TempoInvalidoError)
  })

  it('recusa tempo acima do limite plausível', () => {
    expect(() => parseTempo('100:00.00')).toThrow(TempoInvalidoError)
    expect(parseTempo('99:59.99')).toBe(TEMPO_MAXIMO_MS)
  })

  it('a mensagem de erro mostra o formato esperado (RNF-17)', () => {
    expect(() => parseTempo('abc')).toThrow(/mm:ss\.cc/)
  })
})

describe('formatTempo', () => {
  it('RF-17 — reexibe o tempo idêntico ao digitado', () => {
    expect(formatTempo(83_450)).toBe('01:23.45')
  })

  it('preenche com zero à esquerda', () => {
    expect(formatTempo(1_000)).toBe('00:01.00')
    expect(formatTempo(10)).toBe('00:00.01')
  })

  it('trunca o milissegundo em vez de arredondar', () => {
    // 83.459 s foi medido como 45 centésimos; arredondar criaria um centésimo
    // que o cronômetro nunca viu — e é o centésimo que decide o desempate.
    expect(formatTempo(83_459)).toBe('01:23.45')
  })

  it('recusa entrada que não é inteiro de milissegundos', () => {
    expect(() => formatTempo(83_450.5)).toThrow(TempoInvalidoError)
    expect(() => formatTempo(-1)).toThrow(TempoInvalidoError)
  })
})

describe('ida e volta', () => {
  it('RF-17 — texto -> ms -> texto preserva o valor', () => {
    const casos = ['00:00.01', '00:59.99', '01:23.45', '09:07.03', '59:59.99', '99:59.99']

    for (const caso of casos) {
      expect(formatTempo(parseTempo(caso))).toBe(caso)
    }
  })

  it('ms -> texto -> ms preserva o valor em toda a faixa', () => {
    for (let ms = 10; ms <= TEMPO_MAXIMO_MS; ms += 7_919) {
      expect(parseTempo(formatTempo(ms))).toBe(Math.floor(ms / 10) * 10)
    }
  })
})
