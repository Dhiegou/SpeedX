// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormularioInscricao from '@/../app/_componentes/FormularioInscricao'
import { LINK_TERMO, TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'

/**
 * O formulário público (T06).
 *
 * O que está sob teste é o comportamento que o participante encontra: o bloco
 * do responsável que aparece e some com a idade, a caixa opcional que não
 * bloqueia, a mensagem que nomeia o campo errado. Nada disso é verificável
 * lendo o servidor, porque nada disso chega ao servidor — é a interface
 * decidindo o que enviar.
 *
 * A rede é a única coisa simulada: `fetch` devolve o que o endpoint de T05
 * devolveria, e os testes de T05 já provam que ele devolve isso mesmo.
 */

const enviado = vi.fn()

/** Resposta do endpoint, na forma que `interpretar` espera. */
function resposta(corpo: unknown, status = 201): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

const SUCESSO = { nome: 'Marina', sobrenome: 'Costa', cockpits: [1] }

beforeEach(() => {
  enviado.mockReset()
  enviado.mockResolvedValue(resposta(SUCESSO))
  vi.stubGlobal('fetch', enviado)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function montar() {
  return render(
    <FormularioInscricao
      token="1787268627139.assinatura"
      aceites={TERMO_VIGENTE.aceites}
      versaoTermo={TERMO_VIGENTE.versao}
      linkTermo={LINK_TERMO}
    />,
  )
}

const ACEITE_PARTICIPANTE = /Li e entendi este termo/
const ACEITE_RESPONSAVEL = /Eu sou o responsável legal/
const ACEITE_REPASSE = /autorizo o repasse do meu telefone/

async function digitar(user: UserEvent, rotulo: RegExp, valor: string): Promise<void> {
  const campo = screen.getByLabelText(rotulo)
  await user.clear(campo)
  await user.type(campo, valor)
}

/** Preenche o mínimo de um adulto válido. */
async function preencherAdulto(user: UserEvent, idade = '30'): Promise<void> {
  await digitar(user, /^Nome$/, 'Marina')
  await digitar(user, /^Sobrenome$/, 'Costa')
  await digitar(user, /E-mail/, 'marina@exemplo.com')
  await digitar(user, /^Telefone com DDD$/, '11987654321')
  await digitar(user, /^Idade$/, idade)
  await user.click(screen.getByRole('checkbox', { name: /Cockpit 1/ }))
  await user.click(screen.getByRole('checkbox', { name: ACEITE_PARTICIPANTE }))
}

function concluir(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole('button', { name: /Concluir inscrição/ }))
}

/** O corpo do último envio, já desserializado. */
function corpoEnviado(chamada = 0): Record<string, unknown> {
  const argumentos = enviado.mock.calls[chamada] as [string, RequestInit] | undefined
  return JSON.parse(String(argumentos?.[1].body)) as Record<string, unknown>
}

function chaveEnviada(chamada = 0): string {
  const argumentos = enviado.mock.calls[chamada] as [string, RequestInit] | undefined
  return (argumentos?.[1].headers as Record<string, string>)['Idempotency-Key'] ?? ''
}

describe('RF-02 — os campos da inscrição', () => {
  it('os seis campos existem, com o teclado certo para o celular', async () => {
    montar()

    // O tipo de teclado é o que compra segundos em RNF-15: quem digita o
    // telefone no teclado alfabético do celular perde tempo trocando de layout.
    expect(screen.getByLabelText(/^Nome$/)).toHaveProperty('autocomplete', 'given-name')
    expect(screen.getByLabelText(/^Sobrenome$/)).toHaveProperty('autocomplete', 'family-name')
    expect(screen.getByLabelText(/E-mail/)).toHaveProperty('type', 'email')
    expect(screen.getByLabelText(/^Telefone com DDD$/)).toHaveProperty('type', 'tel')
    expect(screen.getByLabelText(/^Idade$/)).toHaveProperty('inputMode', 'numeric')

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox', { name: /Cockpit/ })).toHaveLength(2)
    })
  })

  it('mascara o telefone na tela e envia só os dígitos', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    expect(screen.getByLabelText(/^Telefone com DDD$/)).toHaveProperty('value', '(11) 98765-4321')

    await concluir(user)

    await waitFor(() => {
      expect(corpoEnviado()['telefone']).toBe('11987654321')
    })
  })
})

