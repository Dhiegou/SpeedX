import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compactar } from '@/contexts/classificacao/documento'

/**
 * As invariantes de privacidade que a auditoria de T21 encontrou e fixou.
 *
 * A T21 é uma leitura, e leitura vale para o dia em que foi feita. Três das
 * conclusões dela são estruturais o bastante para virar teste, e é isso que as
 * mantém verdadeiras depois que a auditoria acabar:
 *
 * 1. **O conjunto de rotas públicas é fechado.** Hoje são três. Uma quarta
 *    precisa ser uma edição deliberada deste arquivo, e não o efeito colateral
 *    de alguém criar uma rota sem guarda.
 * 2. **O registro pessoal completo mora num contexto só** (BC-05). E-mail,
 *    idade e dados de Responsável não são lidos fora da Custódia; o telefone
 *    inteiro também não.
 * 3. **O documento público tem três posições.** Um quarto campo no array é
 *    barato de acrescentar e caro de perceber.
 *
 * O que **não** está aqui, porque não se responde lendo arquivo: o corpo que
 * sai de verdade contra o banco de verdade. Isso é `npm run auditar`.
 */

const RAIZ = process.cwd()

const ler = (...partes: string[]): string => readFileSync(join(RAIZ, ...partes), 'utf8')

function arquivos(diretorio: string, filtro: (nome: string) => boolean): string[] {
  const encontrados: string[] = []

  const varrer = (atual: string): void => {
    for (const entrada of readdirSync(atual, { withFileTypes: true })) {
      const caminho = join(atual, entrada.name)
      if (entrada.isDirectory()) varrer(caminho)
      else if (filtro(entrada.name)) encontrados.push(caminho)
    }
  }

  varrer(join(RAIZ, diretorio))
  return encontrados
}

const paraBarras = (caminho: string): string => relative(RAIZ, caminho).split('\\').join('/')

describe('RNF-10 — o conjunto de rotas públicas é fechado (T21 Parte 1)', () => {
  /**
   * As três que respondem sem sessão, e o porquê de cada uma.
   *
   * `/api/painel/sessao` não entra: ela **é** o login, e a guarda dela é a
   * senha. Está listada aqui como exceção nomeada para não passar como
   * esquecimento.
   */
  const PUBLICAS = [
    'app/api/classificacao/route.ts', // RF-26: a tabela é pública por requisito
    'app/api/inscricao/route.ts', // RF-01: quem se inscreve ainda não tem conta
    'app/api/saude/route.ts', // T16: um monitor externo não sabe autenticar-se
  ]

  const LOGIN = 'app/api/painel/sessao/route.ts'

  it('nenhuma rota sem guarda além das três conhecidas', () => {
    const semGuarda = arquivos('app', (n) => n === 'route.ts')
      .filter((caminho) => !readFileSync(caminho, 'utf8').includes('exigirOperadorNaApi'))
      .map(paraBarras)

    expect(semGuarda.sort()).toEqual([...PUBLICAS].sort())
  })

  it('a rota de login é a única que dispensa sessão tendo a guarda importada', () => {
    // Ela importa a guarda para o `DELETE` (sair), não para o `POST` (entrar).
    const fonte = ler(...LOGIN.split('/'))

    expect(fonte).toContain('exigirOperadorNaApi')
    expect(fonte).toContain('export async function DELETE')
  })

  it('nenhuma rota pública lê o banco fora de um caso de uso', () => {
    // A exceção nominal é `/api/saude`, que pergunta sobre o processo e não
    // sobre o domínio — `tests/fronteiras.test.ts` guarda a exceção.
    for (const rota of PUBLICAS.filter((r) => !r.includes('saude'))) {
      expect(ler(...rota.split('/')), rota).not.toMatch(/from '@\/db'/)
    }
  })
})

