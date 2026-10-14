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

  test('RNF-18 — o termo não rola de lado em 360 px', async ({ page }) => {
    // A quinta página. Ela entrou nesta lista quando o cabeçalho passou a
    // carregar o logotipo de verdade: o bloqueio da marca tem 200 px de largura
    // mínima — 56% de uma tela de 360 — e é o elemento mais largo do site.
    await conferir(page, '/termo')
  })

  test('RNF-18 — o bloqueio da marca cabe, e o selo continua legível', async ({ page }) => {
    await page.goto('/')

    // Os dois lados da mesma decisão. Abaixo de 200 px o "POWERED BY" do selo
    // deixa de ser legível e o selo não vale estar ali; acima da largura da
    // tela, a página anda de lado. O intervalo é estreito de propósito, e é o
    // motivo de os links de navegação irem **abaixo** do logotipo no celular.
    const bloco = page.locator('header a[aria-label*="SpeedX"]').first()
    const caixa = await bloco.boundingBox()

    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(200)
    expect(await excedente(page)).toBe(0)
  })

  test('RNF-18 — o painel do Operador cabe em 360 px', async ({ page }) => {
    // Sem sessão a rota manda para o login, e é ele que aparece em 360 px. Vale
    // como caso: o login é a primeira tela que um Operador com tablet estreito
    // encontra, e um campo de senha fora da tela trava o evento antes de começar.
    await conferir(page, '/painel')
  })
})

/**
 * O que 360 px faz com a **linha** da tabela, e não só com a largura da página.
 *
 * A suíte acima prova que nada rola de lado. Isso é necessário e não é
 * suficiente: a página pode caber na largura e ainda assim repartir mal o que
 * cabe. Foi o que estava acontecendo — medido no navegador, a tabela tinha 336
 * px divididos em posição 52, nome 109, Cockpit 81 e tempo 93, e **as 56 linhas
 * quebravam em duas, todas**, porque o nome recebia um terço da largura.
 *
 * O nome é o alvo da varredura desta página inteira. Parti-lo ao meio dobra a
 * rolagem de quem procura e desfaz a hierarquia que a tabela declara.
 */
test.describe('RNF-18 — a linha cabe na linha', () => {
  test('o nome não parte em duas, e o Cockpit continua dito', async ({ page }) => {
    await page.goto('/classificacao')
    await page.waitForLoadState('networkidle')

    const medidas = await page.evaluate(() => {
      const linhas = [...document.querySelectorAll('tbody tr')].slice(0, 20)

      return linhas.map((linha) => {
        const nome = linha.querySelectorAll('td')[1]
        // O nó de texto do nome, sem a etiqueta do Cockpit que vem depois dele.
        const texto = [...(nome?.childNodes ?? [])].find((n) => n.nodeType === Node.TEXT_NODE)
        const faixa = document.createRange()
        if (texto !== undefined) faixa.selectNode(texto)

        return {
          altura: Math.round(linha.getBoundingClientRect().height),
          // Mais de um retângulo quer dizer mais de uma linha de texto.
          linhasDoNome: texto === undefined ? 0 : faixa.getClientRects().length,
        }
      })
    })

    expect(medidas.length).toBeGreaterThan(5)

    for (const medida of medidas) {
      expect(medida.linhasDoNome, 'o nome ocupou mais de uma linha').toBe(1)
      expect(medida.altura, 'a linha cresceu além do previsto').toBeLessThan(70)
    }

    // A coluna sai da tela pequena; o dado, não. Ele passa a ser a etiqueta
    // miúda embaixo do nome — e continua existindo para quem lê e para quem ouve.
    await expect(page.locator('tbody tr').first()).toContainText(/Cockpit [12]/)
  })

  test('nenhum dos dois Cockpits quebra em duas linhas', async ({ page }) => {
    await page.goto('/')

    // Com recuo lateral de 1rem sobravam uns noventa pixels de texto por caixa,
    // e "Cockpit 2" quebrava em duas linhas enquanto "Cockpit 1" cabia — porque
    // o dígito 2 é alguns pixels mais largo que o 1. Duas caixas irmãs com
    // alturas diferentes por causa de um dígito.
    // Medido no nó de texto, e não na altura da caixa: `min-height` esconde a
    // quebra enquanto ela couber nos 56 px, e um teste de altura passaria sem
    // provar nada. Mais de um retângulo é mais de uma linha, e é o defeito.
    const linhas = await page.evaluate(() =>
      [...document.querySelectorAll('label')]
        .filter(
          (l) =>
            l.querySelector('input') !== null && (l.textContent ?? '').trim().startsWith('Cockpit'),
        )
        .map((l) => {
          const texto = [...l.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)
          const faixa = document.createRange()
          if (texto !== undefined) faixa.selectNode(texto)
          return texto === undefined ? 0 : faixa.getClientRects().length
        }),
    )

    expect(linhas.length).toBe(2)
    expect(linhas, 'um dos Cockpits quebrou em duas linhas').toEqual([1, 1])
  })

  test('a etiqueta do aceite fica acima do texto, e não colada nele', async ({ page }) => {
    await page.goto('/')

    // Como `inline-block`, etiqueta e texto são dois `<span>` irmãos na mesma
    // linha, e a tela mostrava "OBRIGATÓRIOLi e entendi este termo.". A caixa
    // opcional escapava por acidente, com um rótulo longo o bastante para
    // encher a linha sozinho — o que fazia o defeito parecer caso isolado.
    const caixas = await page.evaluate(() => {
      const aceites = [...document.querySelectorAll('label')].filter(
        (l) =>
          l.querySelector('input[type="checkbox"]') !== null && l.textContent?.includes('termo'),
      )

      return aceites.map((aceite) => {
        const spans = [...aceite.querySelectorAll('span > span')]
        const etiqueta = spans[0]?.getBoundingClientRect()
        const texto = spans[1]?.getBoundingClientRect()

        return { fundoDaEtiqueta: etiqueta?.bottom ?? 0, topoDoTexto: texto?.top ?? 0 }
      })
    })

    expect(caixas.length).toBeGreaterThan(0)

    for (const caixa of caixas) {
      expect(caixa.topoDoTexto).toBeGreaterThanOrEqual(caixa.fundoDaEtiqueta)
    }
  })
})