describe('RF-05 e RF-07 — a idade decide qual formulário existe', () => {
  it.each([
    ['13', true],
    ['17', true],
    ['18', false],
    ['19', false],
  ])('idade %s exibe o bloco do responsável: %s', async (idade, deveAparecer) => {
    const user = userEvent.setup()
    montar()

    await digitar(user, /^Idade$/, idade)

    const bloco = screen.queryByLabelText(/Nome do responsável/)
    expect(bloco === null).toBe(!deveAparecer)
  })

  it('idade abaixo de 13 explica o motivo sem apagar o que já foi preenchido', async () => {
    const user = userEvent.setup()
    montar()

    await digitar(user, /^Nome$/, 'Marina')
    await digitar(user, /^Idade$/, '12')

    expect(screen.getByText(/permitida a partir de 13 anos/)).toBeDefined()
    // O aviso não é motivo para descartar o preenchimento: a pessoa pode ter
    // errado o número, e reescrever tudo é o que faz alguém desistir.
    expect(screen.getByLabelText(/^Nome$/)).toHaveProperty('value', 'Marina')
    // A exigência de responsável não aparece junto: as duas mensagens juntas
    // sugerem que preencher o responsável resolveria, e não resolve.
    expect(screen.queryByLabelText(/Nome do responsável/)).toBeNull()
  })

  it('RF-07 — subir a idade para 18 apaga o responsável do envio, não só da tela', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user, '15')
    await digitar(user, /Nome do responsável/, 'Ana')
    await digitar(user, /Sobrenome do responsável/, 'Mendes')
    await digitar(user, /Telefone do responsável/, '11912345678')
    await user.click(screen.getByRole('checkbox', { name: ACEITE_RESPONSAVEL }))

    await digitar(user, /^Idade$/, '18')
    await concluir(user)

    await waitFor(() => {
      expect(enviado).toHaveBeenCalled()
    })

    const corpo = corpoEnviado()
    expect(corpo['idade']).toBe(18)
    expect(corpo['responsavel']).toBeUndefined()
    expect(corpo['aceiteResponsavel']).toBeUndefined()
  })

  it('menor de idade envia o bloco do responsável completo', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user, '15')
    await digitar(user, /Nome do responsável/, 'Ana')
    await digitar(user, /Sobrenome do responsável/, 'Mendes')
    await digitar(user, /Telefone do responsável/, '11912345678')
    await user.click(screen.getByRole('checkbox', { name: ACEITE_RESPONSAVEL }))

    await concluir(user)

    await waitFor(() => {
      expect(enviado).toHaveBeenCalled()
    })

    expect(corpoEnviado()['responsavel']).toEqual({
      nome: 'Ana',
      sobrenome: 'Mendes',
      telefone: '11912345678',
    })
    expect(corpoEnviado()['aceiteResponsavel']).toBe(true)
  })
})

describe('RF-03 — escolha de Cockpit', () => {
  it('sem Cockpit o envio é bloqueado, com mensagem própria', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await user.click(screen.getByRole('checkbox', { name: /Cockpit 1/ }))

    await concluir(user)

    // Duas vezes: no resumo do topo e junto do campo. Quem rolou até o fim do
    // formulário não vê o topo, e quem só olha o topo não sabe onde corrigir.
    expect(await screen.findAllByText(/Escolha pelo menos um Cockpit/)).toHaveLength(2)
    expect(enviado).not.toHaveBeenCalled()
  })

  it('com os dois Cockpits marcados, os dois são enviados', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await user.click(screen.getByRole('checkbox', { name: /Cockpit 2/ }))

    await concluir(user)

    await waitFor(() => {
      expect(corpoEnviado()['cockpits']).toEqual([1, 2])
    })
  })
})

