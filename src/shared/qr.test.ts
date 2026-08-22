import { describe, expect, it } from 'vitest'
import {
  larguraMinimaMm,
  MODULO_MINIMO_MM,
  MODULOS_DE_SILENCIO,
  moduloMm,
  modulosDoSvg,
  recomendar,
} from './qr'

/**
 * A especificação de impressão do QR (T07).
 *
 * O que estes testes protegem não é a matemática, que é uma divisão: é o
 * número que vai para a gráfica. Um QR impresso pequeno demais não falha na
 * hora — falha no dia do evento, com fila no ponto de inscrição, e não há
 * segunda impressão.
 */

describe('larguraMinimaMm', () => {
  it('lê a 50 cm exige 50 mm de símbolo', () => {
    // A razão de 10:1 vem de quem criou o formato. Ler a 50 cm com um QR de
    // 30 mm é o erro que faz a pessoa aproximar o celular até acertar.
    expect(larguraMinimaMm(50)).toBe(50)
  })

  it('cresce junto com a distância', () => {
    expect(larguraMinimaMm(100)).toBe(100)
    expect(larguraMinimaMm(200)).toBe(200)
  })

  it('recusa distância que não é distância', () => {
    expect(() => larguraMinimaMm(0)).toThrow(/positivo/)
    expect(() => larguraMinimaMm(-50)).toThrow(/positivo/)
    expect(() => larguraMinimaMm(Number.NaN)).toThrow(/positivo/)
  })
})

describe('moduloMm', () => {
  it('desconta a área de silêncio da largura', () => {
    // O erro clássico é dividir a largura pelos módulos de dado e esquecer os
    // quatro de margem de cada lado — o módulo real sai menor do que a conta.
    const modulos = 33
    const largura = 50

    expect(moduloMm(largura, modulos)).toBeCloseTo(largura / (33 + 8), 5)
    expect(moduloMm(largura, modulos)).toBeLessThan(largura / modulos)
  })

  it('recusa um QR sem módulos', () => {
    expect(() => moduloMm(50, 0)).toThrow(/ao menos um módulo/)
  })
})

describe('recomendar', () => {
  it('o cartaz do ponto de inscrição, a 50 cm, é imprimível', () => {
    const r = recomendar(50, 33)

    expect(r.larguraMm).toBe(50)
    expect(r.moduloMm).toBeGreaterThan(MODULO_MINIMO_MM)
    expect(r.imprimivel).toBe(true)
  })

  it('avisa quando o módulo fica pequeno demais para o papel', () => {
    // Uma URL longa empurra o QR para uma versão com mais módulos, e o mesmo
    // papel passa a ter módulos menores. É por isso que a URL do QR não leva
    // parâmetro de rastreamento (FL-01): cada caractere custa legibilidade.
    const r = recomendar(20, 77)

    expect(r.imprimivel).toBe(false)
  })
})

describe('modulosDoSvg', () => {
  it('conta os módulos de dado, sem a área de silêncio', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41 41"></svg>'

    expect(modulosDoSvg(svg)).toBe(41 - MODULOS_DE_SILENCIO * 2)
  })

  it('falha alto se o SVG mudar de forma', () => {
    // Se o gerador parar de escrever o viewBox, é melhor quebrar do que
    // devolver um número que alguém levaria para a gráfica.
    expect(() => modulosDoSvg('<svg></svg>')).toThrow(/viewBox/)
  })
})
