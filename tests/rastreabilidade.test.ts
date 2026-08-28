import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Rastreabilidade: cada requisito do PRD tem um teste que o cita (T17).
 *
 * **A T17 não é uma tarefa de escrever testes; é uma de provar que eles
 * existem.** O PRD já escreveu a suíte — cada RF e RNF traz a linha
 * *Verificação*. O que faltava era algo que percebesse a ausência: um requisito
 * novo entra no PRD, ninguém escreve o teste, e nada no mundo reclama. Meses
 * depois a auditoria de T21 descobre o buraco, tarde.
 *
 * Este arquivo é esse algo. Ele lê o PRD, extrai os códigos, varre os nomes de
 * todos os testes — inclusive os de ponta a ponta — e falha se algum requisito
 * não for citado por nenhum, nem constar do registro de verificação manual
 * abaixo com uma justificativa escrita.
 *
 * **O registro tem duas travas, e a segunda é a que importa.** A primeira é
 * óbvia: só entra ali o que não dá para automatizar. A segunda é que um código
 * **coberto por teste** não pode continuar no registro — assim que alguém
 * automatiza uma verificação que era manual, este arquivo exige que a
 * justificativa saia. Sem isso o registro vira um depósito de dispensas que
 * ninguém revisita, e a auditoria de T21 leria "verificado à mão" sobre coisas
 * que a suíte já verifica sozinha.
 */

const RAIZ = process.cwd()

/**
 * Requisitos que **não** se verificam por código, com o porquê.
 *
 * Cada linha aqui é uma dívida com o mundo físico, não com o repositório, e
 * todas estão no checklist de T21. Se uma delas puder ser automatizada, o teste
 * correspondente entra e a linha sai — este arquivo obriga.
 */
const VERIFICACAO_MANUAL: Readonly<Record<string, string>> = {
  'RNF-04':
    'Carga em 3G medida com limitação de rede real. O peso do primeiro carregamento tem ' +
    'orçamento verificável (npm run orcamento, T07), e a conta de T13 mostrou que o ' +
    'critério não fecha em "3G lento" nem com página vazia — precisa ser reescrito contra ' +
    'um perfil nomeado e medido em aparelho. T18 mede, T21 confere.',

  'RNF-05':
    'A verificação do PRD é "monitoramento contínuo no dia". As três superfícies de T16 ' +
    'têm teste (observabilidade.test.ts), mas disponibilidade durante a janela do evento ' +
    'só se observa no evento, e o monitor externo depende de contratar serviço (PE-05).',

  'RNF-15':
    'A verificação do PRD é "teste cronometrado com cinco pessoas reais em cada perfil". ' +
    'O tempo de preenchimento é medido em produção pelo token assinado e sai no relatório ' +
    'de T16; o ensaio com gente é de T21.',
}

/** `**RF-07**` e `**RNF-12**` no corpo do PRD. */
function requisitosDoPrd(): string[] {
  const prd = readFileSync(join(RAIZ, 'PRD.md'), 'utf8')
  const achados = prd.matchAll(/^\*\*(RFN?|RNF|RF)-(\d{2})\*\*/gm)

  return [...new Set([...achados].map((a) => `${a[1]!}-${a[2]!}`))].sort()
}

function arquivosDeTeste(): string[] {
  const encontrados: string[] = []

  const varrer = (diretorio: string): void => {
    for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
      const caminho = join(diretorio, entrada.name)

      if (entrada.isDirectory()) {
        if (['node_modules', '.next', '.git'].includes(entrada.name)) continue
        varrer(caminho)
        continue
      }

      if (/\.(test|spec)\.tsx?$/.test(entrada.name)) encontrados.push(caminho)
    }
  }

  for (const raiz of ['src', 'tests', 'e2e']) varrer(join(RAIZ, raiz))

  return encontrados
}

