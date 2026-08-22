import { describe, expect, it } from 'vitest'
import { deveAbreviarSobrenome, IDADE_MAIORIDADE, paraNomePublico } from './nomePublico'

const ABREVIA = { abreviarSobrenome: true }
const POR_EXTENSO = { abreviarSobrenome: false }

describe('deveAbreviarSobrenome — a regra de RNF-09', () => {
  it('abrevia para menores de 18', () => {
    expect(deveAbreviarSobrenome(13)).toBe(true)
    expect(deveAbreviarSobrenome(17)).toBe(true)
  })

  it('não abrevia a partir dos 18', () => {
    expect(deveAbreviarSobrenome(18)).toBe(false)
    expect(deveAbreviarSobrenome(19)).toBe(false)
    expect(deveAbreviarSobrenome(70)).toBe(false)
  })

  it('a fronteira é a maioridade, não um número solto', () => {
    expect(deveAbreviarSobrenome(IDADE_MAIORIDADE)).toBe(false)
    expect(deveAbreviarSobrenome(IDADE_MAIORIDADE - 1)).toBe(true)
  })
})

describe('paraNomePublico — menor de idade, sobrenome abreviado', () => {
  it('RNF-09 — reduz o sobrenome à inicial', () => {
    expect(paraNomePublico('Dhiego', 'Ferreira', ABREVIA)).toBe('Dhiego F.')
  })

  it('RNF-09 — sobrenome composto também vira uma única inicial', () => {
    expect(paraNomePublico('Ana', 'Ferreira Silva', ABREVIA)).toBe('Ana F.')
    expect(paraNomePublico('João', 'da Silva', ABREVIA)).toBe('João D.')
  })

  it('preserva acento no nome e maiúsculiza a inicial', () => {
    expect(paraNomePublico('Íris', 'ávila', ABREVIA)).toBe('Íris Á.')
  })

  it('nenhum sobrenome completo de menor sobrevive à conversão', () => {
    const sobrenomes = ['Ferreira', 'Albuquerque', 'Nascimento', 'Gonçalves']

    for (const sobrenome of sobrenomes) {
      expect(paraNomePublico('Teste', sobrenome, ABREVIA)).not.toContain(sobrenome)
    }
  })
})

describe('paraNomePublico — maior de idade, sobrenome por extenso', () => {
  it('publica o sobrenome completo', () => {
    expect(paraNomePublico('Dhiego', 'Ferreira', POR_EXTENSO)).toBe('Dhiego Ferreira')
  })

  it('mantém sobrenome composto inteiro — é o que distingue homônimos', () => {
    expect(paraNomePublico('Ana', 'Ferreira Silva', POR_EXTENSO)).toBe('Ana Ferreira Silva')
  })

  it('não altera a caixa do sobrenome: "da Silva" não vira "Da Silva"', () => {
    expect(paraNomePublico('João', 'da Silva', POR_EXTENSO)).toBe('João da Silva')
  })

  it('colapsa espaço interno em excesso', () => {
    expect(paraNomePublico('Ana', 'Ferreira   Silva', POR_EXTENSO)).toBe('Ana Ferreira Silva')
  })
})

describe('paraNomePublico — regras comuns aos dois formatos', () => {
  it('ignora espaço nas bordas', () => {
    expect(paraNomePublico('  Marina  ', '  Costa ', ABREVIA)).toBe('Marina C.')
    expect(paraNomePublico('  Marina  ', '  Costa ', POR_EXTENSO)).toBe('Marina Costa')
  })

  it('aceita participante sem sobrenome registrado', () => {
    expect(paraNomePublico('Madonna', '', ABREVIA)).toBe('Madonna')
    expect(paraNomePublico('Madonna', '', POR_EXTENSO)).toBe('Madonna')
  })

  it('falha alto quando não há nome', () => {
    expect(() => paraNomePublico('   ', 'Ferreira', ABREVIA)).toThrow(/nome/i)
    expect(() => paraNomePublico('   ', 'Ferreira', POR_EXTENSO)).toThrow(/nome/i)
  })
})

describe('a decisão de formato vem da idade, e a idade não vai adiante', () => {
  it('um participante de 17 anos nunca tem o sobrenome publicado', () => {
    const idade = 17
    const publicado = paraNomePublico('Lucas', 'Mendes', {
      abreviarSobrenome: deveAbreviarSobrenome(idade),
    })

    expect(publicado).toBe('Lucas M.')
    expect(publicado).not.toContain('Mendes')
  })

  it('um participante de 18 anos aparece por extenso', () => {
    const idade = 18
    const publicado = paraNomePublico('Lucas', 'Mendes', {
      abreviarSobrenome: deveAbreviarSobrenome(idade),
    })

    expect(publicado).toBe('Lucas Mendes')
  })

  it('o Nome Público não carrega a idade que decidiu o formato', () => {
    // RNF-08: idade não aparece em superfície pública. A projeção lê a idade,
    // decide, e descarta — o que sai daqui é só texto de nome.
    const publicado = paraNomePublico('Lucas', 'Mendes', {
      abreviarSobrenome: deveAbreviarSobrenome(17),
    })

    expect(publicado).not.toMatch(/\d/)
  })
})
