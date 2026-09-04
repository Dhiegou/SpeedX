import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O sistema visual, guardado por teste (PRD-front §7).
 *
 * `globals.css` afirma que nenhuma cor é escrita à mão dentro de um módulo e
 * que o anel de foco é um só. Até 2026-09-03 as duas afirmações eram falsas:
 * havia **47 cores literais** em seis módulos, e o cabeçalho e o painel tinham
 * anéis próprios — o painel com zero ocorrências de `var(--foco)` em 386
 * linhas, justamente a tela operada por teclado durante dez horas.
 *
 * O defeito não é estético e não aparece em nenhuma tela: aparece **no dia em
 * que a paleta muda**, quando cinco telas acompanham e duas não. Documento não
 * é guarda; este arquivo é.
 *
 * Nenhum destes testes olha para valor de cor. Eles olham para **de onde a cor
 * vem** — o que é a única coisa que precisa sobreviver a um redesenho.
 */

const RAIZ = process.cwd()

function varrer(diretorio: string, extensoes: string[]): string[] {
  const encontrados: string[] = []

  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = join(diretorio, entrada.name)

    if (entrada.isDirectory()) {
      encontrados.push(...varrer(caminho, extensoes))
      continue
    }

    if (extensoes.includes(extname(entrada.name))) encontrados.push(caminho)
  }

  return encontrados
}

const modulos = varrer(join(RAIZ, 'app'), ['.css']).filter((c) => c.endsWith('.module.css'))

const ler = (caminho: string): string => readFileSync(caminho, 'utf8')
const curto = (caminho: string): string => relative(RAIZ, caminho).replace(/\\/g, '/')

describe('a cor vem do sistema, e não do módulo', () => {
  it('há módulos para conferir — o teste não passa por falta de arquivos', () => {
    expect(modulos.length).toBeGreaterThanOrEqual(6)
  })

  it('nenhum módulo escreve cor literal', () => {
    // Hexadecimal, `rgb()` e `hsl()`. Um valor destes dentro de um módulo é uma
    // cor que a troca de paleta não alcança, e que ninguém encontra procurando
    // por `--marca`.
    const literais = new RegExp('#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?)\\(', 'g')

    const infratores = modulos
      .map((caminho) => ({ caminho, achados: ler(caminho).match(literais) ?? [] }))
      .filter(({ achados }) => achados.length > 0)
      .map(({ caminho, achados }) => `${curto(caminho)}: ${achados.join(', ')}`)

    expect(infratores).toEqual([])
  })

  it('toda superfície com foco usa o anel do sistema, e nenhuma inventa o seu', () => {
    // O anel padrão é `--foco`; sobre fundo escuro, `--foco-sobre-marca`. Um
    // `outline` com valor próprio é o começo de foco que muda de aparência
    // entre telas — e foco que muda de aparência é foco que se perde de vista.
    const proprios: string[] = []

    for (const caminho of modulos) {
      const fonte = ler(caminho)
      if (!fonte.includes(':focus-visible')) continue

      for (const linha of fonte.split('\n')) {
        const declara = linha.trim().startsWith('outline:')
        if (declara && !linha.includes('var(--foco')) {
          proprios.push(`${curto(caminho)}: ${linha.trim()}`)
        }
      }
    }

    expect(proprios).toEqual([])
  })

  it('nenhum módulo baixa nada — nem fonte, nem imagem', () => {
    // `@import` e `url()` são as duas portas por onde um pedido de rede entra
    // numa folha de estilo. A regra existe porque o custo não é o arquivo: é o
    // arquivo multiplicado por duas mil pessoas em rede congestionada.
    //
    // **O título não cita RNF-04 de propósito.** Isto é uma condição que ajuda
    // o requisito, não o requisito: RNF-04 fala em três segundos sobre rede
    // móvel lenta, e isso continua se medindo com limitação real em aparelho —
    // a justificativa manual de `rastreabilidade.test.ts` segue valendo. Citar
    // o código aqui faria a auditoria de T21 ler "coberto por teste" sobre algo
    // que nenhum teste mede.
    const infratores = modulos
      .filter((caminho) => /@import|url\(/.test(ler(caminho)))
      .map(curto)

    expect(infratores).toEqual([])
  })
})

describe('estilo mora em folha de estilo', () => {
  it('nenhum componente carrega estilo em linha', () => {
    // Estilo em linha escapa dos tokens por construção: não há como um
    // `style={{ }}` ler `--marca` sem repetir o valor. O último do projeto
    // vivia na página do painel, embrulhando o botão Sair.
    //
    // `opengraph-image.tsx` é a exceção, e é exceção de verdade: a imagem é
    // montada fora do navegador, onde folha de estilo não existe.
    const componentes = varrer(join(RAIZ, 'app'), ['.tsx']).filter(
      (caminho) => !caminho.endsWith('opengraph-image.tsx'),
    )

    const infratores = componentes.filter((caminho) => /style=\{\{/.test(ler(caminho))).map(curto)

    expect(infratores).toEqual([])
  })

  it('todo controle do painel passa pelo sistema visual', () => {
    // O botão Sair era um `<button>` cru, o único controle do projeto sem
    // classe nenhuma: saía com a aparência nativa de cada navegador.
    const fonte = ler(join(RAIZ, 'app', 'painel', '(protegido)', 'BotaoSair.tsx'))

    expect(fonte).toMatch(/className=/)
    expect(fonte).toMatch(/painel\.module\.css/)
  })
})

describe('o link compartilhado tem cartão, e a aba tem ícone (PRD-front §5.7)', () => {
  it('o ícone existe', () => {
    expect(existsSync(join(RAIZ, 'app', 'icon.svg'))).toBe(true)
  })

  it('o cartão de compartilhamento existe e declara tamanho e texto alternativo', () => {
    const caminho = join(RAIZ, 'app', 'opengraph-image.tsx')
    expect(existsSync(caminho)).toBe(true)

    const fonte = ler(caminho)
    expect(fonte).toMatch(/export const alt/)
    expect(fonte).toMatch(/export const size/)
    // 1200×630 é o que os aplicativos de mensagem esperam; fora disso a imagem
    // é recortada por eles, e o recorte cai em cima do nome.
    expect(fonte).toMatch(/width: 1200/)
    expect(fonte).toMatch(/height: 630/)
  })

  it('o Open Graph aponta para um endereço absoluto vindo da APP_URL', () => {
    // Marca de Open Graph com caminho relativo não resolve do lado de quem
    // recebe o link. E o endereço vem da variável que já decide o destino do
    // QR — escrever o domínio à mão aqui criaria uma segunda verdade.
    const fonte = ler(join(RAIZ, 'app', 'layout.tsx'))

    expect(fonte).toMatch(/metadataBase/)
    expect(fonte).toMatch(/APP_URL/)
    expect(fonte).toMatch(/openGraph/)
  })
})
