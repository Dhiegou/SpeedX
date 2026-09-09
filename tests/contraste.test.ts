import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste da paleta, calculado — **nos dois temas** (PRD-front §7, RNF-18).
 *
 * O critério de aceitação pedia "verificado par a par e escrito". Escrito é pior
 * que calculado: uma tabela de razões numa página envelhece no instante em que
 * alguém ajusta um tom, e ninguém refaz a conta de trinta pares à mão na véspera
 * do evento. Com dois temas isso deixou de ser preferência e virou necessidade —
 * são duas paletas inteiras, e conferir a segunda a olho é como não conferir.
 *
 * **Por que 4.5:1 não é burocracia aqui.** O evento é ao ar livre. Uma tela de
 * celular sob sol perde contraste efetivo antes de qualquer coisa: o par que mal
 * passa em ambiente fechado é ilegível no pátio, e quem paga é a pessoa tentando
 * achar o próprio nome com a mão fazendo sombra.
 *
 * O piso é o da WCAG AA: **4.5:1 para texto**, **3:1 para texto grande** — acima
 * de 24px, ou 19px em negrito, que é a faixa onde a norma reconhece que a
 * exigência cai — e **3:1 para elemento gráfico**: borda, barra do pódio, anel
 * de foco.
 *
 * **A marca obriga a essa separação.** Nenhuma das quatro cores do logotipo
 * passa de 4,5:1 sobre branco; todas passam sobre preto. É por isso que existem
 * `--marca` e `--marca-pura`: a escurecida carrega texto de corpo, a da marca só
 * aparece onde o texto é grande. Este arquivo é o que impede que as duas troquem
 * de lugar sem ninguém notar.
 */

const RAIZ = process.cwd()

const fonte = readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8')

/** O corpo de um seletor de tokens, do `{` até o `}` que o fecha. */
function bloco(seletor: string): string {
  const inicio = fonte.indexOf(seletor)
  if (inicio === -1) return ''

  const abre = fonte.indexOf('{', inicio)
  const fecha = fonte.indexOf('\n}', abre)

  return fonte.slice(abre, fecha)
}

/** `--nome: valor;` — hexadecimal ou `var(--outro)`. O resto não é cor de par. */
function declaracoes(corpo: string): Map<string, string> {
  const achados = corpo.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\))\s*;/g)

  return new Map([...achados].map((a) => [a[1] ?? '', a[2] ?? '']))
}

/**
 * A paleta de um tema.
 *
 * O escuro **não** repete a paleta inteira: ele sobrescreve o que muda e herda o
 * resto — o amarelo do pódio, o preto da área de marca, as escalas. Resolver a
 * herança aqui é o que faz o teste medir o que a tela realmente mostra, e não o
 * que o bloco do tema por acaso declarou.
 */
function paletaDe(tema: 'claro' | 'escuro'): Map<string, string> {
  const base = declaracoes(bloco(':root {'))
  const paleta =
    tema === 'claro' ? base : new Map([...base, ...declaracoes(bloco("[data-tema='escuro']"))])

  // Um nível de indireção basta: `--ouro-fundo: var(--amarelo)` e nada mais
  // fundo que isso existe no arquivo.
  for (const [nome, valor] of paleta) {
    const referencia = /^var\(--([a-z0-9-]+)\)$/.exec(valor)
    if (referencia) paleta.set(nome, paleta.get(referencia[1] ?? '') ?? valor)
  }

  return paleta
}

function canal(valor: number): number {
  const s = valor / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminancia(hex: string): number {
  const limpo = hex.replace('#', '')
  const cheio =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16))

  return 0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0)
}

function razao(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return ((claro ?? 0) + 0.05) / ((escuro ?? 0) + 0.05)
}