/**
 * Os códigos citados em **nomes de teste**, e não em qualquer lugar do arquivo.
 *
 * A diferença não é sutil: um comentário mencionando RF-22 no topo de um
 * arquivo faria o requisito parecer coberto sem que nenhuma asserção o
 * exercitasse. O que conta é o título que aparece no relatório da suíte quando
 * o teste falha — porque é ele que diz a quem está consertando **qual promessa
 * do produto** acabou de quebrar.
 */
function codigosEmNomesDeTeste(): Map<string, string[]> {
  const porCodigo = new Map<string, string[]>()

  for (const caminho of arquivosDeTeste()) {
    const fonte = readFileSync(caminho, 'utf8')

    // `it('...')`, `test('...')` e `describe('...')`, com aspas simples, duplas
    // ou crase. O título vai até o fechamento correspondente.
    for (const achado of fonte.matchAll(/\b(?:it|test|describe)\s*\(\s*(['"`])([\s\S]*?)\1/g)) {
      const titulo = achado[2] ?? ''

      for (const codigo of titulo.matchAll(/\b(RNF|RF)-(\d{2})\b/g)) {
        const chave = `${codigo[1]!}-${codigo[2]!}`
        porCodigo.set(chave, [...(porCodigo.get(chave) ?? []), titulo])
      }
    }
  }

  return porCodigo
}

describe('rastreabilidade entre o PRD e a suíte (T17)', () => {
  const requisitos = requisitosDoPrd()
  const cobertos = codigosEmNomesDeTeste()

  it('o PRD continua sendo lido — 35 requisitos funcionais e 18 não funcionais', () => {
    // Se o PRD mudar de formato e a extração passar a devolver zero, todos os
    // testes abaixo passariam por vacuidade. Esta é a âncora contra isso.
    expect(requisitos.filter((r) => r.startsWith('RF-'))).toHaveLength(35)
    expect(requisitos.filter((r) => r.startsWith('RNF-'))).toHaveLength(18)
  })

  it('todo requisito do PRD é citado por algum teste, ou tem justificativa escrita', () => {
    const descobertos = requisitos.filter(
      (codigo) => !cobertos.has(codigo) && VERIFICACAO_MANUAL[codigo] === undefined,
    )

    expect(
      descobertos,
      descobertos.length === 0
        ? ''
        : `Sem teste e sem justificativa: ${descobertos.join(', ')}.\n` +
            'Escreva um teste cujo nome cite o código, ou registre em VERIFICACAO_MANUAL ' +
            'por que ele não pode ser verificado por código.',
    ).toEqual([])
  })

  it('nenhuma justificativa manual sobrevive a um teste que passou a cobrir o requisito', () => {
    const obsoletas = Object.keys(VERIFICACAO_MANUAL).filter((codigo) => cobertos.has(codigo))

    // Esta é a trava que mantém o registro honesto. Sem ela, uma dispensa
    // escrita hoje continuaria valendo depois de alguém automatizar a
    // verificação — e a auditoria de T21 leria "verificado à mão" sobre algo
    // que a suíte já verifica em três segundos.
    expect(
      obsoletas,
      obsoletas.length === 0
        ? ''
        : `Já existe teste citando ${obsoletas.join(', ')}. Remova a justificativa manual.`,
    ).toEqual([])
  })

  it('toda justificativa manual explica o porquê, e não só declara a dispensa', () => {
    const rasas = Object.entries(VERIFICACAO_MANUAL)
      .filter(([, texto]) => texto.trim().length < 80)
      .map(([codigo]) => codigo)

    expect(rasas, `Justificativa curta demais para ser útil: ${rasas.join(', ')}.`).toEqual([])
  })

  it('não há justificativa para requisito que o PRD não contém', () => {
    const orfas = Object.keys(VERIFICACAO_MANUAL).filter((c) => !requisitos.includes(c))

    // Um requisito removido do PRD deixa a dispensa órfã, e ela passaria a
    // esconder nada — mas ainda seria lida como se protegesse alguma coisa.
    expect(orfas, `Justificativa sem requisito correspondente: ${orfas.join(', ')}.`).toEqual([])
  })
})