describe('BC-05 — o registro pessoal completo mora num contexto só', () => {
  /**
   * O que a auditoria encontrou, e é mais preciso do que o SDD dizia.
   *
   * O SDD §BC-05 afirmava que a Custódia é o único contexto autorizado a
   * "reunir dados pessoais de Inscrição com resultados de Cronometragem no
   * mesmo documento". Lido ao pé da letra, o painel viola isso: a busca de
   * RF-16 devolve nome, sobrenome e os quatro últimos dígitos do telefone
   * **junto** com as Tentativas da pessoa, tempo incluído. E precisa devolver —
   * é assim que o Operador distingue dois homônimos antes de lançar.
   *
   * A invariante que de fato vale, e que este teste fixa, é mais estreita e
   * mais útil: **o registro pessoal completo** — e-mail, idade, dados de
   * Responsável, telefone inteiro — não é lido fora da Custódia. O painel opera
   * com identidade reduzida ao mínimo que distingue uma pessoa da outra.
   */
  const contextos = arquivos('src/contexts', (n) => n.endsWith('.ts') && !n.includes('.test.'))

  const foraDaCustodia = contextos.filter((c) => !paraBarras(c).includes('contexts/custodia/'))

  it('a varredura encontra os contextos', () => {
    expect(foraDaCustodia.length).toBeGreaterThan(20)
  })

  it('RNF-08 — e-mail, idade e Responsável não são lidos fora da Custódia', () => {
    const colunas = [
      'participante.email',
      'participante.idade',
      'schema.responsavel.nome',
      'schema.responsavel.telefone',
    ]

    const infratores: string[] = []

    for (const caminho of foraDaCustodia) {
      const fonte = readFileSync(caminho, 'utf8')

      for (const coluna of colunas) {
        // A projeção da Classificação lê `idade` para decidir se abrevia o
        // sobrenome (RNF-09), e não a publica: o modelo de saída não tem campo
        // de idade. É a única leitura legítima fora da Custódia.
        if (fonte.includes(coluna) && !paraBarras(caminho).endsWith('classificacao/projecao.ts')) {
          infratores.push(`${paraBarras(caminho)} → ${coluna}`)
        }
      }
    }

    expect(infratores).toEqual([])
  })

  it('RF-15 — o telefone inteiro não sai da Cronometragem; só os quatro últimos', () => {
    // Derivado no banco (`right(telefone, 4)`), então o número completo não
    // chega nem a trafegar até a aplicação.
    const fonte = ler('src', 'contexts', 'cronometragem', 'consultas.ts')

    expect(fonte).toMatch(/right\(\$\{schema\.participante\.telefone\}, 4\)/)
    expect(fonte).not.toMatch(/telefone: schema\.participante\.telefone/)
  })

  it('a Custódia continua sendo quem reúne o registro completo', () => {
    // O contraponto do caso acima: se este teste falhar, a exportação de T14
    // parou de exportar o que RF-34 pede, e o teste acima passaria por
    // vacuidade — "ninguém lê e-mail" seria verdade porque ninguém exporta.
    const fonte = ler('src', 'contexts', 'custodia', 'consultas.ts')

    for (const coluna of ['participante.email', 'participante.idade', 'schema.responsavel.nome']) {
      expect(fonte, coluna).toContain(coluna)
    }
  })
})

describe('RNF-08 — o documento público tem três posições, e só', () => {
  it('a linha transmitida é [nomePublico, cockpit, tempoMs]', () => {
    const documento = compactar({
      geradoEm: '2026-10-24T12:00:00.000Z',
      linhas: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nomePublico: 'Marina C.',
          cockpit: 1,
          tempoMs: 83_450,
          registradoEm: '2026-10-24T11:59:00.000Z',
        },
      ],
    })

    const [linha] = documento.linhas

    expect(linha).toEqual(['Marina C.', 1, 83_450])
    // Um quarto campo é barato de acrescentar e caro de perceber. O `id` e o
    // `registradoEm` ficaram de fora de propósito (T12): o instante exato em
    // que uma pessoa nomeada esteve num lugar é exposição por outra porta.
    expect(linha).toHaveLength(3)
    expect(Object.keys(documento).sort()).toEqual(['geradoEm', 'linhas', 'total'])
  })

  it('o modelo de leitura da Classificação não tem campo pessoal', () => {
    const fonte = ler('src', 'contexts', 'classificacao', 'modelo.ts')

    for (const campo of ['email', 'telefone', 'idade', 'responsavel', 'sobrenome:']) {
      expect(fonte, campo).not.toMatch(new RegExp(`^\\s+${campo}`, 'm'))
    }
  })
})
