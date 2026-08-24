import { expect, test, type Locator, type Page } from '@playwright/test'
import { CORREDORES_DE_ENSAIO, OPERADORA, SOBRENOME_DE_ENSAIO } from './apoio/dados'

/**
 * O painel do Operador, com um navegador de verdade (T17).
 *
 * **Estes são os casos que a suíte de integração não alcança.** Ela prova que o
 * endpoint grava; não prova que a gravação exigiu confirmação na tela (RF-18),
 * nem que o Operador conseguiu chegar até ela sem tirar a mão do teclado
 * (RF-19). As duas coisas são sobre a interface, e só um navegador responde.
 */

/**
 * Vigia de mouse.
 *
 * RF-19 pede cinco lançamentos "apenas com teclado", e a forma preguiçosa de
 * verificar isso é não chamar `click()` e confiar. Este script instala um
 * contador antes de a página carregar: se o ponteiro for usado, o teste sabe —
 * inclusive por um `click()` distraído acrescentado meses depois por alguém que
 * não leu este comentário.
 *
 * **`click` não conta, e essa distinção é a parte que importa.** A primeira
 * versão contava `click` junto e acusou seis eventos numa execução em que o
 * mouse não foi tocado: `Enter` num botão focado **ativa** o botão, e o
 * navegador emite um `click` com `isTrusted` verdadeiro. Ou seja, `click` não é
 * evento de mouse — é evento de ativação, e o teclado o dispara por desenho.
 * Contá-lo tornaria impossível passar em RF-19 justamente operando por teclado.
 *
 * O que denuncia o ponteiro de verdade são `pointerdown`, `mousedown` e
 * `mouseup`, que só existem quando há um ponteiro. E, por precaução, um `click`
 * com `detail` maior que zero: ativação por teclado traz `detail` zero; clique
 * de mouse traz a contagem de cliques.
 */
async function vigiarMouse(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const janela = window as unknown as { __mouse: number }
    janela.__mouse = 0

    const contar = (evento: Event): void => {
      const ehCliqueDeMouse = evento.type === 'click' && (evento as MouseEvent).detail > 0

      if (evento.type !== 'click' || ehCliqueDeMouse) janela.__mouse += 1
    }

    for (const tipo of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      window.addEventListener(tipo, contar, { capture: true })
    }
  })
}

const eventosDeMouse = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __mouse: number }).__mouse)

const campoDeBusca = (page: Page): Locator => page.getByLabel(/buscar na fila/i)
const itensDaFila = (page: Page): Locator => page.locator('ul li button')

/**
 * Espera a Fila **filtrada** chegar antes de qualquer tecla que a use.
 *
 * O erro que esta função existe para impedir custou a primeira execução inteira
 * da suíte: a busca da Fila é do **servidor**, e o Enter no campo seleciona
 * `itens[indice]` da lista que estiver em memória naquele instante. Digitar e
 * apertar Enter em seguida seleciona a primeira pendente da lista **anterior**
 * — outra pessoa, com outro nome, e um teste que falha dizendo que o campo de
 * tempo de Alice não existe quando o que existe é o campo de tempo de outra.
 *
 * Esperar a linha certa aparecer não bastaria: ela aparece enquanto a lista
 * antiga ainda está lá. O que prova que o filtro chegou é a **quantidade**.
 */
async function esperarFila(page: Page, quantidade: number): Promise<void> {
  await expect(itensDaFila(page)).toHaveCount(quantidade)
}

/** Entra no painel. Não faz parte de nenhum requisito: é a precondição. */
async function entrar(page: Page): Promise<void> {
  await page.goto('/painel/login')

  await page.getByLabel('Usuário').fill(OPERADORA.usuario)
  await page.getByLabel('Senha').fill(OPERADORA.senha)
  await page.getByRole('button', { name: /entrar/i }).press('Enter')

  await expect(campoDeBusca(page)).toBeVisible()
}

