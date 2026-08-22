import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Verificações estruturais da guarda do painel (T08 — RF-11, RNF-14).
 *
 * Três dos critérios de aceitação da T08 são da forma "não existe X em lugar
 * nenhum": nenhuma rota pública cria conta, nenhuma rota do painel dispensa a
 * guarda, ninguém lê o cookie de sessão fora do contexto de Identidade. A task
 * mandava conferir isso lendo o roteamento — e leitura humana confere o estado
 * de hoje, não o de depois que T10 e T11 acrescentarem rotas.
 *
 * Este arquivo é essa leitura, automatizada. Ele falha quando alguém cria uma
 * rota de painel sem guarda, e é aí que a verificação vale alguma coisa.
 *
 * A restrição 1 do anexo do PRD manda verificar pelo código produzido, e não
 * pela renderização no navegador. É literalmente o que acontece aqui.
 */

const RAIZ = process.cwd()

const GUARDA_DE_API = 'exigirOperadorNaApi'
const GUARDA_DE_PAGINA = 'exigirOperador'
const MODULO_DE_SESSAO = 'src/contexts/identidade/servico.ts'

function arquivos(diretorio: string): string[] {
  let entradas: string[]

  try {
    entradas = readdirSync(diretorio)
  } catch {
    return []
  }

  return entradas.flatMap((entrada) => {
    const caminho = join(diretorio, entrada)
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho]
  })
}

function ler(caminho: string): string {
  return readFileSync(caminho, 'utf8')
}

function relativo(caminho: string): string {
  return relative(RAIZ, caminho).split(sep).join('/')
}

const codigoDoProjeto = [...arquivos(join(RAIZ, 'app')), ...arquivos(join(RAIZ, 'src'))].filter(
  (caminho) => caminho.endsWith('.ts') || caminho.endsWith('.tsx'),
)

describe('guarda das rotas de API do painel (RF-11)', () => {
  const rotas = arquivos(join(RAIZ, 'app', 'api', 'painel')).filter((c) => c.endsWith('route.ts'))

  it('existe ao menos uma rota de painel para guardar', () => {
    // Sem isto, o teste seguinte passaria vazio no dia em que alguém movesse o
    // diretório — e um teste que passa por não encontrar nada é pior que nada.
    expect(rotas.length).toBeGreaterThan(0)
  })

  it.each(rotas.map(relativo))('%s chama a guarda de API', (caminho) => {
    expect(ler(join(RAIZ, caminho))).toContain(GUARDA_DE_API)
  })

  it.each(rotas.map(relativo))('%s não consulta o banco direto', (caminho) => {
    // Restrição 3 do anexo do PRD. O lint já barra, e este teste é o que
    // continua valendo se alguém afrouxar a configuração do lint.
    const conteudo = ler(join(RAIZ, caminho))

    expect(conteudo).not.toMatch(/from '@\/db/)
    expect(conteudo).not.toMatch(/from '@\/infra/)
  })
})

describe('guarda das páginas do painel (RF-11)', () => {
  const paginas = arquivos(join(RAIZ, 'app', 'painel')).filter((c) => c.endsWith('page.tsx'))

  it('toda página do painel está sob o grupo (protegido), fora a de login', () => {
    const desprotegidas = paginas
      .map(relativo)
      .filter((c) => !c.includes('(protegido)') && !c.includes('/login/'))

    // Uma página nova em `app/painel/fila/page.tsx` não passaria pelo layout
    // que exige sessão: o grupo é o que garante que a guarda seja alcançada, e
    // é invisível na URL, então some da revisão com facilidade.
    expect(desprotegidas).toEqual([])
  })

  it('o layout do grupo protegido exige Operador antes de renderizar', () => {
    const layout = ler(join(RAIZ, 'app', 'painel', '(protegido)', 'layout.tsx'))

    expect(layout).toContain(GUARDA_DE_PAGINA)
    // Uma página do painel guardada por cache de borda entregaria a fila de um
    // Operador ao próximo visitante.
    expect(layout).toContain("dynamic = 'force-dynamic'")
  })

  it('a tela de login está fora do grupo protegido', () => {
    // Dentro dele, quem chega sem sessão seria mandado para o login, que
    // exigiria sessão, que mandaria para o login.
    const login = paginas.map(relativo).filter((c) => c.includes('/login/'))

    expect(login).toEqual(['app/painel/login/page.tsx'])
  })
})

describe('sem auto-cadastro (RNF-14)', () => {
  it('nenhuma rota, página ou componente alcança a criação de conta', () => {
    // Importação ou chamada, não menção: a rota de sessão **documenta** em
    // comentário que não há caminho HTTP até a criação de conta, e um teste que
    // proibisse a palavra puniria justamente quem escreveu a razão da regra.
    const alcanca =
      /from '.*(criarOperador|destravarLogin)'|\b(criarOperador|desativarOperador|destravarLogin)\s*\(/

    const infratores = arquivos(join(RAIZ, 'app'))
      .filter((c) => c.endsWith('.ts') || c.endsWith('.tsx'))
      .filter((c) => alcanca.test(ler(c)))
      .map(relativo)

    // A criação de conta é do CLI de `scripts/criar-operador.ts`, e a
    // autorização para ela é ter acesso ao ambiente — não uma permissão que o
    // próprio sistema conceda e que alguém possa escalar.
    expect(infratores).toEqual([])
  })

  it('o único caminho até a criação de conta é o script de terminal', () => {
    const chamadores = codigoDoProjeto
      .concat(arquivos(join(RAIZ, 'scripts')).filter((c) => c.endsWith('.ts')))
      .filter((c) => !c.endsWith(join('identidade', 'criarOperador.ts')))
      .filter((c) => !c.endsWith(join('identidade', 'destravarLogin.ts')))
      .filter((c) => /from '@\/contexts\/identidade\/(criarOperador|destravarLogin)'/.test(ler(c)))
      .map(relativo)

    expect(chamadores).toEqual(['scripts/criar-operador.ts'])
  })
})

describe('o cookie de sessão é lido em um lugar só (T08, item 5)', () => {
  it('nenhum arquivo fora de identidade/servico.ts conhece o nome do cookie', () => {
    const infratores = codigoDoProjeto
      .filter((c) => relativo(c) !== MODULO_DE_SESSAO)
      .filter((c) => /speedx_sessao/.test(ler(c)))
      .map(relativo)

    expect(infratores).toEqual([])
  })

  it('nenhum arquivo fora de identidade/servico.ts lê cookie de requisição', () => {
    // `cookies()` de `next/headers` é a única porta para o cookie no servidor.
    // Concentrá-la é o que faz `getOperadorAtual` ser de fato a interface de
    // autenticação, e não apenas a interface recomendada.
    const infratores = codigoDoProjeto
      .filter((c) => relativo(c) !== MODULO_DE_SESSAO)
      .filter((c) => /from 'next\/headers'/.test(ler(c)))
      .map(relativo)

    expect(infratores).toEqual([])
  })
})
