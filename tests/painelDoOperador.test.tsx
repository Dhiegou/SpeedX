// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Painel from '@/../app/painel/(protegido)/Painel'

/**
 * O painel do Operador (T11).
 *
 * O que está sob teste é o que o Operador encontra às sete da manhã com fila na
 * frente: o fluxo inteiro pelo teclado, a confirmação que RF-18 exige, o foco
 * que volta sozinho e o tempo digitado que **não** some quando a rede cai.
 *
 * A rede é a única coisa simulada, e devolve o que a API de T10 devolveria —
 * os testes de T10 já provam que ela devolve isso mesmo.
 */

type Pessoa = { nome: string; sobrenome: string; ultimos4Telefone: string }

const FILA: Pessoa[] = [
  { nome: 'Marina', sobrenome: 'Costa', ultimos4Telefone: '4321' },
  { nome: 'Marina', sobrenome: 'Costa', ultimos4Telefone: '8765' },
  { nome: 'João', sobrenome: 'Assumpção Neto', ultimos4Telefone: '1122' },
  { nome: 'Bruno', sobrenome: 'Souza', ultimos4Telefone: '3344' },
  { nome: 'Ana', sobrenome: 'Lima', ultimos4Telefone: '5566' },
]

const enviados: { url: string; metodo: string; corpo: Record<string, unknown> }[] = []
let respostaDeEscrita: () => Promise<Response> = () => Promise.resolve(resposta({}, 201))

function resposta(corpo: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

function filaDoCockpit(cockpit: number) {
  // O Cockpit 2 tem gente diferente: é como RF-13 se verifica.
  const pessoas =
    cockpit === 1 ? FILA : [{ nome: 'Carla', sobrenome: 'Dias', ultimos4Telefone: '9900' }]

  return {
    cockpit,
    pendentes: pessoas.length,
    truncado: false,
    itens: pessoas.map((p, i) => ({
      tentativaId: `tentativa-${String(cockpit)}-${String(i)}`,
      participanteId: `participante-${String(cockpit)}-${String(i)}`,
      ...p,
      inscritoEm: new Date(2026, 8, 12, 8, i).toISOString(),
    })),
  }
}

beforeEach(() => {
  enviados.length = 0
  respostaDeEscrita = () => Promise.resolve(resposta({}, 201))

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/painel/fila')) {
      const cockpit = Number(new URLSearchParams(url.split('?')[1] ?? '').get('cockpit') ?? '1')
      return Promise.resolve(resposta(filaDoCockpit(cockpit)))
    }

    if (url.startsWith('/api/painel/participante')) {
      return Promise.resolve(resposta({ truncado: false, itens: [] }))
    }

    enviados.push({
      url,
      metodo: init?.method ?? 'GET',
      corpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    })

    return respostaDeEscrita()
  })

  if (globalThis.crypto.randomUUID === undefined) {
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    })
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function montar(): UserEvent {
  const teclado = userEvent.setup()
  render(<Painel operador="Marina Costa" cockpitInicial={1} />)
  return teclado
}

/** Um lançamento inteiro, só pelo teclado. Devolve nada — o efeito é a tela. */
async function lancar(teclado: UserEvent, descidas: number, digitos: string): Promise<void> {
  for (let i = 0; i < descidas; i += 1) await teclado.keyboard('{ArrowDown}')

  await teclado.keyboard('{Enter}')
  await screen.findByLabelText(/^Tempo de/)

  await teclado.keyboard(digitos)
  await teclado.keyboard('{Enter}')

  const dialogo = await screen.findByRole('dialog', { name: /confirmar lançamento/i })
  await within(dialogo).findByRole('button', { name: /confirmar/i })

  await teclado.keyboard('{Enter}')
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /confirmar lançamento/i })).toBeNull()
  })
}

describe('o fluxo por teclado (RF-19, RF-20)', () => {
  it('cinco lançamentos consecutivos sem tocar no mouse', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    // Nenhuma chamada a `click` em todo o teste: só teclado.
    for (let i = 0; i < 5; i += 1) {
      await lancar(teclado, 0, '12345')
    }

    const escritas = enviados.filter((e) => e.url === '/api/painel/tempo')
    expect(escritas).toHaveLength(5)
    expect(escritas.every((e) => e.corpo.tempo === '01:23.45')).toBe(true)
  })

  it('o foco começa na busca e volta para lá depois de gravar (RF-20)', async () => {
    const teclado = montar()
    const busca = await screen.findByLabelText(/Buscar na fila/)

    await waitFor(() => {
      expect(document.activeElement).toBe(busca)
    })

    await lancar(teclado, 0, '12345')

    await waitFor(() => {
      expect(document.activeElement).toBe(busca)
    })
    // RF-20: os campos ficam limpos para o lançamento seguinte.
    expect((busca as HTMLInputElement).value).toBe('')
    expect(screen.queryByLabelText(/^Tempo de/)).toBeNull()
  })

  it('as setas escolhem a pessoa, e é a escolhida que recebe o tempo', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await lancar(teclado, 3, '12345')

    expect(enviados[0]?.corpo.tentativaId).toBe('tentativa-1-3')
  })
})

