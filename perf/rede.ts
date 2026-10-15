import { chromium, type Browser } from '@playwright/test'

/**
 * RNF-04 medido em **tempo**, que é a unidade em que ele está escrito.
 *
 * `npm run orcamento` mede bytes, e mede porque byte é o que dá para controlar
 * daqui. Só que RNF-04 não fala em bytes: fala em **três segundos para a
 * página de cadastro carregar em rede móvel lenta**. Até 2026-10-14 esse número
 * nunca tinha sido medido — ele vinha sendo inferido do peso, e peso não é
 * tempo. Latência, número de requisições e a CPU do aparelho entram na conta, e
 * nenhum dos três aparece numa soma de quilobytes.
 *
 * O item 7 da tarde de ensaios (`docs/o-que-falta-para-voce.md`) continua
 * valendo e pede rede de verdade, com aparelho de verdade. Isto aqui é o que dá
 * para saber **antes**, e serve para o caso que o ensaio não cobre: descobrir
 * numa terça-feira que uma mudança de código dobrou o tempo de pintura.
 *
 * **Três cuidados que a primeira versão desta medição não teve, e que mudaram a
 * conclusão por inteiro:**
 *
 *  1. **A primeira visita a cada rota mede o servidor compilando**, não a rede.
 *     Uma amostra só dava 5,2 s onde a mediana de cinco dá 2,2 s. Daí
 *     `REPETICOES`, e daí mediana em vez de média.
 *  2. **A CPU entra afundada.** O aparelho de um evento aberto não é um
 *     telefone novo, e JavaScript que chega rápido ainda precisa ser executado.
 *  3. **O TTFB daqui é de mentira**, porque o servidor é local. Contra a Vercel
 *     em `gru1` ele sobe. O que esta medição compara bem é uma mudança de
 *     código contra outra, na mesma máquina.
 *
 * Com a aplicação de produção de pé (`npm run build && npm start`):
 *
 *   npm run perf:rede
 */

/** Perfis do DevTools do Chrome. `cpu` é o fator de afundamento. */
const PERFIS = [
  { nome: '3G lento', down: (400 * 1024) / 8, up: (400 * 1024) / 8, rtt: 2000, cpu: 4 },
  { nome: '3G rápido', down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, rtt: 562, cpu: 4 },
  { nome: '4G lento', down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, rtt: 150, cpu: 4 },
] as const

/** As duas que o participante abre. O painel é rede do organizador. */
const ROTAS = ['/', '/classificacao'] as const

const REPETICOES = 5
const ALVO = process.env['PERF_ALVO'] ?? 'http://localhost:3000'

/** O que RNF-04 promete, em milissegundos. */
const META_MS = 3_000

type Amostra = { fcp: number; load: number }

function mediana(valores: readonly number[]): number {
  return [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)] ?? 0
}

async function medir(navegador: Browser, rota: string, perfil: (typeof PERFIS)[number]) {
  const amostras: Amostra[] = []

  for (let i = 0; i < REPETICOES; i += 1) {
    const contexto = await navegador.newContext({ viewport: { width: 360, height: 740 } })
    const pagina = await contexto.newPage()
    const cdp = await contexto.newCDPSession(pagina)

    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: perfil.down,
      uploadThroughput: perfil.up,
      latency: perfil.rtt,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: perfil.cpu })

    await pagina.goto(`${ALVO}${rota}`, { waitUntil: 'load', timeout: 180_000 })

    const medida = await pagina.evaluate(() => {
      const pintura = performance.getEntriesByName('first-contentful-paint')[0]
      const navegacao = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined

      return { fcp: pintura?.startTime ?? 0, load: navegacao?.loadEventEnd ?? 0 }
    })

    if (medida.fcp > 0) amostras.push(medida)
    await contexto.close()
  }

  return {
    fcp: mediana(amostras.map((a) => a.fcp)),
    load: mediana(amostras.map((a) => a.load)),
  }
}

async function principal(): Promise<void> {
  const navegador = await chromium.launch()
  const segundos = (ms: number): string => `${(ms / 1000).toFixed(2)}s`
  let reprovou = false

  console.log(`\nRNF-04 em tempo — ${ALVO}, mediana de ${String(REPETICOES)} medidas, cache vazio`)
  console.log(`Meta: primeira pintura em até ${segundos(META_MS)}.\n`)
  console.log('rota             perfil        primeira pintura   tudo carregado')
  console.log('-'.repeat(68))

  try {
    for (const rota of ROTAS) {
      for (const perfil of PERFIS) {
        const { fcp, load } = await medir(navegador, rota, perfil)
        const veredito = fcp <= META_MS ? '' : '  FALHOU'
        if (fcp > META_MS) reprovou = true

        console.log(
          `${rota.padEnd(17)}${perfil.nome.padEnd(14)}${segundos(fcp).padEnd(19)}${segundos(load)}${veredito}`,
        )
      }
    }
  } finally {
    await navegador.close()
  }

  console.log(
    '\n**Primeira pintura é o que a pessoa sente**: é quando o nome dela já dá para' +
      '\nprocurar na Classificação, que é HTML vindo do servidor e não depende de' +
      '\nJavaScript nenhum. "Tudo carregado" é quando o formulário aceita digitação —' +
      '\nmais tarde, e é o preço do framework.\n',
  )

  if (reprovou) {
    console.error('Alguma rota passou da meta de RNF-04.')
    process.exitCode = 1
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao medir:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