/** Cada par é um lugar real da interface, e o comentário diz qual. */
const PARES_DE_TEXTO: readonly (readonly [string, string, string])[] = [
  ['tinta', 'fundo', 'texto corrido em qualquer página'],
  ['tinta', 'superficie', 'texto dentro de cartão, lista e diálogo'],
  ['tinta', 'superficie-alt', 'texto sobre faixa alternada'],
  ['tinta', 'superficie-tenue', 'linha par da tabela da Classificação'],
  ['tinta', 'marca-clara', 'item selecionado na Fila do painel'],
  ['tinta', 'acento-claro', 'a linha destacada da Classificação'],
  ['tinta-suave', 'fundo', 'subtítulo e dica'],
  ['tinta-suave', 'superficie', 'os quatro dígitos do telefone, rótulo do diálogo'],
  ['tinta-suave', 'superficie-alt', 'apoio sobre faixa alternada'],
  ['tinta-fraca', 'fundo', 'o texto mais apagado que o sistema permite'],
  ['tinta-fraca', 'superficie', 'o mesmo, sobre cartão'],
  ['tinta-fraca', 'superficie-alt', 'a lacuna da tabela e o Cockpit'],
  ['sobre-marca', 'marca', 'cabeçalho da tabela, botão cheio, aba ativa'],
  ['marca', 'superficie', 'botão secundário: texto da marca sobre o cartão'],
  ['marca-forte', 'superficie', 'o passo adiante, em texto'],
  ['marca-forte', 'marca-clara', 'a pista escolhida no formulário'],
  ['sobre-marca', 'marca-forte', 'o botão cheio ao passar o dedo'],
  ['acento', 'superficie', 'o laranja em texto sobre cartão'],
  ['acento-tinta', 'acento-claro', 'texto do aviso'],
  ['erro', 'erro-fundo', 'recusa do Enter, campo inválido, sem conexão'],
  ['erro', 'superficie', 'mensagem de erro sobre cartão'],
  ['erro', 'fundo', 'mensagem de erro sobre a página'],
  ['sucesso', 'sucesso-fundo', 'conectado, e o aviso de gravação'],
  ['sucesso', 'superficie', 'confirmação sobre cartão'],
  ['sobre-marca', 'sucesso', 'o selo redondo da confirmação'],
  ['sobre-desabilitado', 'desabilitado', '"Enviando…" — texto que precisa ser lido'],
  ['ouro-tinta', 'ouro-fundo', 'primeiro lugar'],
  ['prata-tinta', 'prata-fundo', 'segundo lugar'],
  ['bronze-tinta', 'bronze-fundo', 'terceiro lugar'],
  ['sobre-area', 'area-marca', 'o cabeçalho público e a barra do painel'],
  ['sobre-area-suave', 'area-marca', 'navegação e identidade do Operador na barra'],
]

/**
 * Acima de 24px, ou 19px em negrito, a norma pede 3:1.
 *
 * É a faixa que devolve a cor **pura** da marca ao produto: `#ED145B` dá 4,33
 * sobre branco e reprovaria em corpo de texto, mas o total da Classificação e a
 * contagem de pendentes do painel são números de 22 e 28px em peso 800. Sem esta
 * categoria, ou o número perderia a cor da marca ou o teste mentiria.
 */
const PARES_DE_TEXTO_GRANDE: readonly (readonly [string, string, string])[] = [
  ['marca-pura', 'superficie', 'o total de tempos registrados, 22px em 800'],
  ['marca-pura', 'fundo', 'a contagem de pendentes do painel, 28px em 800'],
]

/** Não carregam texto: a norma pede 3:1, e por bom motivo. */
const PARES_GRAFICOS: readonly (readonly [string, string, string])[] = [
  ['borda-forte', 'superficie', 'borda de campo de entrada'],
  ['borda-forte', 'fundo', 'a mesma, sobre a página'],
  ['ouro-marca', 'superficie', 'barra de 3px do primeiro lugar'],
  ['prata-marca', 'superficie', 'barra de 3px do segundo'],
  ['bronze-marca', 'superficie', 'barra de 3px do terceiro'],
  ['marca', 'fundo', 'anel de foco sobre a página'],
  ['marca', 'superficie', 'anel de foco sobre o cartão'],
  ['marca', 'area-marca', 'a marca, se alguma vez encostar na área preta'],
  ['acento', 'fundo', 'a barra da linha destacada'],
  ['acento', 'acento-claro', 'a borda esquerda do aviso'],
  ['erro', 'superficie', 'a borda do campo recusado'],
]

