import { describe, expect, it } from 'vitest'
import type { CodigoErro } from './erros'
import { InscricaoInvalidaError } from './erros'
import { validarInscricao } from './registrarInscricao'
import { IDADE_MAIORIDADE, IDADE_MINIMA } from './schema'

/**
 * A regra de Inscrição, sem banco e sem HTTP.
 *
 * O foco é a fronteira que o SDD chama de dominante: a idade decide qual objeto
 * existe. Por isso as idades 12, 13, 17, 18 e 19 aparecem explicitamente, e não
 * "um menor e um adulto".
 */

const RESPONSAVEL = {
  nome: 'Ana',
  sobrenome: 'Mendes',
  telefone: '11987654321',
}

function entrada(sobrescrever: Record<string, unknown> = {}) {
  return {
    nome: 'Marina',
    sobrenome: 'Costa',
    email: 'marina@exemplo.com',
    telefone: '11987654321',
    idade: 30,
    cockpits: [1],
    consentimento: true,
    ...sobrescrever,
  }
}

/** Códigos de erro de uma entrada recusada. Falha se ela for aceita. */
function codigos(dados: unknown): readonly CodigoErro[] {
  try {
    validarInscricao(dados)
  } catch (erro) {
    if (erro instanceof InscricaoInvalidaError) {
      return erro.erros.map((e) => e.codigo)
    }
    throw erro
  }

  throw new Error('Esperava recusa da validação, mas a entrada foi aceita.')
}

/** Erros por campo, para verificar que a mensagem chega no lugar certo (RNF-17). */
function campos(dados: unknown): readonly string[] {
  try {
    validarInscricao(dados)
  } catch (erro) {
    if (erro instanceof InscricaoInvalidaError) {
      return erro.erros.map((e) => e.campo)
    }
    throw erro
  }

  throw new Error('Esperava recusa da validação, mas a entrada foi aceita.')
}

