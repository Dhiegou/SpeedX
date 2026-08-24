import { expect, test } from '@playwright/test'
import { ADULTA_CLASSIFICADA, MENOR_DE_ENSAIO } from './apoio/dados'

/**
 * A Classificação pública, com um navegador de verdade (T17).
 *
 * O caso central aqui é o **teste de vazamento** que a task nomeia: varrer a
 * resposta pública atrás de e-mail, telefone, idade e sobrenome de menor da
 * massa de ensaio. Ele existe porque RNF-08 e RNF-09 não são propriedades de
 * uma função — são propriedades de **tudo o que chega ao navegador**, incluindo
 * o estado que o React embute na página para hidratar a tabela.
 *
 * Um teste de unidade sobre `paraNomePublico` prova que a função abrevia. Ele
 * não prova que ninguém pôs o telefone num atributo `data-` três meses depois.
 */

test.describe('classificação pública', () => {
  test('RF-26 — abre em sessão anônima, sem cookie nenhum', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/classificacao')

    await expect(page.getByRole('table')).toBeVisible()
    expect(await context.cookies()).toHaveLength(0)
  })

  test('RNF-09 — menor de idade aparece com a inicial do sobrenome', async ({ page }) => {
    await page.goto('/classificacao')
    await page.waitForLoadState('networkidle')

    const inicial = MENOR_DE_ENSAIO.sobrenome.charAt(0)

    await expect(
      page.getByText(`${MENOR_DE_ENSAIO.nome} ${inicial}.`, { exact: false }).first(),
    ).toBeVisible()
  })

  test('RNF-08 e RNF-09 — nada de pessoal chega ao navegador', async ({ page }) => {
    await page.goto('/classificacao')
    await page.waitForLoadState('networkidle')

    // O HTML inteiro, não só o texto visível: o React embute o documento da
    // classificação como JSON na página para hidratar sem uma segunda ida ao
    // servidor. Um campo a mais na projeção apareceria ali, invisível na tela e
    // perfeitamente legível para quem abrir o código-fonte.
    const html = await page.content()

    const proibidos = [
      MENOR_DE_ENSAIO.email,
      MENOR_DE_ENSAIO.telefone,
      MENOR_DE_ENSAIO.responsavel.nome,
      MENOR_DE_ENSAIO.responsavel.telefone,
      // O sobrenome **completo** da menor: RNF-09 revisado em D-21 permite a
      // inicial e proíbe o resto.
      MENOR_DE_ENSAIO.sobrenome,
      // A idade **não** entra nesta lista, e a primeira versão deste teste
      // errou nisso: `15` é uma cadeia de dois dígitos que aparece em qualquer
      // tempo, posição ou identificador de bloco da página. A asserção falhava
      // sempre, e não por vazamento nenhum. Que a idade não trafega é
      // verificado onde a afirmação tem sentido — sobre a forma do documento,
      // no teste de RF-27 abaixo.
      ADULTA_CLASSIFICADA.email,
      ADULTA_CLASSIFICADA.telefone,
    ]

    for (const proibido of proibidos) {
      expect(html, `"${proibido}" apareceu na página pública`).not.toContain(proibido)
    }

    // O contraponto que impede o teste de passar por engano: se a página não
    // tivesse carregado, todas as ausências acima seriam verdadeiras. O
    // sobrenome completo de uma **adulta** é justamente o que RNF-09 permite.
    expect(html).toContain(ADULTA_CLASSIFICADA.sobrenome)
  })

  test('RF-27 — a resposta pública carrega exatamente os campos previstos', async ({ request }) => {
    const resposta = await request.get('/api/classificacao')
    const documento = (await resposta.json()) as Record<string, unknown>

    // Fechado, e não "contém": o risco aqui nunca foi faltar campo, é **sobrar**.
    // Uma propriedade nova na projeção passaria despercebida por qualquer
    // asserção que só verificasse a presença dos esperados.
    expect(Object.keys(documento).sort()).toEqual(['geradoEm', 'linhas', 'total'])

    const linhas = documento.linhas as unknown[]
    const primeira = linhas[0]

    // **Arrays posicionais, e não objetos** (D-57): `["Marina R.",1,83400]`. As
    // chaves repetidas quatro mil vezes custariam mais que os dados, e o
    // documento inteiro é baixado por todo mundo em rede de evento.
    //
    // Três elementos, e a contagem é o que importa: `resolvidoEm` ficou de fora
    // de propósito. Ele serve ao desempate, que o servidor já resolveu ao
    // ordenar — mandá-lo adiante publicaria o instante exato em que uma pessoa
    // nomeada esteve num lugar, que para menores de 18 é a exposição que RNF-09
    // existe para evitar, por outra porta.
    expect(Array.isArray(primeira)).toBe(true)
    expect(primeira).toHaveLength(3)

    const [nomePublico, pitch, tempoMs] = primeira as [unknown, unknown, unknown]
    expect(typeof nomePublico).toBe('string')
    expect([1, 2]).toContain(pitch)
    expect(typeof tempoMs).toBe('number')

    // E o que **não** está lá, dito por extenso: não existe posição no documento
    // onde caiba idade, e-mail ou telefone. É a forma que garante, não a
    // disciplina de quem escreve a projeção.
    for (const linha of linhas) expect(linha).toHaveLength(3)
  })

  test('RF-30 — a busca localiza e destaca sem ir ao servidor', async ({ page }) => {
    await page.goto('/classificacao')
    await page.waitForLoadState('networkidle')

    let idas = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/classificacao')) idas += 1
    })

    await page.getByRole('searchbox').fill(ADULTA_CLASSIFICADA.nome)

    // O destaque é `aria-current` na linha, e não uma cor de fundo: procurar
    // pela classe CSS testaria a folha de estilo; procurar pelo estado
    // acessível testa o que um leitor de tela anuncia.
    await expect(page.locator('tr[aria-current="true"]').first()).toBeVisible()

    // Zero: a busca roda sobre o documento já carregado. É isso que a torna
    // instantânea em 3G — e é o mesmo motivo pelo qual o servidor não consegue
    // medir o uso dela (D-69, T16).
    expect(idas).toBe(0)
  })
})
