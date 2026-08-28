import { expect, test, type Page } from '@playwright/test'

/**
 * O cadastro público, com um navegador de verdade (T17).
 *
 * A suíte de integração já prova que o endpoint recusa idade 12 e exige o bloco
 * do Responsável. O que ela não alcança é o **formulário**: se o bloco aparece
 * ao digitar 17 e some ao corrigir para 18, e se a confirmação mostra o que a
 * pessoa acabou de enviar. RF-05, RF-07 e RF-10 são sobre a tela.
 */

const ADULTA = {
  nome: 'Ondina',
  sobrenome: 'Peçanha',
  email: 'ondina@exemplo.test',
  telefone: '11944440001',
  idade: '31',
}

async function preencherBase(page: Page, dados = ADULTA): Promise<void> {
  await page.getByLabel('Nome', { exact: true }).fill(dados.nome)
  await page.getByLabel('Sobrenome', { exact: true }).fill(dados.sobrenome)
  await page.getByLabel('E-mail').fill(dados.email)
  await page.getByLabel('Telefone com DDD').fill(dados.telefone)
  await page.getByLabel('Idade').fill(dados.idade)
}

const blocoDoResponsavel = (page: Page) => page.getByLabel('Nome do responsável', { exact: true })

test.describe('cadastro público', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Inscrição na corrida' })).toBeVisible()
  })

  test('RF-02 — os seis campos estão na tela e são obrigatórios', async ({ page }) => {
    for (const rotulo of ['Nome', 'Sobrenome', 'E-mail', 'Telefone com DDD', 'Idade']) {
      await expect(page.getByLabel(rotulo, { exact: true })).toBeVisible()
    }

    // O sexto é a escolha de pista, que é caixa e não campo de texto.
    await expect(page.getByLabel('Cockpit 1')).toBeVisible()
    await expect(page.getByLabel('Cockpit 2')).toBeVisible()
  })

  test('RF-05 — o bloco do Responsável aparece em 13 e 17, e não em 18 e 19', async ({ page }) => {
    // As quatro idades que o PRD nomeia, na mesma tela, sem recarregar: é a
    // sequência que uma pessoa indecisa de fato produz ao corrigir a idade.
    await page.getByLabel('Idade').fill('13')
    await expect(blocoDoResponsavel(page)).toBeVisible()

    await page.getByLabel('Idade').fill('17')
    await expect(blocoDoResponsavel(page)).toBeVisible()

    await page.getByLabel('Idade').fill('18')
    await expect(blocoDoResponsavel(page)).toBeHidden()

    await page.getByLabel('Idade').fill('19')
    await expect(blocoDoResponsavel(page)).toBeHidden()
  })

  test('RF-07 — corrigir a idade de menor para maior descarta o Responsável', async ({ page }) => {
    await preencherBase(page, { ...ADULTA, idade: '15' })

    await blocoDoResponsavel(page).fill('Fantasma')
    await page.getByLabel('Sobrenome do responsável').fill('Descartado')
    await page.getByLabel('Telefone do responsável').fill('11944440002')

    await page.getByLabel('Idade').fill('18')
    await expect(blocoDoResponsavel(page)).toBeHidden()

    // A prova de que foi **descartado** e não apenas escondido: voltar a menor
    // traz o bloco de volta vazio. Um campo que reaparece preenchido é um dado
    // que teria viajado junto com o envio.
    await page.getByLabel('Idade').fill('15')
    await expect(blocoDoResponsavel(page)).toBeVisible()
    await expect(blocoDoResponsavel(page)).toHaveValue('')
  })

  test('RF-03 — enviar sem escolher pista é recusado', async ({ page }) => {
    await preencherBase(page)
    await page.getByRole('checkbox', { name: /li e entendi/i }).check()

    await page.getByRole('button', { name: /concluir|enviar|inscrever/i }).click()

    // Pelo texto, e não por `role=alert`: o Next mantém um anunciador de rota
    // com esse mesmo papel em toda página, e um seletor por papel encontra os
    // dois. O que interessa é o resumo de erros do formulário.
    await expect(page.getByText(/faltou corrigir/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Inscrição concluída' })).toBeHidden()
  })

  test('RF-08 — enviar sem o aceite do termo é recusado', async ({ page }) => {
    await preencherBase(page)
    await page.getByLabel('Cockpit 1').check()

    await page.getByRole('button', { name: /concluir|enviar|inscrever/i }).click()

    // Pelo texto, e não por `role=alert`: o Next mantém um anunciador de rota
    // com esse mesmo papel em toda página, e um seletor por papel encontra os
    // dois. O que interessa é o resumo de erros do formulário.
    await expect(page.getByText(/faltou corrigir/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Inscrição concluída' })).toBeHidden()
  })

  test('RF-10 — a confirmação mostra o nome e as pistas enviadas', async ({ page }) => {
    await preencherBase(page)
    await page.getByLabel('Cockpit 1').check()
    await page.getByLabel('Cockpit 2').check()
    await page.getByRole('checkbox', { name: /li e entendi/i }).check()

    await page.getByRole('button', { name: /concluir|enviar|inscrever/i }).click()

    await expect(page.getByRole('heading', { name: 'Inscrição concluída' })).toBeVisible()
    await expect(page.getByText(`${ADULTA.nome} ${ADULTA.sobrenome}`)).toBeVisible()
    await expect(page.getByText('Cockpit 1 e Cockpit 2')).toBeVisible()
  })
})
