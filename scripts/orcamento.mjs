import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/**
 * Orçamento de peso do primeiro carregamento (T07, RNF-04).
 *
 * `npm run orcamento` — com a aplicação de pé (`npm run build && npm start`).
 *
 * RNF-04 fala em tempo, não em bytes, e tempo depende da rede de quem está na
 * fila. O que dá para controlar deste lado é o peso, e peso sem número é
 * opinião: este script mede o que a raiz realmente manda para um celular novo,
 * com cache vazio, e **falha** se passar do teto. Assim a regressão aparece
 * quando alguém a introduz, e não no dia do evento.
 *
 * O que entra na conta: o HTML da raiz, as folhas de estilo e os scripts que um
 * navegador moderno baixa. O que fica de fora: o pacote de compatibilidade
 * marcado `nomodule`, que celular nenhum dos últimos anos chega a pedir, e tudo
 * o que é carregado depois — o esquema de validação, por exemplo, que só desce
 * enquanto a pessoa digita (D-32).
 *
 * O teto é medido em **gzip**, e não em brotli, de propósito: brotli é o melhor
 * caso e depende da borda estar configurada. Passar no pior caso é a única
 * garantia que sobrevive a uma mudança de hospedagem (PE-05).
 *
 * **O teto era 150 KB e passou a 151 em 2026-10-17, por decisão de quem
 * responde pelo evento (D-106).** Ele não subiu por conveniência. Subiu porque
 * este teto é um substituto do tempo de RNF-04, e o substituto e a medida
 * direta discordaram. `experimental.inlineCss` (next.config.ts) leva a primeira
 * pintura em 3G lento de ~5 s para ~2,5 s, abaixo dos 3 s que RNF-04 promete,
 * e custa o CSS viajar duas vezes: `/classificacao` foi a 150,7 KB e `/termo` a
 * 150,1. Entre o número que representa a promessa e a promessa medida, vale a
 * promessa.
 *
 * **O quilobyte a mais é só desse CSS duplicado.** A folga da Classificação é
 * de 0,3 KB: qualquer outra gordura de front precisa caber nela ou sair de
 * outro lugar. Se `inlineCss` sair, o teto volta a 150.
 */

const TETO_GZIP_KB = 151

/**
 * As rotas públicas, todas elas.
 *
 * **Medir só a raiz escondia meia verdade.** A raiz é o destino do QR e por
 * isso era a página escolhida, mas o teto de RNF-04 vale para toda página que
 * um participante abre — e elas não pesam o mesmo: o termo carrega o texto
 * inteiro do consentimento, e já chegou a 4 KB a mais que a raiz. Uma mudança
 * que estoure o teto no termo e não na raiz passaria por aqui sem ser vista.
 *
 * O login entra porque o Operador também chega por rede, às vezes a do evento.
 */
const ROTAS = ['/', '/classificacao', '/termo', '/painel/login']

const base = process.argv[2] ?? process.env['ORCAMENTO_URL'] ?? 'http://localhost:3000'

/** Com URL de rota na linha de comando, mede só ela; sem, mede todas. */
const alvos = new URL(base).pathname === '/' ? ROTAS.map((r) => new URL(r, base).href) : [base]

function comprimir(buffer) {
  return {
    bruto: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  }
}

/** Scripts que o navegador moderno baixa — os `nomodule` ficam de fora. */
function scriptsDeVerdade(html) {
  return [...html.matchAll(/<script\b([^>]*)>/gi)]
    .filter((tag) => !/\bnomodule\b/i.test(tag[1]))
    .map((tag) => /\bsrc="([^"]+)"/i.exec(tag[1])?.[1])
    .filter((src) => src !== undefined)
}

function folhasDeEstilo(html) {
  return [...html.matchAll(/<link\b([^>]*)>/gi)]
    .filter((tag) => /rel="stylesheet"/i.test(tag[1]))
    .map((tag) => /\bhref="([^"]+)"/i.exec(tag[1])?.[1])
    .filter((href) => href !== undefined)
}

const kb = (n) => (n / 1024).toFixed(1).padStart(7)

/** Mede uma rota e devolve o total comprimido, já tendo impresso o detalhe. */
async function medirRota(alvo) {
  const resposta = await fetch(alvo)

  if (!resposta.ok) {
    throw new Error(`${alvo} respondeu ${String(resposta.status)}. A aplicação está de pé?`)
  }

  const html = await resposta.text()
  const recursos = [...new Set([...folhasDeEstilo(html), ...scriptsDeVerdade(html)])]

  const linhas = [['(html)', comprimir(Buffer.from(html))]]

  for (const caminho of recursos) {
    const url = new URL(caminho, alvo)
    const buffer = Buffer.from(await (await fetch(url)).arrayBuffer())

    linhas.push([caminho.replace('/_next/static/', ''), comprimir(buffer)])
  }

  const total = linhas.reduce(
    (soma, [, m]) => ({
      bruto: soma.bruto + m.bruto,
      gzip: soma.gzip + m.gzip,
      brotli: soma.brotli + m.brotli,
    }),
    { bruto: 0, gzip: 0, brotli: 0 },
  )

  console.log(`\nPrimeiro carregamento de ${alvo}, cache vazio:\n`)

  for (const [nome, m] of [...linhas].sort((a, b) => b[1].gzip - a[1].gzip)) {
    console.log(`${kb(m.bruto)} KB  ${kb(m.gzip)} KB gzip  ${kb(m.brotli)} KB br   ${nome}`)
  }

  console.log('-'.repeat(72))
  console.log(
    `${kb(total.bruto)} KB  ${kb(total.gzip)} KB gzip  ${kb(total.brotli)} KB br   ` +
      `TOTAL (${String(linhas.length)} recursos)`,
  )

  return total.gzip
}

async function principal() {
  const tetoBytes = TETO_GZIP_KB * 1024
  const medidas = []

  for (const alvo of alvos) {
    medidas.push([alvo, await medirRota(alvo)])
  }

  // O veredito é da rota mais pesada: o teto vale para cada página, não para a
  // média delas. Uma página fora do teto é uma página que alguém vai abrir.
  console.log('\n' + '='.repeat(72))
  console.log(`Teto de ${String(TETO_GZIP_KB)} KB gzip, por rota:\n`)

  let estourou = false

  for (const [alvo, gzip] of medidas.sort((a, b) => b[1] - a[1])) {
    const folga = (tetoBytes - gzip) / 1024
    const rota = new URL(alvo).pathname

    if (folga < 0) estourou = true

    console.log(
      `${rota.padEnd(18)}${(gzip / 1024).toFixed(1).padStart(7)} KB gzip   ` +
        (folga < 0
          ? `ACIMA DO TETO por ${(-folga).toFixed(1)} KB`
          : `folga de ${folga.toFixed(1)} KB`),
    )
  }

  console.log('')

  if (estourou) {
    console.error('Alguma rota passou do teto. RNF-04 não admite média.')
    process.exit(1)
  }

  console.log('Todas as rotas dentro do orçamento.')
}

principal().catch((erro) => {
  console.error('Falha ao medir o orçamento:', erro)
  process.exit(1)
})
