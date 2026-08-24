import { FUSO_DO_EVENTO } from '@/shared/tempo'

/**
 * O prazo de retenção (T15 — RNF-11, PE-02).
 *
 * Dez dias após a data do evento. Não é um número escolhido aqui: está escrito
 * no termo que 2000 pessoas vão aceitar (`v1.0-2026-08-19`, seção `retencao`),
 * e o termo é a prova do que foi prometido. Se este arquivo e aquele texto
 * discordarem, quem está errado é este arquivo — e `retencao.test.ts` falha.
 *
 * **A contagem parte da data do evento, nunca de "hoje menos dez".** A promessa
 * foi feita contra um dia específico; ancorá-la no dia em que alguém lembrou de
 * rodar o comando faria o prazo depender da memória do operador, que é
 * exatamente o que um prazo existe para não depender.
 *
 * **O dia do evento ainda não tem data** (PE-06). Por isso não há valor padrão
 * em lugar nenhum deste módulo: quem expurga informa a data, e o comando recusa
 * rodar sem ela. Um padrão aqui seria um palpite com poder de apagar a base.
 */

/** Dias de guarda depois do evento. Espelha o termo; não mude sozinho. */
export const DIAS_DE_RETENCAO = 10

const UM_DIA_MS = 24 * 60 * 60 * 1000

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export class DataDoEventoInvalidaError extends Error {
  constructor(recebido: string) {
    super(
      `Data do evento inválida: "${recebido}". Use o formato AAAA-MM-DD, ` +
        `por exemplo 2026-09-12.`,
    )
    this.name = 'DataDoEventoInvalidaError'
  }
}

/** Uma data de calendário no fuso do evento — sem hora, porque o dia é o dado. */
export type DiaDoEvento = { readonly ano: number; readonly mes: number; readonly dia: number }

/**
 * Lê `AAAA-MM-DD` e confere que o dia existe.
 *
 * `new Date('2026-02-31')` não é erro em JavaScript: vira 3 de março, calado.
 * Um comando que apaga a base não pode aceitar uma data que ele mesmo
 * reinterpretou — a diferença entre 31 de fevereiro e 3 de março são dois dias
 * a menos de guarda para todo mundo.
 */
export function lerDiaDoEvento(texto: string): DiaDoEvento {
  const achado = DATA_ISO.exec(texto.trim())
  if (achado === null) throw new DataDoEventoInvalidaError(texto)

  const [, a, m, d] = achado
  const ano = Number(a)
  const mes = Number(m)
  const dia = Number(d)

  const referencia = new Date(Date.UTC(ano, mes - 1, dia))

  const coerente =
    referencia.getUTCFullYear() === ano &&
    referencia.getUTCMonth() === mes - 1 &&
    referencia.getUTCDate() === dia

  if (!coerente) throw new DataDoEventoInvalidaError(texto)

  return { ano, mes, dia }
}

/**
 * Deslocamento do fuso do evento em relação a UTC, no instante dado.
 *
 * O Brasil não tem horário de verão desde 2019, então isto é `-03:00` sempre —
 * mas derivar em vez de fixar custa uma linha e sobrevive a uma mudança de lei
 * que nós não controlamos. Formata o instante no fuso e reinterpreta o texto
 * como se fosse UTC: a diferença entre os dois é o deslocamento.
 */
const PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DO_EVENTO,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function deslocamentoMs(instante: Date): number {
  const partes = new Map(PARTES.formatToParts(instante).map((p) => [p.type, p.value]))

  const comoUtc = Date.UTC(
    Number(partes.get('year')),
    Number(partes.get('month')) - 1,
    Number(partes.get('day')),
    // `hour12: false` produz `24` para a meia-noite em alguns motores; o resto
    // do cálculo trata isso naturalmente, porque `Date.UTC` normaliza.
    Number(partes.get('hour')) % 24,
    Number(partes.get('minute')),
    Number(partes.get('second')),
  )

  return comoUtc - instante.getTime()
}

/** O instante UTC de uma hora de parede no fuso do evento. */
function instanteLocal(ms: number): Date {
  // Primeiro palpite: tratar a hora de parede como se fosse UTC e descontar o
  // deslocamento medido ali. Uma segunda passagem cobre o caso de o palpite
  // cair do outro lado de uma transição de fuso.
  const primeiro = ms - deslocamentoMs(new Date(ms))
  return new Date(ms - deslocamentoMs(new Date(primeiro)))
}

/**
 * O instante em que a guarda vence: a **virada** do décimo dia depois do evento,
 * no fuso do evento.
 *
 * Evento em 12/09 significa guarda até o fim de 22/09; a partir de 23/09 às
 * 00:00 em São Paulo, nada mais pode estar guardado. Contar em horas a partir
 * de um instante do dia do evento daria um prazo que termina no meio de uma
 * tarde, e "10 dias" no termo não foi escrito para ser lido assim.
 */
export function vencimentoDaRetencao(dia: DiaDoEvento): Date {
  const meiaNoiteDoEvento = Date.UTC(dia.ano, dia.mes - 1, dia.dia)

  return instanteLocal(meiaNoiteDoEvento + (DIAS_DE_RETENCAO + 1) * UM_DIA_MS)
}

/** Já venceu? É a pergunta que autoriza o expurgo total a rodar. */
export function prazoVencido(dia: DiaDoEvento, agora: Date = new Date()): boolean {
  return agora.getTime() >= vencimentoDaRetencao(dia).getTime()
}

/**
 * Dias inteiros que ainda faltam para o vencimento. Zero quando já venceu.
 *
 * Serve à mensagem do comando: "faltam 3 dias" é o que faz alguém parar antes
 * de apagar a base no meio da semana do evento.
 */
export function diasRestantes(dia: DiaDoEvento, agora: Date = new Date()): number {
  const restante = vencimentoDaRetencao(dia).getTime() - agora.getTime()

  return restante <= 0 ? 0 : Math.ceil(restante / UM_DIA_MS)
}
