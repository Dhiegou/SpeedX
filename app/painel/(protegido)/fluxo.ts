/**
 * A máquina de estados do lançamento (T11).
 *
 * Escrita como redutor puro, fora do componente, por um motivo que vale mais
 * que organização: **RF-18 é uma afirmação sobre caminhos**, não sobre telas.
 * O critério de aceitação pede que se verifique, lendo o código, que não existe
 * caminho de gravação fora da etapa de confirmação. Com a decisão espalhada por
 * `useState` e `onClick`, isso se verifica lendo com atenção e torcendo. Aqui,
 * um teste percorre **todas** as combinações de estado e evento e prova que
 * `gravando` só é alcançável a partir de `confirmar`.
 *
 * ```
 *  lista ──selecionar──▶ tempo ──informarTempo──▶ confirmar ──confirmar──▶ gravando
 *    ▲                                                │                       │
 *    │                                          cancelar                  sucesso
 *    └────────────────────────────────────────────────┴───────────────────────┘
 *                                                                             │
 *                                                        falhar ──▶ falhou ──repetir──▶ gravando
 * ```
 *
 * `falhou` existe para a robustez do escopo 4: erro de rede **não** pode apagar
 * o tempo digitado. O comando fica guardado dentro do estado, e `repetir` o
 * reenvia com a mesma chave de idempotência — que é o que faz repetir não
 * duplicar (FL-06).
 */

/** O mínimo que a tela precisa saber de quem vai receber o lançamento. */
export type Alvo = {
  readonly tentativaId: string
  readonly participanteId: string
  readonly nome: string
  readonly sobrenome: string
  readonly ultimos4Telefone: string
}

/**
 * O que será gravado, montado antes da confirmação e imutável depois dela.
 *
 * A `chave` nasce aqui, junto com o comando, e **não** a cada envio: é o mesmo
 * comando que volta em `repetir`, com a mesma chave, e é por isso que a
 * retentativa de uma rede ruim não vira um segundo Lançamento.
 */
export type Comando =
  | {
      readonly tipo: 'registrar'
      readonly alvo: Alvo
      readonly tempoMs: number
      readonly tempoTexto: string
      readonly chave: string
    }
  | {
      readonly tipo: 'corrigir'
      readonly alvo: Alvo
      readonly tempoMs: number
      readonly tempoTexto: string
      /** Mostrado na confirmação: trocar 01:23.45 por 01:20.00 (RF-22). */
      readonly tempoAnterior: string | null
      readonly chave: string
    }
  | { readonly tipo: 'ausentar'; readonly alvo: Alvo; readonly chave: string }

export type Estado =
  /** Navegando a Fila ou buscando. O foco vive no campo de busca. */
  | { readonly etapa: 'lista' }
  /** Alguém selecionado, esperando o tempo. O foco vive no campo de tempo. */
  | {
      readonly etapa: 'tempo'
      readonly alvo: Alvo
      readonly corrigindo: boolean
      readonly tempoAnterior: string | null
    }
  /** A etapa que RF-18 exige. Nada é gravado antes de passar por aqui. */
  | { readonly etapa: 'confirmar'; readonly comando: Comando }
  | { readonly etapa: 'gravando'; readonly comando: Comando }
  /** Falhou, e o comando continua inteiro para poder ser repetido. */
  | {
      readonly etapa: 'falhou'
      readonly comando: Comando
      readonly mensagem: string
      readonly podeRepetir: boolean
    }

export type Evento =
  | { readonly tipo: 'selecionar'; readonly alvo: Alvo }
  /** Selecionar alguém que já tem tempo: o fluxo é o de correção (RF-22). */
  | {
      readonly tipo: 'selecionarParaCorrigir'
      readonly alvo: Alvo
      readonly tempoAnterior: string | null
    }
  | { readonly tipo: 'pedirAusencia'; readonly alvo: Alvo; readonly chave: string }
  | {
      readonly tipo: 'informarTempo'
      readonly tempoMs: number
      readonly tempoTexto: string
      readonly chave: string
    }
  | { readonly tipo: 'confirmar' }
  | { readonly tipo: 'sucesso' }
  | { readonly tipo: 'falhar'; readonly mensagem: string; readonly podeRepetir: boolean }
  | { readonly tipo: 'repetir' }
  | { readonly tipo: 'cancelar' }

