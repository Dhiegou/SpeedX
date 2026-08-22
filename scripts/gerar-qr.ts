import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import QRCode from 'qrcode'
import { env } from '@/shared/env'
import { MODULOS_DE_SILENCIO, modulosDoSvg, recomendar } from '@/shared/qr'

/**
 * Gera o QR code do ponto de inscrição (T07, RF-01).
 *
 * `npm run qr`
 *
 * Duas escolhas que não são negociáveis:
 *
 * - **Correção de erro nível H** (recupera ~30% do símbolo). O QR vai para
 *   papel, num evento ao ar livre, colado em superfície que pega sol, chuva,
 *   dedo e dobra. Nível H é o que mantém a leitura com o canto amassado. Custa
 *   mais módulos, e o preço disso é o papel maior calculado abaixo.
 *
 * - **Vetor**. O material vai para gráfica sem que ninguém aqui saiba o
 *   tamanho final. PNG numa resolução escolhida hoje vira serrilhado num banner
 *   amanhã, e serrilhado em QR é falha de leitura.
 *
 * O destino é a `APP_URL`, sem parâmetro nenhum: nada de rastreamento na URL,
 * porque cada caractere a mais empurra o símbolo para uma versão com mais
 * módulos, e módulo menor no mesmo papel é leitura mais difícil (FL-01).
 */

const DESTINO = resolve(process.cwd(), 'docs/qr/inscricao.svg')

/** Distâncias de leitura de cada peça impressa, em centímetros. */
const DISTANCIAS = [
  { cm: 30, peca: 'cartão de mesa, na mão' },
  { cm: 50, peca: 'cartaz A4 no ponto de inscrição' },
  { cm: 100, peca: 'cartaz A3 em pé' },
  { cm: 200, peca: 'banner na grade' },
]

async function principal(): Promise<void> {
  const url = env().APP_URL

  if (url.includes('?')) {
    throw new Error(`APP_URL tem parâmetro de consulta: ${url}. O destino do QR é limpo (FL-01).`)
  }

  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: MODULOS_DE_SILENCIO,
    color: { dark: '#000000', light: '#ffffff' },
  })

  // Destino e data ficam dentro do arquivo. Um QR impresso é indistinguível de
  // outro a olho nu: sem isto, descobrir para onde aponta o cartaz que já está
  // na parede exigiria escanear, e ninguém escaneia o cartaz certo por engano.
  const identificado = svg.replace(
    /(<svg[^>]*>)/,
    `$1<title>Inscrição SpeedX — ${url}</title><desc>Gerado em ${new Date().toISOString().slice(0, 10)}. Correção de erro H.</desc>`,
  )

  mkdirSync(dirname(DESTINO), { recursive: true })
  writeFileSync(DESTINO, identificado)

  const modulos = modulosDoSvg(svg)

  const host = new URL(url).hostname
  const provisorio = host === 'localhost' || host.includes('exemplo') || host.endsWith('.local')

  console.log(`QR gerado: ${DESTINO}`)
  console.log(`Destino:   ${url}`)
  console.log(`Correção:  H (recupera ~30% do símbolo)`)
  console.log(`Módulos:   ${String(modulos)} × ${String(modulos)}, mais 4 de silêncio por lado`)
  console.log('')
  console.log('Tamanho mínimo de impressão (lado do símbolo, já com a área de silêncio):')
  console.log('')

  for (const { cm, peca } of DISTANCIAS) {
    const r = recomendar(cm, modulos)
    const alerta = r.imprimivel ? '' : '  ← módulo pequeno demais, aumente o papel'

    console.log(
      `  ${String(cm).padStart(3)} cm  →  ${r.larguraMm.toFixed(0).padStart(3)} mm` +
        `   (módulo de ${r.moduloMm.toFixed(2)} mm)${alerta}`,
    )
  }

  console.log('')
  console.log('Especificação completa da sinalização impressa: docs/sinalizacao.md')

  if (provisorio) {
    console.log('')
    console.log(`AVISO: ${host} é endereço provisório. Este arquivo não vai para a gráfica.`)
    console.log('Rode de novo com a APP_URL definitiva assim que o domínio existir (PE-05).')
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao gerar o QR code:', erro)
  process.exit(1)
})
