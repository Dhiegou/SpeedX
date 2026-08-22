/**
 * Registro estruturado de operações (T05 §5, T16).
 *
 * RNF-08 diz que dado pessoal não escapa do sistema. Log é um caminho de saída
 * como qualquer outro — vai para stdout, é recolhido por um agregador, fica
 * legível para quem tem acesso à infraestrutura e sobrevive ao expurgo do banco
 * (T15). Um e-mail impresso aqui é um vazamento com retenção própria.
 *
 * Duas barreiras, nesta ordem:
 *
 *  1. **A forma do registro é fechada.** Não existe campo onde caiba o corpo da
 *     requisição. Quem quiser registrar um e-mail precisa alterar este arquivo.
 *  2. **O texto livre que sobra é saneado.** `motivo` e `referencia` passam por
 *     um filtro que apaga o que se parece com e-mail ou telefone antes de
 *     escrever. A primeira barreira depende de ninguém contornar a forma; a
 *     segunda não depende de nada.
 *
 * A segunda existe porque a primeira falha de um jeito específico e previsível:
 * alguém interpola o dado dentro de uma mensagem de erro.
 */

/** Desfecho da operação. Fechado: relatório e alerta de T16 contam por aqui. */
export type ResultadoOperacao =
  'sucesso' | 'repetida' | 'recusada' | 'limitada' | 'descartada' | 'erro'

export type EntradaDeLog = {
  /** Operação, em minúsculas e com ponto: `inscricao.cadastro`. */
  readonly evento: string
  readonly resultado: ResultadoOperacao
  /** Por que, em vocabulário do sistema: `validacao`, `honeypot`, `limite_ip`. */
  readonly motivo?: string
  /** Identificador opaco: id de Participante, escopo de chave. Nunca um nome. */
  readonly referencia?: string
  readonly duracaoMs?: number
  /** Tempo que a pessoa levou preenchendo, quando a operação sabe (PRD §7). */
  readonly preenchimentoMs?: number
  /** **Nomes** de campo recusados, nunca os valores. */
  readonly campos?: readonly string[]
  readonly status?: number
}

export type RegistroDeLog = EntradaDeLog & { readonly instante: string }

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
/** Dez dígitos ou mais em sequência, com ou sem separador: telefone e afins. */
const SEQUENCIA_DE_DIGITOS = /(?:\d[\s().-]*){10,}/g

/**
 * Identificador opaco do sistema. Preservado inteiro — ver `sanear`.
 *
 * Descoberto em T08: o comentário original deste arquivo afirmava que um UUID
 * "não casa com nenhum dos dois padrões e atravessa intacto", e isso era falso
 * para **parte** dos UUIDs. `cb1234567-8901-43c3-a46e-ed1c6efd4481` tem onze
 * dígitos seguidos separados por hífen no começo, que é exatamente a forma de
 * um telefone — e virava `cb[removido]c3-...` no log. O defeito só aparecia
 * quando o sorteio do UUID calhava de produzir a sequência, o que fez o teste
 * original passar com um exemplo que não a produzia.
 */
const IDENTIFICADOR = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

const REMOVIDO = '[removido]'

/**
 * Marcador de reserva.
 *
 * O caractere nulo não aparece em texto vindo de mensagem de erro e não está na
 * classe de separadores de `SEQUENCIA_DE_DIGITOS` — então ele interrompe uma
 * sequência de dígitos em vez de participar dela. Construído por chamada, e não
 * escrito como literal, para que o arquivo não carregue um byte de controle que
 * alguns editores mostram como nada e outros perdem em uma cópia.
 */
const RESERVA = String.fromCharCode(0)

/**
 * Apaga o que se parece com dado pessoal.
 *
 * Deliberadamente mais amplo do que preciso: prefere estragar uma mensagem de
 * diagnóstico a deixar passar um telefone.
 *
 * A exceção são os UUIDs, retirados de cena antes dos dois filtros e devolvidos
 * depois. Eles são o identificador de Participante, de Operador e de Tentativa
 * — o que liga uma linha de log ao registro que ela descreve. Um saneamento que
 * os corrói deixa o log sem serventia, e log sem serventia é log nenhum: T16
 * conta por ele e T21 audita por ele.
 *
 * O que se paga por isso: um telefone escrito **na forma exata** de um UUID
 * hexadecimal atravessaria. Nenhum caminho deste sistema produz esse texto —
 * telefone entra por `participante.telefone`, que o banco obriga a ser dez ou
 * onze dígitos e nada mais.
 */
export function sanear(texto: string): string {
  const guardados: string[] = []

  const reservado = texto.replace(IDENTIFICADOR, (achado) => {
    guardados.push(achado)
    return `${RESERVA}${String(guardados.length - 1)}${RESERVA}`
  })

  const limpo = reservado.replace(EMAIL, REMOVIDO).replace(SEQUENCIA_DE_DIGITOS, REMOVIDO)

  return limpo.replace(
    new RegExp(`${RESERVA}(\\d+)${RESERVA}`, 'g'),
    (_, indice: string) => guardados[Number(indice)] ?? REMOVIDO,
  )
}

/** Monta o registro já saneado. Separado da escrita para poder ser testado. */
export function montarRegistro(entrada: EntradaDeLog): RegistroDeLog {
  return {
    ...entrada,
    // Relógio do servidor, sempre (SDD §4; a mesma regra de RF-23).
    instante: new Date().toISOString(),
    ...(entrada.motivo === undefined ? {} : { motivo: sanear(entrada.motivo) }),
    ...(entrada.referencia === undefined ? {} : { referencia: sanear(entrada.referencia) }),
    ...(entrada.campos === undefined ? {} : { campos: entrada.campos.map(sanear) }),
  }
}

/**
 * Escreve o registro em stdout, uma linha JSON.
 *
 * Sem `await`, sem confirmação e sem tratamento de erro: a coleta não pode
 * adicionar latência ao caminho da requisição nem falhar junto com ele
 * (SDD FL-12). Perder uma linha de log é aceitável; perder o cadastro porque o
 * log falhou, não.
 */
export function registrarOperacao(entrada: EntradaDeLog): RegistroDeLog {
  const registro = montarRegistro(entrada)

  try {
    process.stdout.write(`${JSON.stringify(registro)}\n`)
  } catch {
    // Ignorado de propósito. Ver o comentário acima.
  }

  return registro
}
