/**
 * Tempo de corrida — a única conversão entre texto e número no sistema.
 *
 * O SDD §3 fixa: armazenado como inteiro em milissegundos, exibido como
 * `mm:ss.cc`. Precisão de centésimo, porque é o que o cronômetro externo
 * entrega. O sistema não afere Tempo, apenas registra.
 *
 * Nenhum outro módulo formata ou interpreta tempo por conta própria. Duas
 * implementações divergentes de arredondamento produziriam duas classificações
 * diferentes para os mesmos dados — e uma contestação que o sistema não saberia
 * esclarecer é um contraindicador explícito do PRD §7.
 */

/** Entrada de tempo que o sistema não consegue interpretar sem ambiguidade. */
export class TempoInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'TempoInvalidoError'
  }
}

/** Limite superior plausível para uma corrida do evento. Rejeita erro de digitação. */
export const TEMPO_MAXIMO_MS = 100 * 60 * 1000 - 10

const FORMATO = /^(\d{1,3}):([0-5]\d)\.(\d{2})$/

/**
 * Interpreta `mm:ss.cc` e devolve milissegundos.
 *
 * Aceita de um a três dígitos de minuto; exige dois de segundo e dois de
 * centésimo. `1:23.4` é recusado de propósito: seria impossível saber se o
 * operador quis dizer 4 ou 40 centésimos, e adivinhar aqui é decidir uma
 * posição no pódio.
 */
export function parseTempo(texto: string): number {
  const limpo = texto.trim()

  const partes = FORMATO.exec(limpo)
  if (partes === null) {
    throw new TempoInvalidoError(
      `Tempo inválido: "${texto}". Use o formato mm:ss.cc — por exemplo, 01:23.45.`,
    )
  }

  const [, minutos, segundos, centesimos] = partes as unknown as [string, string, string, string]

  const ms = Number(minutos) * 60_000 + Number(segundos) * 1_000 + Number(centesimos) * 10

  if (ms <= 0) {
    throw new TempoInvalidoError('Tempo inválido: 00:00.00 não é um resultado de corrida.')
  }

  if (ms > TEMPO_MAXIMO_MS) {
    throw new TempoInvalidoError(
      `Tempo inválido: "${texto}" ultrapassa o limite de 99:59.99. Confira a digitação.`,
    )
  }

  return ms
}

/**
 * Formata milissegundos como `mm:ss.cc`.
 *
 * Trunca em vez de arredondar: um tempo de 83.459 s é 01:23.45, não 01:23.46.
 * Arredondar para cima criaria um centésimo que o cronômetro nunca mediu, e é
 * justamente o centésimo que decide o desempate.
 */
export function formatTempo(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new TempoInvalidoError(`Tempo inválido para exibição: ${ms}. Esperado inteiro em ms.`)
  }

  const minutos = Math.floor(ms / 60_000)
  const segundos = Math.floor((ms % 60_000) / 1_000)
  const centesimos = Math.floor((ms % 1_000) / 10)

  const dd = (n: number) => String(n).padStart(2, '0')

  return `${dd(minutos)}:${dd(segundos)}.${dd(centesimos)}`
}

/**
 * Fuso do evento.
 *
 * A corrida é presencial, num lugar só, e todo mundo que lê uma hora na tela
 * está fisicamente lá. Formatar no fuso do servidor seria pedir para a hora
 * mudar quando a hospedagem mudar (PE-05) — e "Tempo já registrado às 17h32"
 * com três horas de diferença é pior que nenhuma hora.
 *
 * Fixo em São Paulo por ser onde o evento acontece — 24 de outubro de 2026,
 * confirmado com a data em 2026-08-25 (PE-06). Se isso mudar, muda aqui e em
 * nenhum outro lugar.
 */
export const FUSO_DO_EVENTO = 'America/Sao_Paulo'

const HORA_DO_EVENTO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DO_EVENTO,
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * `14:32` — a hora de um Lançamento, para mensagem de tela.
 *
 * Sem segundos: quem lê está resolvendo um conflito entre dois operadores, e o
 * que importa é situar o momento, não cronometrá-lo. O Tempo da corrida, esse
 * sim, tem centésimo — e é `formatTempo` que cuida dele.
 */
export function formatHoraDoEvento(instante: Date): string {
  return HORA_DO_EVENTO.format(instante)
}

const DATA_HORA_DO_EVENTO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DO_EVENTO,
  dateStyle: 'short',
  timeStyle: 'medium',
})

/**
 * `24/10/2026 14:32:07` — instante completo, para o `title` de um rótulo relativo.
 *
 * **Existe para não depender do relógio de quem lê.** `toLocaleString()` sem
 * argumento formata no fuso e na língua do ambiente: no servidor dá uma coisa,
 * no navegador dá outra, e o React acusa divergência de hidratação na página
 * mais pública do evento. Com o fuso fixo, os dois lados escrevem o mesmo texto.
 *
 * Ancorar no fuso do evento também é o que faz sentido para quem lê: a pessoa
 * está fisicamente lá, e a hora que interessa é a do lugar, não a do aparelho.
 */
export function formatDataHoraDoEvento(instante: Date): string {
  return DATA_HORA_DO_EVENTO.format(instante)
}
