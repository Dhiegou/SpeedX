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

/**
 * O arquivo sem os comentários.
 *
 * Vários testes daqui procuram por uma construção proibida: `localStorage`, uma
 * imagem baixada, cor literal. A explicação de **por que** ela é proibida mora
 * no comentário logo acima do código que a evita — e é onde ela deve morar. Sem
 * esta limpeza, o teste acusaria justamente os arquivos que documentam a
 * decisão, e o conserto seria apagar a explicação: o pior desfecho possível.
 */
const codigo = (caminho: string): string =>
  ler(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

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
    // O anel padrão é `--foco`; sobre fundo escuro, `--foco-sobre-area`. Um
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
    const infratores = modulos.filter((caminho) => /@import|url\(/.test(ler(caminho))).map(curto)

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

describe('os dois temas, e onde a escolha mora (PRD-front §5.1)', () => {
  const globais = ler(join(RAIZ, 'app', 'globals.css'))

  it('nenhum arquivo do projeto usa armazenamento de navegador', () => {
    // Critério de aceitação explícito, e não implicância com a API. O tema é a
    // única preferência que o produto guarda, e ela mora em cookie por um
    // motivo técnico: cookie chega junto com a requisição, então o servidor
    // pinta no tema certo de primeira. `localStorage` só é legível depois que o
    // JavaScript roda, o que obrigaria a um script bloqueante no `<head>` para
    // não piscar — exatamente o custo que RNF-04 não paga.
    const fontes = [
      ...varrer(join(RAIZ, 'app'), ['.ts', '.tsx']),
      ...varrer(join(RAIZ, 'src'), ['.ts', '.tsx']),
    ]

    const infratores = fontes
      .filter((caminho) => /\b(?:local|session)Storage\b/.test(codigo(caminho)))
      .map(curto)

    expect(infratores).toEqual([])
  })

  it('sem escolha feita, o tema segue o celular (D-110)', () => {
    // Quase todo mundo se inscreve pelo próprio celular: quem o deixou no
    // escuro precisa entrar no escuro. A consulta vale só sem `data-tema`,
    // porque a escolha do botão manda sobre a do sistema.
    expect(globais).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-tema\]\) \{/,
    )
    expect(globais).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('o escuro do celular é o mesmo escuro do botão', () => {
    // São dois blocos porque CSS não junta seletor e consulta de mídia numa
    // regra só. Um tom ajustado num e esquecido no outro faria o site ter dois
    // temas escuros, e ninguém veria: quem testa o botão não testa o sistema.
    const tokens = (inicio: string): string[] => {
      const corpo = globais.slice(globais.indexOf(inicio))
      const fim = corpo.indexOf('color-scheme: dark')

      return [...corpo.slice(0, fim).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(
        (t) => `${t[1] ?? ''}: ${t[2] ?? ''}`,
      )
    }

    const doBotao = tokens(":root[data-tema='escuro'] {")
    const doCelular = tokens(':root:not([data-tema]) {')

    expect(doBotao.length).toBeGreaterThan(20)
    expect(doCelular).toEqual(doBotao)
  })

  it('o tema escuro existe e herda do claro em vez de repeti-lo', () => {
    // Repetir a paleta inteira num segundo bloco é como o segundo tema morre:
    // alguém ajusta um tom no claro, o escuro fica para trás, e ninguém percebe
    // porque as duas telas nunca são abertas lado a lado.
    const escuro = globais.slice(globais.indexOf("[data-tema='escuro']"))

    expect(escuro).toContain('--fundo: #000000')
    expect(escuro).toContain('color-scheme: dark')
    // O amarelo do pódio e o preto da área de marca não são redeclarados: são
    // os mesmos nos dois temas, e é isso que o teste fixa.
    expect(escuro).not.toContain('--amarelo:')
  })

  it('a troca de tema funciona sem JavaScript, e com ele não recarrega', () => {
    // O cabeçalho continua no servidor; só o botão é de cliente. Ele segue
    // sendo um formulário de verdade, então a troca funciona mesmo quando o
    // script não baixou — e, quando baixou, troca na hora em vez de buscar a
    // página de novo (D-110).
    const cabecalho = ler(join(RAIZ, 'app', '_componentes', 'Cabecalho.tsx'))
    const botao = ler(join(RAIZ, 'app', '_componentes', 'TrocaDeTema.tsx'))

    expect(cabecalho).not.toContain("'use client'")
    expect(botao).toMatch(/method="post"/)
    expect(botao).toMatch(/action="\/api\/tema"/)
    expect(botao).toContain('CABECALHO_SEM_RECARGA')
  })
})

describe('a marca vive dentro do HTML (PRD-front §5.2)', () => {
  const marca = join(RAIZ, 'app', '_componentes', 'marca')

  /**
   * Era um par, e virou um. O selo da PrinterX saiu em 2026-10-14 (D-99), e a
   * lista aqui é a prova de que ele saiu: um vetor novo no diretório sem entrar
   * nesta lista escapa das três regras abaixo, e por isso a lista é lida do
   * próprio diretório logo adiante, e não escrita à mão duas vezes.
   */
  const pecas = ['SpeedX']

  it('cada vetor é componente, e nenhum é imagem servida', () => {
    // Um `<img src>` seria requisição a mais no primeiro carregamento, e o
    // orçamento se mede em recursos tanto quanto em bytes: são dez, e continuam
    // dez. `public/` fica vazio de propósito — tudo que entra ali vira URL.
    for (const peca of pecas) {
      const fonte = codigo(join(marca, `${peca}.tsx`))

      expect(fonte).toContain('<svg')
      expect(fonte).not.toMatch(/<img\b/)
    }

    expect(existsSync(join(RAIZ, 'public'))).toBe(false)
  })

  it('nenhum vetor carrega o metadata de origem', () => {
    // Os arquivos vieram com um manifesto C2PA embutido: 7,7 KB de base64 que
    // não desenha nada e viajaria dentro do HTML de toda página, para todo
    // participante. Tirá-lo é o que faz o par caber em 3,8 KB gzip.
    for (const peca of pecas) {
      const fonte = ler(join(marca, `${peca}.tsx`))

      expect(fonte).not.toContain('c2pa')
      expect(fonte).not.toContain('<metadata>')
    }
  })

  it('o gradiente de cada vetor recebe identificador de fora', () => {
    // Dois SVG embutidos no mesmo documento dividem o espaço de nomes de `id`.
    // Com o identificador fixo no arquivo, o segundo rouba o preenchimento do
    // primeiro — e o sintoma é um logotipo preto, sem erro nenhum no console.
    for (const peca of pecas) {
      expect(ler(join(marca, `${peca}.tsx`))).toContain('id={id}')
    }
  })

  it('a lista de peças é a do diretório — nenhum vetor escapa das regras acima', () => {
    // Sem isto, acrescentar um vetor novo e esquecer de pô-lo na lista faz as
    // três regras passarem sem tê-lo conferido. É o mesmo defeito que D-92
    // corrigiu na cor: afirmação que ninguém verifica.
    const noDiretorio = readdirSync(marca)
      .filter((nome) => nome.endsWith('.tsx') && nome !== 'Logo.tsx')
      .map((nome) => nome.replace('.tsx', ''))

    expect(noDiretorio.sort()).toEqual([...pecas].sort())
  })

  it('o bloqueio tem piso de largura, e o cabeçalho é desenhado em cima dele', () => {
    // O piso de 200px nasceu medido, do "POWERED BY" do selo. Com o selo fora
    // (D-99) ele deixou de ser consequência e virou escolha — e continua
    // decidindo o layout do cabeçalho: 200px são 56% de uma tela de 360px, e é
    // por isso que os links vão **abaixo** do logotipo no celular. Mudar este
    // número é mudar aquele layout, e o teste existe para que a mudança seja
    // deliberada em vez de silenciosa.
    const estilos = ler(join(marca, 'marca.module.css'))

    expect(estilos).toMatch(/clamp\(200px/)
  })

  it('o cabeçalho é a área de marca, e não o fundo do tema', () => {
    // As cores da marca reprovam sobre branco e passam sobre preto (D-94). A
    // barra lê `--area-marca`, que é preta nos dois temas de propósito.
    const estilos = ler(join(RAIZ, 'app', '_componentes', 'cabecalho.module.css'))

    expect(estilos).toContain('background: var(--area-marca)')
    expect(estilos).not.toMatch(/\.cabecalho \{[^}]*var\(--fundo\)/s)
  })
})
