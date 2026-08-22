import { describe, expect, it } from 'vitest'
import {
  apenasDigitos,
  digitosDoCampo,
  formatarDigitacao,
  pareceCompleto,
} from '@/../app/painel/(protegido)/mascaraDeTempo'
import {
  focoDe,
  INICIAL,
  nomeCompleto,
  reduzir,
  type Alvo,
  type Estado,
  type Evento,
} from '@/../app/painel/(protegido)/fluxo'
import { parseTempo } from '@/shared/tempo'

/**
 * A lógica do painel, sem DOM (T11).
 *
 * O critério de aceitação de RF-18 pede que se verifique **por leitura do
 * código** que não existe caminho de gravação fora da etapa de confirmação.
 * Leitura humana confere o código de hoje; este arquivo confere o de depois que
 * alguém acrescentar um atalho de teclado com pressa.
 */

const ALVO: Alvo = {
  tentativaId: '11111111-1111-4111-8111-111111111111',
  participanteId: '22222222-2222-4222-8222-222222222222',
  nome: 'Marina',
  sobrenome: 'Costa',
  ultimos4Telefone: '4321',
}

const CHAVE = '33333333-3333-4333-8333-333333333333'

/** Um representante de cada etapa, para percorrer o redutor por inteiro. */
const ESTADOS: Estado[] = [
  { etapa: 'lista' },
  { etapa: 'tempo', alvo: ALVO, corrigindo: false, tempoAnterior: null },
  { etapa: 'tempo', alvo: ALVO, corrigindo: true, tempoAnterior: '01:23.45' },
  {
    etapa: 'confirmar',
    comando: {
      tipo: 'registrar',
      alvo: ALVO,
      tempoMs: 83_450,
      tempoTexto: '01:23.45',
      chave: CHAVE,
    },
  },
  {
    etapa: 'gravando',
    comando: {
      tipo: 'registrar',
      alvo: ALVO,
      tempoMs: 83_450,
      tempoTexto: '01:23.45',
      chave: CHAVE,
    },
  },
  {
    etapa: 'falhou',
    comando: {
      tipo: 'registrar',
      alvo: ALVO,
      tempoMs: 83_450,
      tempoTexto: '01:23.45',
      chave: CHAVE,
    },
    mensagem: 'rede',
    podeRepetir: true,
  },
]

const EVENTOS: Evento[] = [
  { tipo: 'selecionar', alvo: ALVO },
  { tipo: 'selecionarParaCorrigir', alvo: ALVO, tempoAnterior: '01:23.45' },
  { tipo: 'pedirAusencia', alvo: ALVO, chave: CHAVE },
  { tipo: 'informarTempo', tempoMs: 83_450, tempoTexto: '01:23.45', chave: CHAVE },
  { tipo: 'confirmar' },
  { tipo: 'sucesso' },
  { tipo: 'falhar', mensagem: 'rede', podeRepetir: true },
  { tipo: 'repetir' },
  { tipo: 'cancelar' },
]

describe('RF-18 — nada é gravado sem passar pela confirmação', () => {
  it('nenhum evento leva `lista` ou `tempo` direto para `gravando`', () => {
    const perigosos = ESTADOS.filter((e) => e.etapa === 'lista' || e.etapa === 'tempo')

    for (const estado of perigosos) {
      for (const evento of EVENTOS) {
        expect(
          reduzir(estado, evento).etapa,
          `${estado.etapa} + ${evento.tipo} não pode gravar`,
        ).not.toBe('gravando')
      }
    }
  })

  it('`falhou` só é alcançável a partir de `gravando`', () => {
    // Com isto mais o teste acima, toda gravação tem origem provada: `gravando`
    // vem de `confirmar` ou de `falhou`, e `falhou` vem de `gravando`. Não há
    // ciclo que comece fora da confirmação.
    for (const estado of ESTADOS) {
      for (const evento of EVENTOS) {
        const destino = reduzir(estado, evento)

        // Permanecer em `falhou` não é alcançá-la: um evento sem sentido na
        // etapa devolve o estado intacto, e isso é o comportamento desejado.
        if (destino.etapa === 'falhou' && estado.etapa !== 'falhou') {
          expect(estado.etapa).toBe('gravando')
        }
      }
    }
  })

  it('a única transição para `gravando` a partir de `confirmar` é confirmar', () => {
    const confirmando = ESTADOS.find((e) => e.etapa === 'confirmar')
    if (confirmando === undefined) throw new Error('estado de teste ausente')

    for (const evento of EVENTOS) {
      const destino = reduzir(confirmando, evento).etapa

      if (evento.tipo === 'confirmar') expect(destino).toBe('gravando')
      else expect(destino).not.toBe('gravando')
    }
  })

  it('a ausência também passa pela confirmação (RF-21)', () => {
    const depois = reduzir(INICIAL, { tipo: 'pedirAusencia', alvo: ALVO, chave: CHAVE })

    expect(depois.etapa).toBe('confirmar')
    if (depois.etapa !== 'confirmar') return
    expect(depois.comando.tipo).toBe('ausentar')
  })
})

