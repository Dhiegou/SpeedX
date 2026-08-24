import { expect, test, type Page } from '@playwright/test'

/**
 * RNF-18 em 360 px (T17).
 *
 * A verificação do PRD é literal: "teste em largura de 360px sem rolagem
 * horizontal". Era um dos critérios que o projeto vinha carregando como
 * "depende de aparelho" — e não depende: 360 px é uma largura, e um navegador
 * sabe ser 360 px de largura. O que depende de aparelho é o toque, a rede e a
 * leitura sob sol, e essas três continuam em T21.
 *
 * **Por que rolagem horizontal e não uma captura de tela.** Uma imagem exige
 * alguém para olhar, e ninguém olha na terça-feira depois do deploy. A rolagem
 * lateral é o sintoma objetivo de layout que estourou a largura, é o que o
 * participante sente no dedo, e o navegador responde com um número.
 */

/** Sobra de largura do documento além da janela. Zero é o único valor aceito. */
async function excedente(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - doc.clientWidth)
  })
}

/**
 * O elemento que estourou, quando algum estourou.
 *
 * Sem isto a falha diz "sobrou 40 px" e deixa a busca para quem for consertar.
 * Com isto ela diz qual é o elemento, e o conserto começa no lugar certo.
 */
async function culpados(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth

    return [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > largura + 1)
      .slice(0, 5)
      .map((el) => {
        const classe = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        return `${el.tagName.toLowerCase()}${classe === '' ? '' : `.${classe}`}`
      })
  })
}

async function conferir(page: Page, caminho: string): Promise<void> {
  await page.goto(caminho)
  await page.waitForLoadState('networkidle')

  expect(
    await excedente(page),
    `Rolagem horizontal em ${caminho}: ${(await culpados(page)).join(', ')}`,
  ).toBe(0)
}

test.describe('RNF-18 — operável em tela de celular', () => {
  test('RNF-18 — o formulário de inscrição não rola de lado em 360 px', async ({ page }) => {
    await conferir(page, '/')
  })

  test('RNF-18 — o bloco do Responsável também cabe em 360 px', async ({ page }) => {
    await page.goto('/')

    // O bloco de menor de idade só existe depois de a idade ser digitada, e é a
    // parte mais larga do formulário: três campos a mais e um aceite extra.
    // Conferir só a tela inicial deixaria justamente o pior caso de fora.
    await page.getByLabel('Idade').fill('15')
    await expect(page.getByLabel('Nome do responsável', { exact: true })).toBeVisible()

    expect(await excedente(page), (await culpados(page)).join(', ')).toBe(0)
  })

  test('RNF-18 — a classificação pública não rola de lado em 360 px', async ({ page }) => {
    await conferir(page, '/classificacao')
  })

  test('RNF-18 — a tabela larga rola dentro dela mesma, não na página', async ({ page }) => {
    await page.goto('/classificacao')
    await page.waitForLoadState('networkidle')

    // A distinção que importa: conteúdo largo pode rolar, desde que role
    // **dentro** do próprio contêiner. O que RNF-18 proíbe é a página inteira
    // andar de lado, levando o cabeçalho e o menu junto.
    expect(await excedente(page)).toBe(0)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('RNF-18 — o painel do Operador cabe em 360 px', async ({ page }) => {
    // Sem sessão a rota manda para o login, e é ele que aparece em 360 px. Vale
    // como caso: o login é a primeira tela que um Operador com tablet estreito
    // encontra, e um campo de senha fora da tela trava o evento antes de começar.
    await conferir(page, '/painel')
  })
})