export const INICIAL: Estado = { etapa: 'lista' }

/**
 * O redutor.
 *
 * Evento que não faz sentido no estado atual devolve o estado **intacto**, em
 * vez de lançar. Numa tela operada por teclado, tecla repetida e Enter duplo
 * são o comportamento normal de quem tem pressa — e um erro em tempo de
 * execução por causa disso derrubaria o painel no meio do evento.
 */
export function reduzir(estado: Estado, evento: Evento): Estado {
  // `cancelar` volta para a lista de qualquer etapa, menos durante a gravação:
  // ali a requisição já saiu, e fingir que não saiu é o caminho para o
  // Operador lançar duas vezes achando que a primeira não valeu.
  if (evento.tipo === 'cancelar') {
    return estado.etapa === 'gravando' ? estado : INICIAL
  }

  switch (estado.etapa) {
    case 'lista':
      if (evento.tipo === 'selecionar') {
        return { etapa: 'tempo', alvo: evento.alvo, corrigindo: false, tempoAnterior: null }
      }
      if (evento.tipo === 'selecionarParaCorrigir') {
        return {
          etapa: 'tempo',
          alvo: evento.alvo,
          corrigindo: true,
          tempoAnterior: evento.tempoAnterior,
        }
      }
      // A ausência pula o campo de tempo — não há tempo a digitar — mas **não**
      // pula a confirmação: RF-21 tira alguém da Fila, e enganar-se de linha
      // com a seta é fácil demais para não perguntar antes.
      if (evento.tipo === 'pedirAusencia') {
        return {
          etapa: 'confirmar',
          comando: { tipo: 'ausentar', alvo: evento.alvo, chave: evento.chave },
        }
      }
      return estado

    case 'tempo':
      if (evento.tipo === 'informarTempo') {
        return {
          etapa: 'confirmar',
          comando: estado.corrigindo
            ? {
                tipo: 'corrigir',
                alvo: estado.alvo,
                tempoMs: evento.tempoMs,
                tempoTexto: evento.tempoTexto,
                tempoAnterior: estado.tempoAnterior,
                chave: evento.chave,
              }
            : {
                tipo: 'registrar',
                alvo: estado.alvo,
                tempoMs: evento.tempoMs,
                tempoTexto: evento.tempoTexto,
                chave: evento.chave,
              },
        }
      }
      return estado

    case 'confirmar':
      // A única porta para `gravando` em todo o redutor.
      if (evento.tipo === 'confirmar') return { etapa: 'gravando', comando: estado.comando }
      return estado

    case 'gravando':
      if (evento.tipo === 'sucesso') return INICIAL
      if (evento.tipo === 'falhar') {
        return {
          etapa: 'falhou',
          comando: estado.comando,
          mensagem: evento.mensagem,
          podeRepetir: evento.podeRepetir,
        }
      }
      return estado

    case 'falhou':
      // Repetir reenvia **o mesmo comando**, com a mesma chave. É o que separa
      // "a confirmação se perdeu na volta" de "gravar duas vezes" (FL-06).
      if (evento.tipo === 'repetir' && estado.podeRepetir) {
        return { etapa: 'gravando', comando: estado.comando }
      }
      return estado
  }
}

/** O que a tela mostra em destaque na confirmação (RF-18). */
export function nomeCompleto(alvo: Alvo): string {
  return `${alvo.nome} ${alvo.sobrenome}`
}

/** Onde o foco deve estar em cada etapa (RF-19, RF-20). */
export function focoDe(estado: Estado): 'busca' | 'tempo' | 'confirmacao' | 'erro' {
  switch (estado.etapa) {
    case 'lista':
      return 'busca'
    case 'tempo':
      return 'tempo'
    case 'confirmar':
    case 'gravando':
      return 'confirmacao'
    case 'falhou':
      return 'erro'
  }
}
