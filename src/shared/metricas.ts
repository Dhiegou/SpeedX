import type { RegistroDeLog } from './log'

/**
 * As métricas do evento, derivadas do log (T16 §3 e §4 — RNF-05, PRD §7).
 *
 * **A decisão que organiza este arquivo: não há um segundo caminho de
 * telemetria.** O log estruturado de `log.ts` já sai em toda rota com evento,
 * resultado, status e duração; um emissor paralelo de métricas seria uma
 * segunda coisa a manter, a sanear e a derrubar sem querer — e mediria o mesmo.
 * Aqui o log é a fonte, e este módulo é a leitura.
 *
 * Três consequências que valem por si:
 *
 * 1. **A coleta não pode adicionar latência nem falhar junto com a requisição**
 *    (SDD FL-12). Isso já é verdade por construção: `registrarOperacao` escreve
 *    uma linha em stdout dentro de um `try` vazio. Não há coletor a derrubar,
 *    porque não há coletor.
 * 2. **Nenhuma métrica carrega dado pessoal.** A forma de `EntradaDeLog` é
 *    fechada e o texto livre é saneado; o que chega aqui já passou por lá.
 * 3. **Nada disto depende do provedor de hospedagem** (PE-05 continua aberta).
 *    O relatório roda contra um arquivo de log hoje, e contra a saída do
 *    agregador quando houver um.
 *
 * Este módulo é puro: recebe registros, devolve números. Não lê arquivo, não
 * consulta banco e não sabe que horas são.
 */

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Lê JSON por linha, ignorando o que não for registro nosso.
 *
 * A saída de um processo Next carrega banner de inicialização, aviso de
 * compilação e o que mais a plataforma resolver imprimir. Um analisador que
 * quebre na primeira linha estranha é um analisador que nunca roda contra o log
 * de verdade — e é justamente contra ele que este precisa rodar.
 */
export function lerRegistros(texto: string): RegistroDeLog[] {
  const registros: RegistroDeLog[] = []

  for (const linha of texto.split('\n')) {
    const limpa = linha.trim()
    if (!limpa.startsWith('{')) continue

    let valor: unknown
    try {
      valor = JSON.parse(limpa)
    } catch {
      continue
    }

    if (valor === null || typeof valor !== 'object') continue

    const { evento, resultado, instante } = valor as Record<string, unknown>

    if (
      typeof evento === 'string' &&
      typeof resultado === 'string' &&
      typeof instante === 'string'
    ) {
      registros.push(valor as RegistroDeLog)
    }
  }

  return registros
}

// ---------------------------------------------------------------------------
// Percentis
// ---------------------------------------------------------------------------

export type Percentis = {
  readonly amostras: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
}

/**
 * Percentil por posto mais próximo, sem interpolar.
 *
 * A alternativa — média entre os dois vizinhos — produz um número que **não
 * aconteceu**: um p95 de 1,87 s quando nenhuma requisição levou isso. Para um
 * limite de aceitação ("≤ 2 s", RNF-01) o que interessa é uma amostra real, e
 * quem argumentar contra o resultado tem uma requisição concreta para olhar.
 *
 * Com poucas amostras o p99 vira o máximo, e isso é honesto: com trinta
 * requisições não existe centésimo percentil, existe a pior.
 */
