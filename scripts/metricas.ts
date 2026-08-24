import { readFileSync } from 'node:fs'
import {
  avaliarAlertas,
  janelaDe,
  lerRegistros,
  relatorioDeProduto,
  relatorioTecnico,
  LIMIARES_PADRAO,
  type Alerta,
  type RelatorioDeProduto,
  type RelatorioTecnico,
} from '@/shared/metricas'
import { lerArgumentos, presente, texto } from '@/shared/argumentos'

/**
 * Relatório de métricas a partir do log (T16 §3, §4 e §6).
 *
 * ```
 * npm run metricas -- --arquivo evento.log
 * npm run dev 2> /dev/null | npm run metricas          # ao vivo, pelo cano
 * npm run metricas -- --arquivo evento.log --inscritos 2000
 * npm run metricas -- --arquivo evento.log --json
 * ```
 *
 * **Existe porque o provedor ainda não foi escolhido** (PE-05), e a métrica que
 * só existe no painel de um serviço que ainda não se contratou é uma métrica
 * que ninguém conferiu. O log já sai em JSON por linha desde T05; isto é a
 * leitura dele, e continua valendo depois que houver agregador — muda de onde
 * vem o texto, não o que ele quer dizer.
 *
 * **Sai com código 1 se algum alerta disparar.** É o gancho que T19 pendura num
 * agendador: um comando que falha é algo que qualquer plataforma sabe notificar,
 * sem integração nenhuma.
 */

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(2)}%`)
const num = (v: number): string => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

function lerEntrada(arquivo: string | null): string {
  if (arquivo !== null) return readFileSync(arquivo, 'utf8')

  try {
    // Descritor 0 é a entrada padrão. Sem cano e sem `--arquivo`, isto lança —
    // e a mensagem abaixo é mais útil do que um rastro de pilha.
    return readFileSync(0, 'utf8')
  } catch {
    console.error(
      'Nada na entrada. Use --arquivo <caminho> ou encane o log:\n' +
        '  cat evento.log | npm run metricas',
    )
    process.exit(1)
  }
}

/** `≥ 95%` ao lado do número medido: a meta do PRD sem precisar consultá-lo. */
function contra(valor: number | null, meta: string, atingiu: boolean | null): string {
  if (valor === null) return `${meta}  (sem amostra)`
  return `${meta}  ${atingiu === null ? '' : atingiu ? '✓' : '✗'}`
}

function imprimirTecnico(r: RelatorioTecnico): void {
  console.log('\n── Métricas técnicas (T16 §3) ───────────────────────────────')

  if (r.janela === null) {
    console.log('  Nenhum registro na entrada.')
    return
  }

  console.log(`  janela            ${r.janela.de.toISOString()} → ${r.janela.ate.toISOString()}`)
  console.log(
    `                    ${num(r.janela.minutos)} minuto(s), ${num(r.registros)} registro(s)`,
  )

  console.log('\n  latência por evento (ms)')
  console.log(
    `    ${'evento'.padEnd(34)} ${'n'.padStart(7)} ${'p50'.padStart(7)} ${'p95'.padStart(7)} ${'p99'.padStart(7)} ${'máx'.padStart(7)}`,
  )

  for (const l of r.latencia) {
    console.log(
      `    ${l.evento.padEnd(34)} ${String(l.amostras).padStart(7)} ${String(l.p50).padStart(7)} ` +
        `${String(l.p95).padStart(7)} ${String(l.p99).padStart(7)} ${String(l.max).padStart(7)}`,
    )
  }

  console.log('')
  console.log(
    `  erros 5xx         ${String(r.erros5xx.total)} (${pct(r.erros5xx.taxa)}), ${num(r.erros5xx.porMinuto)}/min`,
  )
  console.log(
    `  respostas 429     ${String(r.limitadas429.total)}, ${num(r.limitadas429.porMinuto)}/min`,
  )
  console.log(
    `  revalidação 304   ${String(r.revalidacaoDaClassificacao.revalidacoes)} de ` +
      `${String(r.revalidacaoDaClassificacao.leituras)} leituras (${pct(r.revalidacaoDaClassificacao.taxa)})`,
  )
  console.log(
    '                    não é a taxa de acerto da borda — essa não chega ao servidor (T19)',
  )
}

function imprimirProduto(r: RelatorioDeProduto): void {
  console.log('\n── Métricas de produto (PRD §7) ─────────────────────────────')

  const { cadastro, lancamentos, classificacao, responsavel } = r

  console.log(
    `  conclusão cadastro  ${pct(cadastro.taxaDeConclusao)}  ` +
      `(${String(cadastro.concluidos)} de ${String(cadastro.aberturas)} aberturas)  ` +
      contra(
        cadastro.taxaDeConclusao,
        'meta ≥ 95%',
        cadastro.taxaDeConclusao === null ? null : cadastro.taxaDeConclusao >= 0.95,
      ),
  )
  console.log(
    `  tempo de cadastro   ${cadastro.medianaDeSegundos === null ? '—' : `${num(cadastro.medianaDeSegundos)} s`} (mediana)  ` +
      contra(
        cadastro.medianaDeSegundos,
        'meta ≤ 90 s',
        cadastro.medianaDeSegundos === null ? null : cadastro.medianaDeSegundos <= 90,
      ),
  )
  console.log(
    `  correções           ${pct(lancamentos.taxaDeCorrecao)}  ` +
      `(${String(lancamentos.correcoes)} de ${String(lancamentos.registros + lancamentos.correcoes)})  ` +
      contra(
        lancamentos.taxaDeCorrecao,
        'meta ≤ 1%',
        lancamentos.taxaDeCorrecao === null ? null : lancamentos.taxaDeCorrecao <= 0.01,
      ),
  )
  console.log(
    `  leituras/inscrito   ${classificacao.porInscrito === null ? '—' : num(classificacao.porInscrito)}  ` +
      `(${String(classificacao.leituras)} leituras)  ` +
      contra(
        classificacao.porInscrito,
        'meta ≥ 2',
        classificacao.porInscrito === null ? null : classificacao.porInscrito >= 2,
      ),
  )
  console.log(
    `  recusa responsável  ${pct(responsavel.taxaSobreAberturas)}  ` +
      `(${String(responsavel.recusasNoBlocoDoResponsavel)} de ${String(responsavel.recusas)} recusas 422)  ` +
      contra(
        responsavel.taxaSobreAberturas,
        'meta ≤ 10%',
        responsavel.taxaSobreAberturas === null ? null : responsavel.taxaSobreAberturas <= 0.1,
      ),
  )

  if (classificacao.porInscrito === null) {
    console.log(
      '\n  Para leituras/inscrito, passe --inscritos N (o log conta leituras, não pessoas).',
    )
  }

  console.log(
    '\n  Uso da busca por nome (meta ≥ 30%): **não medido, e não mensurável daqui**.\n' +
      '  A busca da Classificação roda inteira no navegador, sobre o documento já\n' +
      '  carregado — por isso ela não gasta rede, e por isso o servidor não a vê.\n' +
      '  Medir exigiria telemetria do navegador, que D-33 tirou do sistema. Ver T21.',
  )
}

function imprimirAlertas(alertas: readonly Alerta[]): void {
  console.log('\n── Alertas (T16 §6) ─────────────────────────────────────────')

  if (alertas.length === 0) {
    console.log('  Nenhum limiar ultrapassado na janela analisada.')
    return
  }

  for (const a of alertas) {
    console.log(`  [${a.gravidade.toUpperCase()}] ${a.nome}\n      ${a.detalhe}`)
  }
}

function principal(): void {
  const argumentos = lerArgumentos(process.argv.slice(2))

  if (presente(argumentos, 'ajuda')) {
    console.log(`