describe('o fluxo completo (RF-19, RF-20)', () => {
  it('lista → tempo → confirmar → gravando → lista', () => {
    let estado = INICIAL
    expect(focoDe(estado)).toBe('busca')

    estado = reduzir(estado, { tipo: 'selecionar', alvo: ALVO })
    expect(estado.etapa).toBe('tempo')
    expect(focoDe(estado)).toBe('tempo')

    estado = reduzir(estado, {
      tipo: 'informarTempo',
      tempoMs: 83_450,
      tempoTexto: '01:23.45',
      chave: CHAVE,
    })
    expect(estado.etapa).toBe('confirmar')

    estado = reduzir(estado, { tipo: 'confirmar' })
    expect(estado.etapa).toBe('gravando')

    estado = reduzir(estado, { tipo: 'sucesso' })
    // RF-20: depois de gravar, o fluxo recomeça do campo de busca.
    expect(estado).toEqual(INICIAL)
    expect(focoDe(estado)).toBe('busca')
  })

  it('`Esc` cancela de qualquer etapa, menos durante a gravação', () => {
    for (const estado of ESTADOS) {
      const depois = reduzir(estado, { tipo: 'cancelar' })

      if (estado.etapa === 'gravando') {
        // A requisição já saiu. Fingir que não saiu é como o Operador lança
        // duas vezes achando que a primeira não valeu.
        expect(depois).toBe(estado)
      } else {
        expect(depois).toEqual(INICIAL)
      }
    }
  })

  it('tecla repetida e Enter duplo não quebram nada', () => {
    // Numa tela operada por teclado com pressa, isto é o normal — e um erro em
    // tempo de execução por causa disso derrubaria o painel no meio do evento.
    let estado: Estado = INICIAL

    for (let i = 0; i < 3; i += 1) {
      for (const evento of EVENTOS) {
        estado = reduzir(estado, evento)
        expect(['lista', 'tempo', 'confirmar', 'gravando', 'falhou']).toContain(estado.etapa)
      }
    }
  })
})

describe('erro de rede não apaga o que foi digitado (escopo 4)', () => {
  it('o comando sobrevive à falha e volta inteiro na retentativa', () => {
    let estado: Estado = reduzir(reduzir(INICIAL, { tipo: 'selecionar', alvo: ALVO }), {
      tipo: 'informarTempo',
      tempoMs: 83_450,
      tempoTexto: '01:23.45',
      chave: CHAVE,
    })
    estado = reduzir(estado, { tipo: 'confirmar' })
    estado = reduzir(estado, { tipo: 'falhar', mensagem: 'Sem conexão.', podeRepetir: true })

    expect(estado.etapa).toBe('falhou')
    if (estado.etapa !== 'falhou') return
    expect(estado.comando.tipo).toBe('registrar')
    if (estado.comando.tipo !== 'registrar') return
    expect(estado.comando.tempoTexto).toBe('01:23.45')

    const repetindo = reduzir(estado, { tipo: 'repetir' })
    expect(repetindo.etapa).toBe('gravando')
    if (repetindo.etapa !== 'gravando') return

    // A mesma chave. É o que faz repetir não duplicar (FL-06).
    expect(repetindo.comando.chave).toBe(CHAVE)
  })

  it('falha que não deve ser repetida trava a retentativa', () => {
    // Um 409 de conflito não é "tente de novo": outro Operador já registrou, e
    // repetir só produziria o mesmo 409.
    const falhou = reduzir(
      { etapa: 'gravando', comando: { tipo: 'ausentar', alvo: ALVO, chave: CHAVE } },
      { tipo: 'falhar', mensagem: 'Já registrado.', podeRepetir: false },
    )

    expect(reduzir(falhou, { tipo: 'repetir' })).toBe(falhou)
  })
})