describe('RF-08 e D-23 — os dois consentimentos não são a mesma coisa', () => {
  it('sem o aceite do termo, o envio é bloqueado', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await user.click(screen.getByRole('checkbox', { name: ACEITE_PARTICIPANTE }))

    await concluir(user)

    expect((await screen.findAllByText(/aceitar o termo de consentimento/)).length).toBeGreaterThan(
      0,
    )
    expect(enviado).not.toHaveBeenCalled()
  })

  it('D-23 — com a caixa de repasse desmarcada, o cadastro conclui', async () => {
    // Este é o teste que impede o opcional de virar obrigatório. Sem ele, um
    // `required` copiado da caixa de cima passa despercebido até o dia do evento.
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await concluir(user)

    await waitFor(() => {
      expect(enviado).toHaveBeenCalled()
    })

    expect(corpoEnviado()['aceiteCompartilhamento']).toBe(false)
    expect(await screen.findByText(/Inscrição concluída/)).toBeDefined()
  })

  it('a caixa opcional é marcável e vai marcada quando a pessoa quer', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await user.click(screen.getByRole('checkbox', { name: ACEITE_REPASSE }))
    await concluir(user)

    await waitFor(() => {
      expect(corpoEnviado()['aceiteCompartilhamento']).toBe(true)
    })
  })

  it('a caixa opcional se anuncia como opcional', async () => {
    montar()

    const opcional = screen.getByRole('checkbox', { name: ACEITE_REPASSE })

    expect(opcional).toHaveProperty('required', false)
    expect(screen.getByRole('checkbox', { name: ACEITE_PARTICIPANTE })).toHaveProperty(
      'required',
      true,
    )
    expect(screen.getByText(/pode deixar desmarcado/)).toBeDefined()
  })
})

describe('RNF-17 — cada regra com a sua mensagem', () => {
  it('erros diferentes produzem mensagens diferentes, e o foco vai para o primeiro', async () => {
    const user = userEvent.setup()
    montar()

    await digitar(user, /^Nome$/, 'Marina')
    await digitar(user, /E-mail/, 'sem-arroba')
    await digitar(user, /^Telefone com DDD$/, '119')
    await digitar(user, /^Idade$/, '30')
    await user.click(screen.getByRole('checkbox', { name: /Cockpit 1/ }))
    await user.click(screen.getByRole('checkbox', { name: ACEITE_PARTICIPANTE }))

    await concluir(user)

    expect((await screen.findAllByText(/Confira se tem "@"/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/DDD e 8 ou 9 dígitos/).length).toBeGreaterThan(0)
    expect(enviado).not.toHaveBeenCalled()

    // Sem mover o foco, quem está no fim de um formulário longo recebe um
    // aviso que não vê e não sabe para onde rolar.
    expect(document.activeElement).toBe(screen.getByLabelText(/^Sobrenome$/))
  })

  it('erro de campo do responsável aponta o campo do responsável', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user, '15')
    await digitar(user, /Nome do responsável/, 'Ana')
    await digitar(user, /Sobrenome do responsável/, 'Mendes')
    await digitar(user, /Telefone do responsável/, '119')
    await user.click(screen.getByRole('checkbox', { name: ACEITE_RESPONSAVEL }))

    await concluir(user)

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/Telefone do responsável/))
    })
    expect(enviado).not.toHaveBeenCalled()
  })

  it('mapeia o 422 do servidor de volta para o campo', async () => {
    // A validação local pode divergir da do servidor um dia; quando divergir, a
    // pessoa precisa ver o erro no campo, não um "algo deu errado".
    const user = userEvent.setup()
    enviado.mockResolvedValue(
      resposta(
        { erros: [{ campo: 'email', codigo: 'email_formato', mensagem: 'E-mail já cadastrado.' }] },
        422,
      ),
    )
    montar()

    await preencherAdulto(user)
    await concluir(user)

    expect((await screen.findAllByText('E-mail já cadastrado.')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/E-mail/).getAttribute('aria-invalid')).toBe('true')
  })
})