Relatório de métricas a partir do log estruturado (T16).

  npm run metricas -- --arquivo <caminho>   lê de um arquivo
  cat evento.log | npm run metricas         lê da entrada padrão
  --inscritos N                             denominador de leituras/inscrito
  --json                                    saída legível por máquina

Sai com código 1 se algum alerta de T16 §6 disparar.
`)
    return
  }

  const bruto = lerEntrada(texto(argumentos, 'arquivo'))
  const registros = lerRegistros(bruto)

  const inscritosTexto = texto(argumentos, 'inscritos')
  const inscritos = inscritosTexto === null ? undefined : Number(inscritosTexto)

  const tecnico = relatorioTecnico(registros)
  const produto = relatorioDeProduto(registros, { inscritos })
  const alertas = avaliarAlertas(registros)

  if (presente(argumentos, 'json')) {
    console.log(
      JSON.stringify(
        { janela: janelaDe(registros), tecnico, produto, alertas, limiares: LIMIARES_PADRAO },
        null,
        2,
      ),
    )
  } else {
    imprimirTecnico(tecnico)
    imprimirProduto(produto)
    imprimirAlertas(alertas)
    console.log('')
  }

  // Código de saída é a integração mais portátil que existe: qualquer
  // agendador sabe notificar um comando que falhou, sem precisar de webhook.
  if (alertas.length > 0) process.exit(1)
}

principal()