describe('RF-18 — a confirmação com o nome em destaque', () => {
  it('nada é enviado antes de confirmar', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
    await teclado.keyboard('12345')
    await teclado.keyboard('{Enter}')

    // O diálogo está aberto — e nada saiu para a rede ainda.
    await screen.findByRole('dialog', { name: /confirmar lançamento/i })
    expect(enviados).toHaveLength(0)

    await teclado.keyboard('{Enter}')
    await waitFor(() => {
      expect(enviados).toHaveLength(1)
    })
  })

  it('o diálogo mostra o nome e o tempo antes de gravar', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
    await teclado.keyboard('12345{Enter}')

    const dialogo = await screen.findByRole('dialog', { name: /confirmar lançamento/i })

    expect(within(dialogo).getByText('Marina Costa')).toBeTruthy()
    expect(within(dialogo).getByText('01:23.45')).toBeTruthy()
    expect(within(dialogo).getByText(/4321/)).toBeTruthy()
  })

  it('Esc cancela sem gravar nada', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
    await teclado.keyboard('12345{Enter}')
    await screen.findByRole('dialog', { name: /confirmar lançamento/i })

    await teclado.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /confirmar lançamento/i })).toBeNull()
    })
    expect(enviados).toHaveLength(0)
  })
})

describe('a Fila (RF-13, RF-15)', () => {
  it('dois homônimos são distinguíveis pelo que a lista mostra', async () => {
    montar()

    const itens = await screen.findAllByRole('button', { name: /Marina Costa/ })

    expect(itens).toHaveLength(2)
    // O que os separa são os quatro dígitos — RF-15 existe exatamente para isto.
    expect(itens[0]?.textContent).toContain('4321')
    expect(itens[1]?.textContent).toContain('8765')
  })

  it('Alt+1 e Alt+2 trocam de Cockpit e a lista muda (RF-13)', async () => {
    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Alt>}2{/Alt}')

    await screen.findByRole('button', { name: /Carla Dias/ })
    expect(screen.queryByRole('button', { name: /Bruno Souza/ })).toBeNull()
  })

  it('digitar no campo de busca não troca de Cockpit', async () => {
    // Sem esta guarda, o Operador digitando "12345" no tempo trocaria de aba a
    // cada tecla — e é o número que ele mais digita no dia.
    const teclado = montar()
    const busca = await screen.findByLabelText(/Buscar na fila/)

    await teclado.click(busca)
    await teclado.keyboard('12')
    expect((busca as HTMLInputElement).value).toBe('12')

    expect(screen.queryByRole('button', { name: /Carla Dias/ })).toBeNull()
  })
})

describe('robustez (escopo 4)', () => {
  it('erro de rede não apaga o tempo, e repetir reusa a mesma chave', async () => {
    respostaDeEscrita = () => Promise.reject(new Error('rede caiu'))

    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
    await teclado.keyboard('12345{Enter}')
    await screen.findByRole('dialog', { name: /confirmar lançamento/i })
    await teclado.keyboard('{Enter}')

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('guardado')

    const primeira = enviados[0]
    expect(primeira?.corpo.tempo).toBe('01:23.45')

    // Agora a rede volta.
    respostaDeEscrita = () => Promise.resolve(resposta({}, 201))
    await teclado.click(within(alerta).getByRole('button', { name: /repetir/i }))

    await waitFor(() => {
      expect(enviados).toHaveLength(2)
    })

    // A mesma chave: é o que faz repetir não duplicar (FL-06).
    expect(enviados[1]?.corpo.chave).toBe(primeira?.corpo.chave)
    expect(enviados[1]?.corpo.tempo).toBe('01:23.45')
  })

  it('conflito 409 mostra a mensagem do servidor e não oferece repetir', async () => {
    respostaDeEscrita = () =>
      Promise.resolve(
        resposta(
          { erro: { mensagem: 'Tempo 01:20.00 já registrado por João Lima às 14:32.' } },
          409,
        ),
      )

    const teclado = montar()
    await screen.findByRole('button', { name: /Bruno Souza/ })

    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
    await teclado.keyboard('12345{Enter}')
    await screen.findByRole('dialog', { name: /confirmar lançamento/i })
    await teclado.keyboard('{Enter}')

    const alerta = await screen.findByRole('alert')

    // A mensagem vem pronta de T10, com nome e hora. A tela exibe, não reescreve.
    expect(alerta.textContent).toContain('João Lima')
    expect(alerta.textContent).toContain('14:32')
    // Repetir produziria o mesmo 409; oferecer o botão faria o Operador insistir.
    expect(within(alerta).queryByRole('button', { name: /repetir/i })).toBeNull()
  })
})