export function percentis(valores: readonly number[]): Percentis | null {
  if (valores.length === 0) return null

  const ordenados = [...valores].sort((a, b) => a - b)
  const posto = (fracao: number): number => {
    const indice = Math.ceil(fracao * ordenados.length) - 1
    return ordenados[Math.min(Math.max(indice, 0), ordenados.length - 1)] ?? 0
  }

  return {
    amostras: ordenados.length,
    p50: posto(0.5),
    p95: posto(0.95),
    p99: posto(0.99),
    max: ordenados[ordenados.length - 1] ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------

export type Janela = { readonly de: Date; readonly ate: Date; readonly minutos: number }

/**
 * O intervalo que os registros cobrem.
 *
 * Todas as taxas "por minuto" saem daqui, e é por isso que ela é medida e não
 * suposta: dividir por "o tempo que o evento durou" daria um número menor do
 * que o real sempre que o log recolhido cobrir só um pedaço do dia.
 *
 * O piso de um minuto evita dividir por zero quando tudo aconteceu no mesmo
 * segundo — o caso de um teste, e o de um pico.
 */
export function janelaDe(registros: readonly RegistroDeLog[]): Janela | null {
  if (registros.length === 0) return null

  const instantes = registros.map((r) => Date.parse(r.instante)).filter((n) => !Number.isNaN(n))
  if (instantes.length === 0) return null

  const de = Math.min(...instantes)
  const ate = Math.max(...instantes)

  return { de: new Date(de), ate: new Date(ate), minutos: Math.max((ate - de) / 60_000, 1) }
}

// ---------------------------------------------------------------------------
// Métricas técnicas (§3)
// ---------------------------------------------------------------------------

export type LatenciaDeEvento = Percentis & { readonly evento: string }

export type RelatorioTecnico = {
  readonly janela: Janela | null
  readonly registros: number
  readonly latencia: readonly LatenciaDeEvento[]
  readonly erros5xx: { readonly total: number; readonly porMinuto: number; readonly taxa: number }
  readonly limitadas429: { readonly total: number; readonly porMinuto: number }
  /**
   * Revalidação da Classificação: quantos 304 sobre o total de leituras.
   *
   * **Não é a taxa de acerto do cache de borda, e não deve ser lida como se
   * fosse.** O acerto de borda, por definição, não chega ao servidor e não
   * aparece em log nenhum daqui — só o painel do provedor sabe. O que este
   * número mede é o outro mecanismo, o de FL-08: quantas das leituras que
   * **passaram** pela borda saíram sem corpo. Se ele cair, o custo por leitura
   * sobe, que é o mesmo sintoma. A taxa de borda de verdade entra em T19.
   */
  readonly revalidacaoDaClassificacao: {
    readonly leituras: number
    readonly revalidacoes: number
    readonly taxa: number
  }
}

const ehErro5xx = (r: RegistroDeLog): boolean => (r.status ?? 0) >= 500
const ehLimitada = (r: RegistroDeLog): boolean => r.status === 429 || r.resultado === 'limitada'

export function relatorioTecnico(registros: readonly RegistroDeLog[]): RelatorioTecnico {
  const janela = janelaDe(registros)
  const minutos = janela?.minutos ?? 1

  const porEvento = new Map<string, number[]>()
  for (const r of registros) {
    if (typeof r.duracaoMs !== 'number') continue
    const lista = porEvento.get(r.evento) ?? []
    lista.push(r.duracaoMs)
    porEvento.set(r.evento, lista)
  }

  const latencia = [...porEvento.entries()]
    .map(([evento, valores]) => {
      const p = percentis(valores)
      return p === null ? null : { evento, ...p }
    })
    .filter((x): x is LatenciaDeEvento => x !== null)
    .sort((a, b) => b.p95 - a.p95)

  const comStatus = registros.filter((r) => typeof r.status === 'number')
  const erros = comStatus.filter(ehErro5xx).length
  const limitadas = registros.filter(ehLimitada).length

  const leituras = registros.filter((r) => r.evento === 'classificacao.leitura')
  const revalidacoes = leituras.filter((r) => r.status === 304).length

  return {
    janela,
    registros: registros.length,
    latencia,
    erros5xx: {
      total: erros,
      porMinuto: erros / minutos,
      taxa: comStatus.length === 0 ? 0 : erros / comStatus.length,
    },
    limitadas429: { total: limitadas, porMinuto: limitadas / minutos },
    revalidacaoDaClassificacao: {
      leituras: leituras.length,
      revalidacoes,
      taxa: leituras.length === 0 ? 0 : revalidacoes / leituras.length,
    },
  }
}

// ---------------------------------------------------------------------------
// Métricas de produto (§4 — PRD §7)
// ---------------------------------------------------------------------------

/** Nomes de campo do bloco de Responsável, para a métrica de recusa de RNF-07. */
const CAMPOS_DE_RESPONSAVEL = ['responsavel', 'aceiteResponsavel']

const ehDeResponsavel = (campo: string): boolean =>
  CAMPOS_DE_RESPONSAVEL.some((prefixo) => campo.toLowerCase().startsWith(prefixo.toLowerCase()))

export type RelatorioDeProduto = {
  readonly cadastro: {
    readonly aberturas: number
    readonly concluidos: number
    /** Meta do PRD §7: ≥ 0,95. `null` quando ninguém abriu o formulário. */
    readonly taxaDeConclusao: number | null
    /** Meta do PRD §7: ≤ 90 s. Mediana, não média: um abandono de meia hora não conta. */
    readonly medianaDeSegundos: number | null
  }
  readonly lancamentos: {
    readonly registros: number
    readonly correcoes: number
    /** Meta do PRD §7: ≤ 0,01. */
    readonly taxaDeCorrecao: number | null
  }
  readonly classificacao: {
    readonly leituras: number
    /** Meta do PRD §7: ≥ 2 por inscrito. Precisa do total de inscritos, que vem do banco. */
    readonly porInscrito: number | null
  }
  readonly responsavel: {
    readonly recusas: number
    readonly recusasNoBlocoDoResponsavel: number
    /** Meta do PRD §7: ≤ 0,10 das inscrições de menores. */
    readonly taxaSobreAberturas: number | null
  }
}

const conta = (registros: readonly RegistroDeLog[], evento: string, resultado?: string): number =>
  registros.filter(
    (r) => r.evento === evento && (resultado === undefined || r.resultado === resultado),
  ).length

export function relatorioDeProduto(
  registros: readonly RegistroDeLog[],
  { inscritos }: { inscritos?: number } = {},
): RelatorioDeProduto {
  const aberturas = conta(registros, 'inscricao.formulario_aberto')
  const concluidos = conta(registros, 'inscricao.cadastro', 'sucesso')

  const preenchimentos = registros
    .filter((r) => r.evento === 'inscricao.cadastro' && typeof r.preenchimentoMs === 'number')
    .map((r) => r.preenchimentoMs as number)

  const mediana = percentis(preenchimentos)

  const registrosDeTempo = conta(registros, 'cronometragem.registro', 'sucesso')
  const correcoes = conta(registros, 'cronometragem.correcao', 'sucesso')
  const totalDeLancamentos = registrosDeTempo + correcoes

  const leituras = conta(registros, 'classificacao.leitura')

  const recusas = registros.filter((r) => r.evento === 'inscricao.cadastro' && r.status === 422)
  const noBloco = recusas.filter((r) => (r.campos ?? []).some(ehDeResponsavel)).length

  return {
    cadastro: {
      aberturas,
      concluidos,
      taxaDeConclusao: aberturas === 0 ? null : concluidos / aberturas,
      medianaDeSegundos: mediana === null ? null : mediana.p50 / 1000,
    },
    lancamentos: {
      registros: registrosDeTempo,
      correcoes,
      taxaDeCorrecao: totalDeLancamentos === 0 ? null : correcoes / totalDeLancamentos,
    },
    classificacao: {
      leituras,
      porInscrito: inscritos === undefined || inscritos === 0 ? null : leituras / inscritos,
    },
    responsavel: {
      recusas: recusas.length,
      recusasNoBlocoDoResponsavel: noBloco,
      taxaSobreAberturas: aberturas === 0 ? null : noBloco / aberturas,
    },
  }
}

// ---------------------------------------------------------------------------
// Alertas (§6)
// ---------------------------------------------------------------------------

export type Gravidade = 'critico' | 'atencao'

export type Alerta = {
  readonly nome: string
  readonly gravidade: Gravidade
  readonly detalhe: string
}

export type LimiaresDeAlerta = {
  /** RNF-01: a Classificação responde em 2 s. */
  readonly p95DaClassificacaoMs: number
  /** Por quantos minutos seguidos o p95 pode estourar antes de acordar alguém. */
  readonly minutosSeguidosAcimaDoP95: number
  /** RNF-05. Fração, não porcentagem. */
  readonly taxaDe5xx: number
  /** Silêncio no cadastro que indica falha silenciosa, em minutos. */
  readonly silencioDeCadastroMinutos: number
}

export const LIMIARES_PADRAO: LimiaresDeAlerta = {
  p95DaClassificacaoMs: 2_000,
  minutosSeguidosAcimaDoP95: 2,
  taxaDe5xx: 0.01,
  silencioDeCadastroMinutos: 10,
}

const minutoDe = (instante: string): number => Math.floor(Date.parse(instante) / 60_000)

/**
 * Os quatro alertas de T16 §6, avaliados sobre uma janela de log.
 *
 * **Avaliar aqui, e não só no provedor, é o que torna o alerta testável.** Um
 * limiar configurado no painel de um serviço externo é uma afirmação que
 * ninguém verifica até o dia em que ela precisava ter disparado. Estes têm
 * teste, e `npm run metricas` sai com código diferente de zero quando algum
 * dispara — o que dá a T19 um gancho pronto para pendurar num agendador.
 *
 * O que **não** cabe aqui é a indisponibilidade total: se o processo caiu, ele
 * não escreveu log nenhum, e a ausência de linha não é distinguível de um
 * período tranquilo. Esse é o alerta que **só** o monitor externo pode dar, e é
 * por isso que ele existe (§2). Este módulo cobre o resto.
 */
export function avaliarAlertas(
  registros: readonly RegistroDeLog[],
  limiares: LimiaresDeAlerta = LIMIARES_PADRAO,
): readonly Alerta[] {
  const alertas: Alerta[] = []

  // 1. Sondagem de saúde falhando.
  const saudeRuim = registros.filter(
    (r) => r.evento === 'saude.verificacao' && r.resultado === 'erro',
  ).length

  if (saudeRuim > 0) {
    alertas.push({
      nome: 'saude_indisponivel',
      gravidade: 'critico',
      detalhe: `${String(saudeRuim)} sondagem(ns) de /api/saude sem alcançar o banco.`,
    })
  }

  // 2. p95 da Classificação acima do limite por minutos seguidos.
  const porMinuto = new Map<number, number[]>()
  for (const r of registros) {
    if (r.evento !== 'classificacao.leitura' || typeof r.duracaoMs !== 'number') continue
    const chave = minutoDe(r.instante)
    porMinuto.set(chave, [...(porMinuto.get(chave) ?? []), r.duracaoMs])
  }

  const minutos = [...porMinuto.keys()].sort((a, b) => a - b)
  let seguidos = 0
  let pior = 0

  for (let i = 0; i < minutos.length; i += 1) {
    const chave = minutos[i]
    if (chave === undefined) continue

    const p = percentis(porMinuto.get(chave) ?? [])
    const estourou = p !== null && p.p95 > limiares.p95DaClassificacaoMs

    // Minutos precisam ser **consecutivos no relógio**: dois minutos com um
    // buraco entre eles são dois incidentes curtos, e o limiar fala de um
    // problema que persiste.
    const contiguo = i > 0 && minutos[i - 1] === chave - 1

    seguidos = estourou ? (contiguo ? seguidos + 1 : 1) : 0
    if (estourou && p !== null) pior = Math.max(pior, p.p95)

    if (seguidos >= limiares.minutosSeguidosAcimaDoP95) {
      alertas.push({
        nome: 'classificacao_lenta',
        gravidade: 'critico',
        detalhe:
          `p95 da Classificação acima de ${String(limiares.p95DaClassificacaoMs)} ms por ` +
          `${String(seguidos)} minuto(s) seguidos; pior p95 de ${String(pior)} ms (RNF-01).`,
      })
      break
    }
  }

  // 3. Taxa de 5xx.
  const tecnico = relatorioTecnico(registros)
  if (tecnico.erros5xx.taxa > limiares.taxaDe5xx) {
    alertas.push({
      nome: 'erros_5xx',
      gravidade: 'critico',
      detalhe:
        `${(tecnico.erros5xx.taxa * 100).toFixed(2)}% das respostas com status 5xx ` +
        `(${String(tecnico.erros5xx.total)} de ${String(registros.length)}), acima de ` +
        `${(limiares.taxaDe5xx * 100).toFixed(2)}%.`,
    })
  }

  // 4. Silêncio no cadastro.
  //
  // Só entre o primeiro e o último cadastro da janela. Antes do primeiro o
  // evento não começou; depois do último, acabou — e alertar sobre qualquer um
  // dos dois é acordar alguém para dizer que a noite está quieta.
  const cadastros = registros
    .filter((r) => r.evento === 'inscricao.cadastro' && r.resultado === 'sucesso')
    .map((r) => Date.parse(r.instante))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)

  const limiteMs = limiares.silencioDeCadastroMinutos * 60_000

  for (let i = 1; i < cadastros.length; i += 1) {
    const intervalo = (cadastros[i] ?? 0) - (cadastros[i - 1] ?? 0)
    if (intervalo < limiteMs) continue

    alertas.push({
      nome: 'cadastro_silencioso',
      gravidade: 'atencao',
      detalhe:
        `${String(Math.round(intervalo / 60_000))} minutos sem nenhum cadastro concluído, ` +
        `a partir de ${new Date(cadastros[i - 1] ?? 0).toISOString()}.`,
    })
    break
  }

  return alertas
}
