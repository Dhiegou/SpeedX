import { expect, test, type Page } from '@playwright/test'

/**
 * A troca de tema, do clique até a página seguinte (PRD-front §5.1).
 *
 * **O que só um navegador de verdade prova.** Os testes de unidade cobrem o
 * cookie e a rota; o que eles não alcançam é a cadeia inteira — o formulário
 * envia sem uma linha de JavaScript, o servidor devolve um 303, o navegador
 * segue com GET, e a página volta já pintada. Esse "já pintada" é o critério de
 * aceitação que diz **nenhuma piscada no primeiro carregamento**, e ele não
 * existe fora do navegador.
 *
 * **E a persistência entre páginas não é detalhe.** As páginas públicas navegam
 * por âncora comum, não pelo `Link` do Next — os 4,7 KB do roteador de cliente
 * não cabem no orçamento —, então toda navegação é recarga completa. Um tema
 * guardado em memória morreria no primeiro clique entre a inscrição e a
 * classificação, e o botão pareceria funcionar em toda tela onde alguém o
 * testasse sem sair do lugar.
 */

const tema = async (page: Page): Promise<string | null> =>
  page.locator('html').getAttribute('data-tema')

test.describe('o tema escolhido acompanha a pessoa', () => {
  test('abre no claro, sem depender do sistema operacional', async ({ page }) => {
    await page.goto('/')

    // Não é `prefers-color-scheme`: a maioria deixa o aparelho no escuro, mas
    // essa preferência foi formada dentro de casa, e o evento é ao ar livre.
    expect(await tema(page)).toBe('claro')
  })

  test('o botão troca o tema e a escolha sobrevive à navegação', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Trocar para o tema escuro' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro')
    // Voltou para a mesma página, e não para a raiz: o formulário manda de onde
    // veio, e quem perde o lugar ao trocar de tema não troca de tema.
    expect(new URL(page.url()).pathname).toBe('/')

    // Pelo cabeçalho, e não por qualquer link de mesmo nome: a Classificação
    // tem um caminho de volta no rodapé, e é a navegação principal que está
    // sendo exercitada aqui.
    const navegacao = page.getByRole('navigation', { name: 'Navegação principal' })

    await navegacao.getByRole('link', { name: 'Classificação' }).click()
    expect(await tema(page)).toBe('escuro')

    await navegacao.getByRole('link', { name: 'Inscrição' }).click()
    expect(await tema(page)).toBe('escuro')
  })

  test('o tema vem no HTML, e não depois — é o que impede a piscada', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Trocar para o tema escuro' }).click()

    // A prova de que ninguém aplica o tema no cliente: o HTML **cru**, antes de
    // qualquer script rodar, já traz o atributo. Com `localStorage` isto seria
    // impossível — o servidor não teria como saber, e o conserto seria um
    // script bloqueante no `<head>`.
    const resposta = await page.request.get('/classificacao')

    expect(await resposta.text()).toContain('data-tema="escuro"')
  })

  test('o botão volta ao claro, e o caminho de ida e volta é o mesmo', async ({ page }) => {
    await page.goto('/classificacao')
    await page.getByRole('button', { name: 'Trocar para o tema escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro')

    await page.getByRole('button', { name: 'Trocar para o tema claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro')
    expect(new URL(page.url()).pathname).toBe('/classificacao')
  })
})