describe('o Enter que recusa diz por quê (RNF-16, RNF-17)', () => {
  /**
   * As três recusas de `confirmarTempo` eram `return` nus. O Operador apertava
   * Enter e a tela não mudava em nada — nem diálogo, nem mensagem, nem campo em
   * vermelho —, e a leitura razoável disso, com fila na frente, é que o sistema
   * travou.
   *
   * O que estes testes guardam não é o texto das mensagens: é que **existe**
   * mensagem, que ela nomeia o problema, e que nada foi gravado. Se alguém
   * voltar a recusar em silêncio, eles falham.
   */

  async function abrirCampoDeTempo(teclado: UserEvent): Promise<void> {
    await screen.findByRole('button', { name: /Bruno Souza/ })
    await teclado.keyboard('{Enter}')
    await screen.findByLabelText(/^Tempo de/)
  }

  it('tempo incompleto: diz que faltam números, e não abre a confirmação', async () => {
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    await teclado.keyboard('12{Enter}')

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/incompleto/i)

    expect(screen.queryByRole('dialog', { name: /confirmar lançamento/i })).toBeNull()
    expect(enviados.filter((e) => e.url === '/api/painel/tempo')).toHaveLength(0)
  })

  it('campo vazio: diz o que digitar, com exemplo', async () => {
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    await teclado.keyboard('{Enter}')

    const alerta = await screen.findByRole('alert')
    // O exemplo importa: a máscara preenche da direita para a esquerda, e quem
    // nunca viu isso não adivinha que 12345 vira 01:23.45.
    expect(alerta.textContent).toContain('01:23.45')
    expect(screen.queryByRole('dialog', { name: /confirmar lançamento/i })).toBeNull()
  })

  it('mais de 59 segundos: a recusa aparece com o valor que a máscara mostrou', async () => {
    // A recusa mais importante das três. `mascaraDeTempo.ts` exibe 00:99.99 de
    // propósito, para o Operador ver que errou a digitação — e o Enter recusava
    // exatamente esse valor sem dizer nada. A tela mostrava o erro e escondia o
    // motivo da recusa: as duas metades da mesma informação, separadas.
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    await teclado.keyboard('9999{Enter}')

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('00:99.99')
    expect(alerta.textContent).toMatch(/59 segundos/)

    expect(screen.queryByRole('dialog', { name: /confirmar lançamento/i })).toBeNull()
    expect(enviados.filter((e) => e.url === '/api/painel/tempo')).toHaveLength(0)
  })

  it('a recusa marca o campo como inválido, para quem usa leitor de tela', async () => {
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    const campo = screen.getByLabelText(/^Tempo de/)
    expect(campo.getAttribute('aria-invalid')).toBe('false')

    await teclado.keyboard('12{Enter}')

    await waitFor(() => {
      expect(campo.getAttribute('aria-invalid')).toBe('true')
    })
  })

  it('a recusa some na primeira tecla, e o que já estava digitado continua lá', async () => {
    // Some porque ela falava do valor anterior. E o digitado fica porque apagar
    // o campo a cada recusa obrigaria a redigitar o tempo inteiro — que é o
    // oposto do que RNF-16 pede.
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    await teclado.keyboard('12{Enter}')
    await screen.findByRole('alert')

    await teclado.keyboard('3')

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })
    expect(screen.getByLabelText(/^Tempo de/)).toHaveProperty('value', '00:01.23')
  })

  it('depois de corrigir, o mesmo campo grava normalmente', async () => {
    // A recusa não pode deixar resíduo que impeça o lançamento seguinte.
    const teclado = montar()
    await abrirCampoDeTempo(teclado)

    await teclado.keyboard('9999{Enter}')
    await screen.findByRole('alert')

    await teclado.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}12345{Enter}')

    const dialogo = await screen.findByRole('dialog', { name: /confirmar lançamento/i })
    await within(dialogo).findByRole('button', { name: /confirmar/i })
    await teclado.keyboard('{Enter}')

    await waitFor(() => {
      expect(enviados.filter((e) => e.url === '/api/painel/tempo')).toHaveLength(1)
    })
    expect(enviados.find((e) => e.url === '/api/painel/tempo')?.corpo.tempo).toBe('01:23.45')
  })
})