describe('a correção carrega o valor anterior (RF-22)', () => {
  it('o comando de correção leva anterior e novo para a confirmação', () => {
    const estado = reduzir(
      reduzir(INICIAL, { tipo: 'selecionarParaCorrigir', alvo: ALVO, tempoAnterior: '01:23.45' }),
      { tipo: 'informarTempo', tempoMs: 80_000, tempoTexto: '01:20.00', chave: CHAVE },
    )

    expect(estado.etapa).toBe('confirmar')
    if (estado.etapa !== 'confirmar' || estado.comando.tipo !== 'corrigir') {
      throw new Error('esperava comando de correção')
    }

    expect(estado.comando.tempoAnterior).toBe('01:23.45')
    expect(estado.comando.tempoTexto).toBe('01:20.00')
  })
})

describe('máscara do campo de tempo', () => {
  it('dígitos entram pela direita', () => {
    expect(formatarDigitacao('')).toBe('')
    expect(formatarDigitacao('5')).toBe('00:00.05')
    expect(formatarDigitacao('45')).toBe('00:00.45')
    expect(formatarDigitacao('2345')).toBe('00:23.45')
    expect(formatarDigitacao('12345')).toBe('01:23.45')
    expect(formatarDigitacao('112345')).toBe('11:23.45')
  })

  it('o que a máscara produz é aceito por `parseTempo`', () => {
    // A máscara é entrada; a conversão canônica é de `shared/tempo.ts`. Se as
    // duas divergirem, o Operador digita um tempo válido e recebe recusa.
    // Sequências plausíveis: os segundos cabem em 0–59, que é o que um
    // cronômetro produz. O caso implausível tem teste próprio logo abaixo.
    for (const digitos of ['12345', '2345', '5', '995959', '100000']) {
      expect(() => parseTempo(formatarDigitacao(digitos)), digitos).not.toThrow()
    }
  })

  it('não conserta valor implausível — mostra o erro em vez de escondê-lo', () => {
    // `00:99.99` na tela diz ao Operador que ele errou; um clamp silencioso
    // para `00:59.99` gravaria um tempo que o cronômetro nunca mediu.
    expect(formatarDigitacao('9999')).toBe('00:99.99')
    expect(() => parseTempo('00:99.99')).toThrow()
  })

  it('digitar tecla a tecla não realimenta os zeros da máscara', () => {
    // Regressão: o campo exibe o texto formatado, então o `onChange` recebe os
    // zeros que a própria máscara colocou. Sem descartá-los, digitar 1, 2, 3
    // produzia `000:00.12` — o dígito mais antigo era empurrado para fora.
    let digitos = ''
    const teclar = (tecla: string) => {
      digitos = digitosDoCampo(formatarDigitacao(digitos) + tecla)
      return formatarDigitacao(digitos)
    }

    expect(teclar('1')).toBe('00:00.01')
    expect(teclar('2')).toBe('00:00.12')
    expect(teclar('3')).toBe('00:01.23')
    expect(teclar('4')).toBe('00:12.34')
    expect(teclar('5')).toBe('01:23.45')
  })

  it('apagar tudo limpa o campo', () => {
    expect(digitosDoCampo('00:00.00')).toBe('')
    expect(formatarDigitacao(digitosDoCampo('00:00.00'))).toBe('')
  })

  it('descarta o que não é dígito e respeita o teto', () => {
    expect(apenasDigitos('1a2b3')).toBe('123')
    expect(apenasDigitos('123456789')).toHaveLength(7)
    expect(pareceCompleto('12')).toBe(false)
    expect(pareceCompleto('123')).toBe(true)
  })
})

describe('o nome em destaque (RF-18)', () => {
  it('é nome e sobrenome, que é o que a confirmação mostra', () => {
    expect(nomeCompleto(ALVO)).toBe('Marina Costa')
  })
})