describe('RF-04 — idade mínima', () => {
  it('recusa 12 anos, com código e mensagem próprios', () => {
    try {
      validarInscricao(entrada({ idade: 12 }))
      throw new Error('deveria ter recusado')
    } catch (erro) {
      expect(erro).toBeInstanceOf(InscricaoInvalidaError)
      const [primeiro] = (erro as InscricaoInvalidaError).erros

      expect(primeiro?.campo).toBe('idade')
      expect(primeiro?.codigo).toBe('idade_minima')
      // A mensagem precisa explicar, não só recusar.
      expect(primeiro?.mensagem).toContain('13')
    }
  })

  it('aceita exatamente a idade mínima', () => {
    const inscricao = validarInscricao(
      entrada({ idade: IDADE_MINIMA, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    expect(inscricao.idade).toBe(IDADE_MINIMA)
  })

  it('recusa idade não inteira e idade implausível', () => {
    expect(codigos(entrada({ idade: 17.5 }))).toContain('idade_nao_inteira')
    expect(codigos(entrada({ idade: 130 }))).toContain('idade_maxima')
  })
})

describe('a idade decide o ramo, não o cliente', () => {
  it.each([13, 17])('idade %i produz uma inscrição de menor', (idade) => {
    const inscricao = validarInscricao(
      entrada({ idade, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    expect(inscricao.tipo).toBe('menor')
    if (inscricao.tipo !== 'menor') throw new Error('ramo inesperado')
    expect(inscricao.responsavel.nome).toBe('Ana')
  })

  it.each([18, 19])('idade %i produz uma inscrição de adulto', (idade) => {
    expect(validarInscricao(entrada({ idade })).tipo).toBe('adulto')
  })

  it('RF-07 — bloco de responsável enviado por maior de idade é descartado', () => {
    // O cenário real: a pessoa preenche como menor, corrige a idade para 18 e
    // envia. Os campos antigos ainda viajam na requisição.
    const inscricao = validarInscricao(
      entrada({ idade: IDADE_MAIORIDADE, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    expect(inscricao.tipo).toBe('adulto')
    expect(JSON.stringify(inscricao)).not.toContain('Mendes')
    expect(Object.keys(inscricao)).not.toContain('responsavel')
  })

  it('um "tipo" enviado pelo cliente não muda nada', () => {
    // O discriminador nasce da idade. Se viesse pela rede, quem decide se um
    // adolescente precisa de responsável seria quem envia a requisição.
    const inscricao = validarInscricao(
      entrada({ idade: 15, tipo: 'adulto', responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    expect(inscricao.tipo).toBe('menor')
  })

  it('idade abaixo do mínimo não cobra dados de responsável', () => {
    // Quem tem 12 anos não se inscreve de jeito nenhum (RF-04). Pedir o
    // responsável junto sugeriria que preencher resolveria o problema.
    const problemas = campos(entrada({ idade: 12 }))

    expect(problemas).toEqual(['idade'])
  })
})

describe('RF-06 e RNF-07 — menor exige responsável completo', () => {
  it('recusa menor sem bloco de responsável', () => {
    expect(codigos(entrada({ idade: 15, aceiteResponsavel: true }))).toContain(
      'responsavel_ausente',
    )
  })

  it('recusa menor sem a autorização do responsável', () => {
    expect(codigos(entrada({ idade: 15, responsavel: RESPONSAVEL }))).toContain(
      'aceite_responsavel_ausente',
    )
  })

  it.each(['nome', 'sobrenome', 'telefone'])(
    'recusa menor com responsável sem %s, apontando o campo aninhado',
    (faltando) => {
      const parcial: Record<string, unknown> = { ...RESPONSAVEL }
      delete parcial[faltando]

      const dados = entrada({ idade: 15, responsavel: parcial, aceiteResponsavel: true })

      expect(campos(dados)).toContain(`responsavel.${faltando}`)
      expect(codigos(dados)).toContain('campo_obrigatorio')
    },
  )

  it('recusa menor com telefone de responsável malformado', () => {
    const dados = entrada({
      idade: 15,
      responsavel: { ...RESPONSAVEL, telefone: '1234' },
      aceiteResponsavel: true,
    })

    expect(campos(dados)).toContain('responsavel.telefone')
    expect(codigos(dados)).toContain('telefone_formato')
  })
})

describe('RF-03 — Cockpits declarados', () => {
  it('recusa lista vazia', () => {
    expect(codigos(entrada({ cockpits: [] }))).toContain('cockpit_ausente')
  })

  it('aceita um Cockpit e aceita os dois', () => {
    expect(validarInscricao(entrada({ cockpits: [1] })).cockpits).toEqual([1])
    expect(validarInscricao(entrada({ cockpits: [1, 2] })).cockpits).toEqual([1, 2])
  })

  it('recusa Cockpit inexistente e recusa repetição', () => {
    expect(codigos(entrada({ cockpits: [3] }))).toContain('cockpit_invalido')
    expect(codigos(entrada({ cockpits: [1, 1] }))).toContain('cockpit_repetido')
  })
})

describe('RF-08 e D-23 — os dois consentimentos', () => {
  it('recusa envio sem aceite do termo', () => {
    expect(codigos(entrada({ consentimento: false }))).toContain('consentimento_recusado')
  })

  it('recusa envio sem o campo de consentimento', () => {
    const dados = entrada()
    delete (dados as Record<string, unknown>)['consentimento']

    expect(codigos(dados)).toContain('campo_obrigatorio')
  })

  it('aceita o repasse recusado, e a recusa sobrevive à validação', () => {
    // O oposto do teste acima, e o que impede o opcional de virar obrigatório.
    const inscricao = validarInscricao(entrada({ aceiteCompartilhamento: false }))

    expect(inscricao.aceiteCompartilhamento).toBe(false)
  })

  it('repasse ausente equivale a recusa, nunca a autorização', () => {
    expect(validarInscricao(entrada()).aceiteCompartilhamento).toBe(false)
  })

  it('aceita o repasse autorizado', () => {
    expect(validarInscricao(entrada({ aceiteCompartilhamento: true })).aceiteCompartilhamento).toBe(
      true,
    )
  })
})

describe('RF-02 — campos obrigatórios e normalização', () => {
  it.each(['nome', 'sobrenome', 'email', 'telefone', 'idade', 'cockpits'])(
    'recusa entrada sem %s',
    (campo) => {
      const dados = entrada()
      delete (dados as Record<string, unknown>)[campo]

      expect(campos(dados)).toContain(campo)
      expect(codigos(dados)).toContain('campo_obrigatorio')
    },
  )

  it('normaliza e-mail para minúsculas e remove espaço nas bordas', () => {
    expect(validarInscricao(entrada({ email: '  Marina@Exemplo.COM ' })).email).toBe(
      'marina@exemplo.com',
    )
  })

  it('remove a máscara do telefone antes de gravar', () => {
    expect(validarInscricao(entrada({ telefone: '(11) 98765-4321' })).telefone).toBe('11987654321')
  })

  it('aceita telefone fixo de dez dígitos', () => {
    expect(validarInscricao(entrada({ telefone: '1133334444' })).telefone).toBe('1133334444')
  })

  it('recusa telefone curto demais', () => {
    expect(codigos(entrada({ telefone: '119876' }))).toContain('telefone_formato')
  })

  it('remove espaço em excesso no nome', () => {
    expect(validarInscricao(entrada({ nome: '  Marina  ' })).nome).toBe('Marina')
  })

  it('aceita nome com acento, hífen e apóstrofo', () => {
    for (const nome of ['João', "D'Ávila", 'Ana-Clara']) {
      expect(validarInscricao(entrada({ nome })).nome).toBe(nome)
    }
  })

  it('recusa nome com dígito e nome curto demais', () => {
    expect(codigos(entrada({ nome: 'Ana2' }))).toContain('nome_formato')
    expect(codigos(entrada({ nome: 'A' }))).toContain('nome_tamanho')
  })

  it('recusa e-mail malformado', () => {
    expect(codigos(entrada({ email: 'marina.exemplo.com' }))).toContain('email_formato')
  })
})

describe('RNF-17 — o erro diz qual campo e o que houve', () => {
  it('reporta todos os problemas de uma vez, não o primeiro', () => {
    const problemas = campos(entrada({ nome: 'A1', email: 'x', idade: 12, cockpits: [] }))

    expect(new Set(problemas)).toEqual(new Set(['nome', 'email', 'idade', 'cockpits']))
  })

  it('todo erro traz campo, código e mensagem preenchidos', () => {
    try {
      validarInscricao({})
      throw new Error('deveria ter recusado')
    } catch (erro) {
      if (!(erro instanceof InscricaoInvalidaError)) throw erro

      expect(erro.erros.length).toBeGreaterThan(0)
      for (const item of erro.erros) {
        expect(item.campo).not.toBe('')
        expect(item.codigo).not.toBe('')
        expect(item.mensagem.length).toBeGreaterThan(0)
      }
    }
  })

  it('distingue campo ausente de campo com tipo errado', () => {
    expect(codigos(entrada({ idade: 'trinta' }))).toContain('tipo_invalido')

    const semIdade = entrada()
    delete (semIdade as Record<string, unknown>)['idade']
    expect(codigos(semIdade)).toContain('campo_obrigatorio')
  })
})
