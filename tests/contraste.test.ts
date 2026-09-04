import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste da paleta, calculado (PRD-front §7, RNF-18).
 *
 * O critério de aceitação pedia "verificado par a par e escrito". Escrito é
 * pior que calculado: uma tabela de razões numa página envelhece no instante em
 * que alguém ajusta um tom, e ninguém refaz a conta de vinte e seis pares à mão
 * na véspera do evento.
 *
 * **Por que 4.5:1 não é burocracia aqui.** O evento é ao ar livre. Uma tela de
 * celular sob sol perde contraste efetivo antes de qualquer coisa: o par que
 * mal passa em ambiente fechado é ilegível no pátio, e quem paga é a pessoa
 * tentando achar o próprio nome com a mão fazendo sombra.
 *
 * O piso é o da WCAG AA: **4.5:1 para texto** e **3:1 para elemento gráfico** —
 * borda, barra do pódio, anel de foco —, que é onde a norma reconhece que a
 * exigência de texto não se aplica.
 */

const RAIZ = process.cwd()

/** `--nome: #rrggbb;` de `globals.css`. Só hexadecimal; o resto não é cor de par. */
function tokens(): Map<string, string> {
  const fonte = readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8')
  const achados = fonte.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)

  return new Map([...achados].map((a) => [a[1] ?? '', a[2] ?? '']))
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
  ['tinta-suave', 'fundo', 'subtítulo e dica'],
  ['tinta-suave', 'superficie', 'os quatro dígitos do telefone, rótulo do diálogo'],
  ['tinta-suave', 'superficie-alt', 'apoio sobre faixa alternada'],
  ['tinta-fraca', 'fundo', 'o texto mais apagado que o sistema permite'],
  ['tinta-fraca', 'superficie', 'o mesmo, sobre cartão'],
  ['sobre-marca', 'marca', 'cabeçalho da tabela, botão cheio, aba ativa'],
  ['sobre-marca', 'marca-escura', 'barra do painel e cabeçalho público'],
  ['sobre-marca', 'acento', 'texto sobre a brasa, se algum dia houver'],
  ['sobre-marca-suave', 'marca', 'identidade do Operador na barra'],
  ['sobre-marca-suave', 'marca-escura', 'navegação secundária no cabeçalho'],
  ['marca', 'superficie', 'botão secundário: texto da marca sobre branco'],
  ['marca', 'fundo', 'o mesmo, sobre o papel'],
  ['acento', 'superficie', 'marca quente sobre cartão'],
  ['acento', 'acento-claro', 'aviso de âmbar'],
  ['acento-tinta', 'acento-claro', 'texto do aviso de âmbar'],
  ['erro', 'erro-fundo', 'recusa do Enter, campo inválido, sem conexão'],
  ['erro', 'superficie', 'mensagem de erro sobre cartão'],
  ['erro', 'fundo', 'mensagem de erro sobre a página'],
  ['sucesso', 'sucesso-fundo', 'conectado, e o aviso de gravação'],
  ['sucesso', 'superficie', 'confirmação sobre cartão'],
  ['ouro-tinta', 'ouro-fundo', 'primeiro lugar'],
  ['prata-tinta', 'prata-fundo', 'segundo lugar'],
  ['bronze-tinta', 'bronze-fundo', 'terceiro lugar'],
]

/** Não carregam texto: a norma pede 3:1, e por bom motivo. */
const PARES_GRAFICOS: readonly (readonly [string, string, string])[] = [
  ['borda-forte', 'superficie', 'borda de campo de entrada'],
  ['borda-forte', 'fundo', 'a mesma, sobre o papel'],
  ['ouro-marca', 'superficie', 'barra de 3px do primeiro lugar'],
  ['prata-marca', 'superficie', 'barra de 3px do segundo'],
  ['bronze-marca', 'superficie', 'barra de 3px do terceiro'],
  ['marca', 'fundo', 'anel de foco sobre a página'],
  ['acento', 'fundo', 'faixa da marca no topo'],
]

const paleta = tokens()

function conferir(
  pares: readonly (readonly [string, string, string])[],
  piso: number,
): { reprovados: string[]; medidos: number } {
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

  return { reprovados, medidos: pares.length }
}

describe('contraste da paleta', () => {
  it('a paleta foi lida — o teste não passa por não achar token nenhum', () => {
    // Sem esta âncora, renomear o arquivo ou trocar o formato faria todos os
    // pares abaixo passarem por vacuidade, e a auditoria leria verde.
    expect(paleta.size).toBeGreaterThanOrEqual(25)
    expect(paleta.get('marca')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('todo par de texto passa de 4.5:1 — o evento é ao ar livre', () => {
    const { reprovados, medidos } = conferir(PARES_DE_TEXTO, 4.5)

    expect(medidos).toBeGreaterThanOrEqual(28)
    expect(reprovados, reprovados.join('\n')).toEqual([])
  })

  it('todo elemento gráfico passa de 3:1', () => {
    const { reprovados } = conferir(PARES_GRAFICOS, 3)

    expect(reprovados, reprovados.join('\n')).toEqual([])
  })

  it('o escuro da marca e o papel não se aproximam — a barra precisa se destacar', () => {
    // A barra escura do painel existe para o Operador saber, de relance, se
    // está no painel ou na página pública. Se os dois escurecerem juntos numa
    // troca de paleta, a barra deixa de dizer isso e ninguém percebe.
    const marca = paleta.get('marca-escura') ?? '#000000'
    const papel = paleta.get('fundo') ?? '#ffffff'

    expect(razao(marca, papel)).toBeGreaterThan(10)
  })
})