describe('FL-03 — falha de rede não vira cadastro duplicado', () => {
  it('a nova tentativa reusa a mesma chave de idempotência', async () => {
    const user = userEvent.setup()
    enviado.mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValue(resposta(SUCESSO))
    montar()

    await preencherAdulto(user)
    await concluir(user)

    expect(await screen.findByText(/A conexão falhou/)).toBeDefined()

    await concluir(user)

    await waitFor(() => {
      expect(enviado).toHaveBeenCalledTimes(2)
    })

    // Mesma chave: se o primeiro pedido chegou e só a resposta se perdeu, o
    // servidor devolve a confirmação original em vez de criar outro cadastro.
    expect(chaveEnviada(1)).toBe(chaveEnviada(0))
    expect(chaveEnviada(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/i)
  })

  it('editar um campo entre as tentativas gera chave nova', async () => {
    // Conteúdo diferente com a mesma chave é conflito no servidor (D-28), e com
    // razão: já não é reenvio, é outro cadastro.
    const user = userEvent.setup()
    enviado.mockRejectedValue(new Error('rede caiu'))
    montar()

    await preencherAdulto(user)
    await concluir(user)
    await screen.findByText(/A conexão falhou/)

    await digitar(user, /^Sobrenome$/, 'Souza')
    await concluir(user)

    await waitFor(() => {
      expect(enviado).toHaveBeenCalledTimes(2)
    })

    expect(chaveEnviada(1)).not.toBe(chaveEnviada(0))
  })
})

describe('RF-10 — confirmação', () => {
  it('mostra o nome registrado e os Cockpits escolhidos', async () => {
    const user = userEvent.setup()
    enviado.mockResolvedValue(resposta({ nome: 'Marina', sobrenome: 'Costa', cockpits: [1, 2] }))
    montar()

    await preencherAdulto(user)
    await concluir(user)

    expect(await screen.findByText(/Inscrição concluída/)).toBeDefined()
    expect(screen.getByText('Marina Costa')).toBeDefined()
    expect(screen.getByText('Cockpit 1 e Cockpit 2')).toBeDefined()
    expect(screen.getByRole('link', { name: /classificação/i })).toHaveProperty(
      'href',
      expect.stringContaining('/classificacao'),
    )
  })
})

describe('RNF-12 e T03 — armadilha e termo', () => {
  it('o honeypot existe, fora do alcance de quem usa a tela', async () => {
    montar()

    const isca = document.querySelector<HTMLInputElement>('input[name="empresa"]')

    expect(isca).not.toBeNull()
    expect(isca?.type).not.toBe('hidden')
    expect(isca?.tabIndex).toBe(-1)
    expect(isca?.closest('[aria-hidden="true"]')).not.toBeNull()

    await waitFor(() => {
      // Invisível para leitor de tela: não aparece em nenhuma consulta por
      // rótulo acessível, que é como um participante encontraria o campo.
      expect(screen.queryByRole('textbox', { name: /Empresa/ })).toBeNull()
    })
  })

  it('o honeypot vai vazio no envio de quem preenche pela tela', async () => {
    const user = userEvent.setup()
    montar()

    await preencherAdulto(user)
    await concluir(user)

    await waitFor(() => {
      expect(corpoEnviado()['empresa']).toBe('')
    })
  })

  it('o termo abre em outra aba, para não apagar o preenchimento', async () => {
    montar()

    const link = screen.getByRole('link', { name: /Ler o termo completo/ })

    expect(link).toHaveProperty('target', '_blank')
    expect(link).toHaveProperty('rel', 'noopener noreferrer')
  })

  it('a exposição pública do nome é declarada antes do aceite (RF-09)', () => {
    montar()

    // Aparece no destaque acima das caixas e dentro do texto do próprio
    // aceite. RF-09 pede a declaração em destaque; as duas ocorrências são o
    // destaque e o texto que a pessoa marca.
    expect(screen.getAllByText(/página pública de classificação/).length).toBeGreaterThan(1)
  })
})
