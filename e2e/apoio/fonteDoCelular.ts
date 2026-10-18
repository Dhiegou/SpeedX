import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test as base, type Page } from '@playwright/test'

/**
 * A fonte do celular, fixada: Roboto, a do Android (D-104).
 *
 * **Por que fixar.** O CSS pede `system-ui`, e quem decide o que isso é é a
 * máquina. No Windows sai Segoe UI; no Ubuntu do CI sai DejaVu Sans, bem mais
 * larga. Os testes de 360 px contam quantas linhas o texto ocupa, então mediam
 * a fonte do computador que rodava a suíte, e não o produto. Foi isso que
 * deixou o e2e vermelho no CI de 14/10 em diante com o site sem defeito: sob
 * DejaVu, "Larissa Pereira" quebrava em duas linhas; sob Roboto e Segoe, não.
 *
 * **Por que Roboto, e não a mais larga.** O projeto `celular-360` diz que
 * representa um Galaxy A, e a fonte de sistema do Galaxy A é a Roboto. Medir
 * com ela é medir o aparelho que vai aparecer no evento.
 *
 * **O que se perde, dito para não ser esquecido.** Com a fonte fixa, o teste
 * não pega mais um texto que só quebra em fonte mais larga que a Roboto, e a
 * SF Pro do iPhone é um pouco mais larga. A SF não é distribuível, então não
 * há como medi-la aqui. Fica para o ensaio com aparelho.
 *
 * **Como.** Depois de cada `page.goto`, a folha de estilo com a Roboto entra
 * na página, e o teste só segue quando os quatro pesos que o CSS usa
 * (400, 600, 700 e 800) estiverem carregados. Navegação por clique não passa
 * por aqui. Os testes de tela pequena não navegam assim.
 */

const FAMILIA = 'Roboto (e2e)'
const PESOS = [400, 600, 700, 800] as const

function arquivo(peso: number): string {
  // Relativo à raiz, como o `loadEnvConfig` do playwright.config.ts: a suíte
  // sempre roda de lá.
  return join(
    process.cwd(),
    'node_modules',
    '@fontsource',
    'roboto',
    'files',
    `roboto-latin-${String(peso)}-normal.woff2`,
  )
}

const FOLHA = [
  ...PESOS.map(
    (peso) =>
      `@font-face{font-family:'${FAMILIA}';font-weight:${String(peso)};font-style:normal;` +
      `src:url(data:font/woff2;base64,${readFileSync(arquivo(peso)).toString('base64')}) format('woff2')}`,
  ),
  `*,*::before,*::after{font-family:'${FAMILIA}' !important}`,
].join('\n')

async function aplicarFonte(page: Page): Promise<void> {
  await page.addStyleTag({ content: FOLHA })

  const carregados = await page.evaluate(
    async ({ familia, pesos }) => {
      await Promise.all(
        pesos.map((peso) => document.fonts.load(`${String(peso)} 16px "${familia}"`)),
      )
      await document.fonts.ready
      return pesos.filter((peso) => document.fonts.check(`${String(peso)} 16px "${familia}"`))
    },
    { familia: FAMILIA, pesos: [...PESOS] },
  )

  // Sem esta conferência, uma fonte que não carregou faria o teste medir a
  // fonte de reserva, e passar ou falhar por acidente.
  expect(carregados, `A Roboto não carregou em todos os pesos (${FAMILIA})`).toEqual([...PESOS])
}

export const test = base.extend({
  // `entregar`, e não `use`: o lint de hooks do React confunde o nome.
  page: async ({ page }, entregar) => {
    const irOriginal = page.goto.bind(page)

    page.goto = async (...argumentos: Parameters<Page['goto']>) => {
      const resposta = await irOriginal(...argumentos)
      await aplicarFonte(page)
      return resposta
    }

    await entregar(page)
  },
})

export { expect, type Page }