function conferir(
  paleta: Map<string, string>,
  pares: readonly (readonly [string, string, string])[],
  piso: number,
): string[] {
  const reprovados: string[] = []

  for (const [frente, fundo, onde] of pares) {
    const a = paleta.get(frente)
    const b = paleta.get(fundo)

    if (a === undefined || b === undefined) {
      reprovados.push(`token inexistente em "${frente} sobre ${fundo}" (${onde})`)
      continue
    }

    const r = razao(a, b)
    if (r < piso) {
      reprovados.push(`${frente} sobre ${fundo} = ${r.toFixed(2)}:1, piso ${piso} — ${onde}`)
    }
  }

  return reprovados
}

describe.each([
  ['claro', paletaDe('claro')],
  ['escuro', paletaDe('escuro')],
] as const)('contraste da paleta — tema %s', (tema, paleta) => {
  it('a paleta foi lida — o teste não passa por não achar token nenhum', () => {
    // Sem esta âncora, renomear o arquivo, trocar o formato ou errar o seletor
    // do tema faria todos os pares abaixo passarem por vacuidade, e a auditoria
    // leria verde. O escuro é o caso perigoso: ele herda do claro, então um
    // seletor errado devolveria a paleta clara inteira sem levantar suspeita.
    expect(paleta.size).toBeGreaterThanOrEqual(30)
    expect(paleta.get('marca')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(paleta.get('fundo')).toBe(tema === 'claro' ? '#f4f4f6' : '#000000')
  })

  it('todo par de texto passa de 4.5:1 — o evento é ao ar livre', () => {
    const reprovados = conferir(paleta, PARES_DE_TEXTO, 4.5)

    expect(PARES_DE_TEXTO.length).toBeGreaterThanOrEqual(30)
    expect(reprovados, reprovados.join('\n')).toEqual([])
  })

  it('todo texto grande passa de 3:1', () => {
    const reprovados = conferir(paleta, PARES_DE_TEXTO_GRANDE, 3)

    expect(reprovados, reprovados.join('\n')).toEqual([])
  })

  it('todo elemento gráfico passa de 3:1', () => {
    const reprovados = conferir(paleta, PARES_GRAFICOS, 3)

    expect(reprovados, reprovados.join('\n')).toEqual([])
  })

  it('a superfície não se afasta do fundo a ponto de derrubar o rosa', () => {
    // No tema escuro isto é uma restrição de verdade, e foi medida: sobre
    // `#000000` o rosa dá 4,85; sobre `#0a0a0b`, 4,57; a partir de `#121214` cai
    // para 4,32 e reprova. O cartão precisa se separar do fundo, mas se ele
    // subir demais o rosa em cima dele deixa de ser legível — e a tela que
    // quebra é a Classificação inteira, cujo cabeçalho é rosa.
    const superficie = paleta.get('superficie') ?? '#ffffff'
    const marca = paleta.get('marca') ?? '#000000'

    expect(razao(marca, superficie)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('a área de marca é preta nos dois temas', () => {
  it('o preto da marca não é declarado dentro do tema escuro', () => {
    // O cabeçalho público e a barra do painel não trocam com o tema: o
    // "POWERED BY" do selo é branco no vetor e sumiria em fundo claro. Se um dia
    // alguém redeclarar `--area-marca` no bloco do escuro, o selo continua
    // funcionando por acidente enquanto o valor for escuro — e some no dia em
    // que não for. Melhor que o teste diga isso agora.
    expect(bloco("[data-tema='escuro']")).not.toMatch(/--area-marca:/)
    expect(bloco("[data-tema='escuro']")).not.toMatch(/--sobre-area:/)
  })
})
