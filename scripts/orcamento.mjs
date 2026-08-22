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
 */

const TETO_GZIP_KB = 150

const alvo = process.argv[2] ?? process.env['ORCAMENTO_URL'] ?? 'http://localhost:3000'

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

async function principal() {
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

  console.log(`Primeiro carregamento de ${alvo}, cache vazio:\n`)

  for (const [nome, m] of [...linhas].sort((a, b) => b[1].gzip - a[1].gzip)) {
    console.log(`${kb(m.bruto)} KB  ${kb(m.gzip)} KB gzip  ${kb(m.brotli)} KB br   ${nome}`)
  }

  console.log('-'.repeat(72))
  console.log(
    `${kb(total.bruto)} KB  ${kb(total.gzip)} KB gzip  ${kb(total.brotli)} KB br   ` +
      `TOTAL (${String(linhas.length)} recursos)`,
  )

  const tetoBytes = TETO_GZIP_KB * 1024
  const folga = ((tetoBytes - total.gzip) / 1024).toFixed(1)

  console.log('')

  if (total.gzip > tetoBytes) {
    console.error(
      `ACIMA DO ORÇAMENTO: ${(total.gzip / 1024).toFixed(1)} KB gzip contra o teto de ` +
        `${String(TETO_GZIP_KB)} KB. Faltam ${String(-folga)} KB para caber.`,
    )
    process.exit(1)
  }

  console.log(`Dentro do orçamento: teto de ${String(TETO_GZIP_KB)} KB gzip, folga de ${folga} KB.`)
}

principal().catch((erro) => {
  console.error('Falha ao medir o orçamento:', erro)
  process.exit(1)
})