test.describe('painel do Operador', () => {
  test.beforeEach(async ({ page }) => {
    await vigiarMouse(page)
  })

  test('RF-11 — painel sem sessão é bloqueado', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/painel')

    await expect(page).toHaveURL(/\/painel\/login/)

    // Pelo campo de busca, e não pelo título: a tela de login tem o **mesmo**
    // `<h1>` "Painel do Operador", e a primeira versão deste teste passou a
    // impressão de conferir alguma coisa enquanto só confirmava que um cabeçalho
    // existe nas duas telas. O que não pode aparecer sem sessão é a Fila.
    await expect(campoDeBusca(page)).toBeHidden()
    await expect(page.getByLabel('Senha')).toBeVisible()
  })

  test('RF-18 — nenhuma gravação sem a etapa de confirmação', async ({ page }) => {
    await entrar(page)

    const alvo = CORREDORES_DE_ENSAIO[0]!.nome

    await campoDeBusca(page).fill(alvo)
    await esperarFila(page, 1)
    await campoDeBusca(page).press('Enter')

    await expect(page.getByLabel(new RegExp(`tempo de ${alvo}`, 'i'))).toBeFocused()
    await page.keyboard.type('012345')
    await page.keyboard.press('Enter')

    // A confirmação aparece com o nome em destaque, e **nada foi gravado
    // ainda**: o Esc abaixo desfaz tudo, e a pessoa continua pendente na Fila.
    const dialogo = page.getByRole('dialog', { name: 'Confirmar lançamento' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo.getByText(new RegExp(alvo))).toBeVisible()
    await expect(dialogo.getByText('01:23.45')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()

    // A prova de que o Esc não gravou: depois de recarregar, a pessoa segue
    // pendente e a Fila volta a oferecê-la. Um teste que só verificasse o
    // diálogo sumindo passaria mesmo que a gravação tivesse acontecido antes
    // de ele aparecer.
    await page.reload()
    await campoDeBusca(page).fill(alvo)
    await esperarFila(page, 1)
    await expect(itensDaFila(page).first()).toContainText(alvo)
  })

  test('RF-19 e RF-20 — cinco lançamentos seguidos, só com teclado', async ({ page }) => {
    await entrar(page)

    const busca = campoDeBusca(page)

    // O único momento em que o teste toca no campo por API: focar sem clicar.
    // Daqui em diante é teclado puro.
    await busca.focus()

    for (const [posicao, corredor] of CORREDORES_DE_ENSAIO.entries()) {
      // **A busca é redigitada a cada volta, e não é desperdício de teclas.**
      // Gravar limpa o campo — é metade do que RF-20 pede —, e a Fila volta
      // sem filtro. Esta é a sequência que o Operador de fato executa cinco
      // vezes seguidas, e escrevê-la de outro jeito testaria um fluxo que não
      // existe. A primeira versão deste teste digitou uma vez só e selecionou,
      // na segunda volta, a primeira pendente da fila inteira: outra pessoa.
      await page.keyboard.type(SOBRENOME_DE_ENSAIO)

      // A cada volta a Fila tem uma pessoa a menos: quem acabou de receber
      // tempo sai dela. Esperar a contagem certa é o que garante que o Enter
      // abaixo age sobre a lista já filtrada, e não sobre a anterior.
      await esperarFila(page, CORREDORES_DE_ENSAIO.length - posicao)
      await expect(itensDaFila(page).first()).toContainText(corredor.nome)

      // Enter na busca seleciona o primeiro da lista. Como cada lançamento tira
      // a pessoa da Fila, o primeiro da vez seguinte é o próximo da ordem de
      // inscrição — e é por isso que o preparo dá instantes crescentes a eles.
      await page.keyboard.press('Enter')

      await expect(page.getByLabel(new RegExp(`tempo de ${corredor.nome}`, 'i'))).toBeFocused()

      await page.keyboard.type(`012${String(posicao)}00`)
      await page.keyboard.press('Enter')

      const dialogo = page.getByRole('dialog', { name: 'Confirmar lançamento' })
      await expect(dialogo).toBeVisible()
      await page.keyboard.press('Enter')
      await expect(dialogo).toBeHidden()

      // RF-20, por inteiro e sem nenhuma ação de mouse: campos limpos — a busca
      // esvaziada e o campo de tempo fora da tela — e foco devolvido à busca,
      // pronto para o próximo da fila.
      await expect(busca).toBeFocused()
      await expect(busca).toHaveValue('')
      await expect(page.getByLabel(/^tempo de/i)).toBeHidden()
    }

    // Nenhum dos cinco continua pendente. A Fila sem filtro ainda traz a massa
    // do seed, então a conferência é pelo nome, não pela contagem.
    await page.keyboard.type(SOBRENOME_DE_ENSAIO)
    await esperarFila(page, 0)

    expect(await eventosDeMouse(page)).toBe(0)
  })
})
