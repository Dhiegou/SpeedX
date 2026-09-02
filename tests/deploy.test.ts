import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exigeTls, pareceComPooler, urlDeMigracao } from '@/db'
import { validarAmbiente } from '@/shared/env'

/**
 * As promessas de T19 que o repositório **consegue** guardar sozinho.
 *
 * A maior parte de T19 mora fora daqui: HTTP/3 é da borda, o relógio é do
 * provedor, a restauração de backup é um ensaio com data marcada. O checklist
 * de `docs/deploy.md` §8 existe para essas, e uma pessoa as executa.
 *
 * Sobram quatro que são código, e que quebram calado quando quebram:
 *
 * 1. **Uma rota nova sem `no-store`.** O cache de borda é a defesa de RNF-01, e
 *    a mesma configuração que faz a Classificação escalar serviria a exportação
 *    de alguém para o próximo que pedisse a URL. Ninguém percebe até acontecer.
 * 2. **Um campo de instante aceito do cliente.** Bastaria um `dataHora` num
 *    esquema Zod para o relógio de um tablet passar a decidir o desempate de
 *    RF-31 — e o teste de comportamento continuaria verde, porque o
 *    comportamento não muda; muda de quem é o relógio.
 * 3. **O documento e o código discordando de região.** A escolha de `gru1` só
 *    faz sentido colada à do banco (D-79); se uma mudar sem a outra, a página
 *    da Classificação passa a atravessar o continente a cada primeira pintura e
 *    nada no repositório reclama.
 * 4. **Um arquivo de código que o `.gitignore` engole.** Aconteceu: o padrão
 *    `exportacao/`, escrito para barrar CSV despejado, casava em qualquer nível
 *    e levava junto `app/api/exportacao/` — a rota inteira de T14. O arquivo
 *    existia no disco, a suíte passava aqui, e o deploy sairia sem exportação.
 */

const RAIZ = process.cwd()

const ler = (...partes: string[]): string => readFileSync(join(RAIZ, ...partes), 'utf8')

/** Todo `route.ts` sob `app/`. */
function rotas(): string[] {
  const encontradas: string[] = []

  const varrer = (diretorio: string): void => {
    for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
      const caminho = join(diretorio, entrada.name)

      if (entrada.isDirectory()) {
        varrer(caminho)
        continue
      }

      if (entrada.name === 'route.ts') encontradas.push(caminho)
    }
  }

  varrer(join(RAIZ, 'app'))

  return encontradas
}

describe('cache de borda: só a Classificação é cacheável (T19 §4)', () => {
  const todas = rotas()

  it('a varredura continua encontrando as rotas', () => {
    // Se `app/` mudar de forma e isto virar zero, todos os casos abaixo
    // passariam por vacuidade.
    expect(todas.length).toBeGreaterThanOrEqual(10)
  })

  it('RNF-01 — a Classificação declara janela de borda e revalidação em segundo plano', () => {
    const fonte = ler('app', 'api', 'classificacao', 'route.ts')

    expect(fonte).toMatch(/s-maxage=\$\{String\(JANELA_DE_CACHE_S\)\}/)
    expect(fonte).toMatch(/stale-while-revalidate/)
  })

  it('RNF-10 — nenhuma outra rota é guardável por borda ou navegador', () => {
    const cacheaveis = todas
      .filter((caminho) => !caminho.endsWith(join('classificacao', 'route.ts')))
      .filter((caminho) => {
        const fonte = readFileSync(caminho, 'utf8')
        return /s-maxage|max-age=[1-9]|public,/.test(fonte)
      })
      .map((caminho) => relative(RAIZ, caminho))

    expect(cacheaveis).toEqual([])
  })

  it('RNF-10 — toda rota de API responde com `no-store`, própria ou herdada', () => {
    // As rotas do painel não escrevem o cabeçalho: elas respondem por
    // `responder`/`falha` de `_apoio.ts`, que carrega `SEM_CACHE` em toda
    // resposta (T10, regra 5). Escrever `no-store` seis vezes é como cinco
    // delas deixam de valer numa — o teste aceita a herança, mas exige uma
    // das duas.
    const semDeclaracao = todas
      .filter((caminho) => {
        const fonte = readFileSync(caminho, 'utf8')
        return !fonte.includes('no-store') && !fonte.includes('_apoio')
      })
      .map((caminho) => relative(RAIZ, caminho))

    // A Classificação também passa: o corpo dela é cacheável, mas o 503 não.
    expect(semDeclaracao).toEqual([])
  })

  it('RNF-10 — o cabeçalho herdado pelas rotas do painel continua sendo `no-store`', () => {
    // O elo que o caso acima aceita de olhos fechados. Se `SEM_CACHE` de
    // `_apoio.ts` virar outra coisa, seis rotas mudam de comportamento em
    // silêncio e nenhuma delas menciona cache no próprio arquivo.
    const apoio = ler('app', 'api', 'painel', '_apoio.ts')

    expect(apoio).toMatch(/SEM_CACHE = \{ 'Cache-Control': 'no-store' \}/)
  })
})

describe('relógio do servidor: nenhum instante vem do cliente (T19 §5, FL-10)', () => {
  it('RF-23 — nenhum esquema de entrada da API aceita data, instante ou horário', () => {
    const esquemas = [
      join('src', 'contexts', 'cronometragem', 'schema.ts'),
      join('src', 'contexts', 'inscricao', 'schema.ts'),
    ]

    for (const caminho of esquemas) {
      const fonte = readFileSync(join(RAIZ, caminho), 'utf8')

      // As formas com que uma data entraria por Zod. Se uma delas aparecer,
      // alguém abriu caminho para o relógio de um dispositivo.
      expect(fonte, caminho).not.toMatch(/z\.date\(|z\.iso\.|\.datetime\(|coerce\.date/)
    }
  })

  it('RF-31 — toda coluna de instante é gravada com fuso, e não como hora solta', () => {
    const fonte = ler('src', 'db', 'schema.ts')

    const colunas = [...fonte.matchAll(/timestamp\((?:\s|\S)*?\)/g)].map((a) => a[0])

    expect(colunas.length).toBeGreaterThanOrEqual(10)

    for (const coluna of colunas) {
      expect(coluna, coluna).toMatch(/withTimezone:\s*true/)
    }
  })

  it('RF-23 — o carimbo do Lançamento nasce do processo, não do corpo da requisição', () => {
    // `agora` existe como semente de teste em `lancamento.ts` (T09). O que não
    // pode existir é uma rota repassando algo do cliente para lá.
    for (const caminho of rotas()) {
      const fonte = readFileSync(caminho, 'utf8')
      expect(fonte, relative(RAIZ, caminho)).not.toMatch(/\bagora\s*:/)
    }
  })
})

describe('o deploy sai do commit, e o commit tem tudo (T19 §6)', () => {
  it('nenhum arquivo de código é engolido pelo .gitignore', () => {
    // Aconteceu com `app/api/exportacao/route.ts`, e passou despercebido de T14
    // até T19: `exportacao/` no .gitignore, escrito para barrar CSV despejado,
    // casa em **qualquer** nível. A rota existia no disco, a suíte rodava sobre
    // ela, e o repositório não a tinha. Um clone limpo não teria exportação.
    //
    // O que quebra este teste é sempre a mesma coisa: um padrão de ignorar
    // largo demais. A correção é ancorá-lo com `/` no início.
    const ignorados = execFileSync(
      'git',
      ['status', '--ignored', '--short', 'app', 'src', 'tests', 'e2e', 'scripts'],
      { cwd: RAIZ, encoding: 'utf8' },
    )
      .split('\n')
      .filter((linha) => linha.startsWith('!!'))
      .map((linha) => linha.slice(3).trim())

    expect(ignorados).toEqual([])
  })
})

describe('TLS na conexão com o banco é decidido pelo destino (FL-09)', () => {
  it('qualquer host de rede exige TLS, e nenhuma variável de ambiente desliga', () => {
    for (const url of [
      'postgresql://u:s@ep-abc-123-pooler.sa-east-1.aws.neon.tech/speedx',
      'postgresql://u:s@10.0.0.7:5432/speedx',
      'postgresql://u:s@db.interno.example/speedx',
    ]) {
      expect(exigeTls(url), url).toBe(true)
    }
  })

  it('só o laço local dispensa TLS — ali não há rede a proteger', () => {
    for (const url of [
      'postgresql://u:s@localhost:5432/speedx',
      'postgresql://u:s@127.0.0.1:5432/speedx_carga',
    ]) {
      expect(exigeTls(url), url).toBe(false)
    }
  })

  it('URL ilegível exige TLS — a dúvida não relaxa a regra', () => {
    expect(exigeTls('não é uma url')).toBe(true)
  })

  it('T18 — a regra antiga proibiria medir, e a nova protege mais, não menos', () => {
    // Antes o critério era `NODE_ENV === 'production'`, e errava dos dois lados:
    // desenvolvimento contra banco remoto trafegava em claro, e o artefato de
    // produção não subia contra um Postgres local — que é o que T18 precisa.
    const fonte = ler('src', 'db', 'index.ts')

    expect(fonte).not.toMatch(/ssl:.*NODE_ENV/)
    expect(fonte).toMatch(/rejectUnauthorized: true/)
  })
})

describe('a migração vai pela conexão direta, não pelo pooler (D-80)', () => {
  // Servir requisição e migrar querem coisas opostas do mesmo banco. A
  // aplicação precisa do pooler — trinta instâncias efêmeras a cinco conexões
  // pedem mais do que o Postgres oferece. A migração precisa do Postgres: o
  // PgBouncer em modo transação não repassa CREATE INDEX CONCURRENTLY nem
  // bloqueio de sessão.
  //
  // `docs/deploy.md` §3 dizia isso desde sempre, e mesmo assim `migrate.ts`
  // lia `DATABASE_URL` — a do pooler. Documento não é guarda: das cinco
  // migrações de hoje nenhuma usa CONCURRENTLY, então a coisa errada passaria
  // calada até a primeira que usar.

  const nuvem = {
    DATABASE_URL: 'postgresql://u:s@ep-abc-123-pooler.sa-east-1.aws.neon.tech/speedx',
    DATABASE_URL_UNPOOLED: 'postgresql://u:s@ep-abc-123.sa-east-1.aws.neon.tech/speedx',
  }

  it('prefere a direta quando ela existe', () => {
    expect(urlDeMigracao(nuvem)).toBe(nuvem.DATABASE_URL_UNPOOLED)
    expect(pareceComPooler(urlDeMigracao(nuvem))).toBe(false)
  })

  it('sem direta declarada, usa a única que há — que é o caso do banco local', () => {
    // Contra localhost não existe pooler, e exigir a variável só criaria um
    // passo a mais para quem sobe o projeto ou mede a carga (T18).
    const local = { DATABASE_URL: 'postgresql://u:s@localhost:5432/speedx' }

    expect(urlDeMigracao(local)).toBe(local.DATABASE_URL)
  })

  it('reconhece o host do pooler, para o comando poder avisar antes de aplicar', () => {
    expect(pareceComPooler(nuvem.DATABASE_URL)).toBe(true)
    expect(pareceComPooler('postgresql://u:s@localhost:5432/speedx')).toBe(false)
    expect(pareceComPooler('não é uma url')).toBe(false)
  })

  it('o comando de migração não volta a ler DATABASE_URL direto', () => {
    // O defeito não é de comportamento observável: as duas strings alcançam o
    // mesmo banco e a suíte passaria dos dois jeitos. O que este teste guarda é
    // por onde a conexão sai.
    const fonte = ler('src', 'db', 'migrate.ts')

    expect(fonte).toMatch(/urlDeMigracao\(/)
    expect(fonte).not.toMatch(/connectionString: DATABASE_URL/)
  })
})

describe('configuração de publicação (T19 §1, §2 e §6)', () => {
  it('a função roda na mesma cidade do banco', () => {
    const vercel = JSON.parse(ler('vercel.json')) as { regions?: string[] }
    const deploy = ler('docs', 'deploy.md')

    expect(vercel.regions).toEqual(['gru1'])

    // O documento é quem explica o porquê; se a região mudar aqui e não lá, a
    // próxima pessoa lê uma justificativa que descreve outra infraestrutura.
    expect(deploy).toContain('gru1')
    expect(deploy).toContain('sa-east-1')
  })

  it('HSTS só sai em produção, e não alcança o localhost de quem desenvolve', () => {
    const fonte = ler('next.config.ts')

    const hsts = /value: '(max-age=[^']*)'/.exec(fonte)?.[1]

    expect(hsts).toBeDefined()
    expect(fonte).toMatch(/Strict-Transport-Security/)
    expect(fonte).toMatch(/NODE_ENV === 'production'/)

    // Sem `preload`, e a asserção olha o **valor**, não o arquivo: o comentário
    // ao lado explica justamente por que a palavra não está lá (D-81), e um
    // teste que varresse o arquivo inteiro proibiria a explicação junto com a
    // configuração. O site sai do ar em 04/11/2026; a lista de pré-carga
    // demora meses para soltar um domínio.
    expect(hsts).not.toContain('preload')
  })

  it('a versão publicada responde sozinha, sem ninguém editar variável a cada deploy', () => {
    const fonte = ler('src', 'shared', 'env.ts')

    expect(fonte).toMatch(/VERCEL_GIT_COMMIT_SHA/)
    expect(fonte).toMatch(/slice\(0, 7\)/)
  })
})

/**
 * O piso da calibração de T23 (RNF-12, RNF-15).
 *
 * **O que este bloco protege não é o número, é a memória de por que ele é
 * esse.** T18 rodou 200 cadastros legítimos de um mesmo IP e o limite aceitou
 * exatamente 30, recusando 170 com 429 — o comportamento configurado, sobre uma
 * configuração errada para o evento. Sem teste, o padrão volta a 30 na primeira
 * vez que alguém copiar um `.env` antigo ou "arredondar" o número achando que
 * está apertando a segurança, e o defeito só aparece com a fila parada e o 429
 * na tela de quem não fez nada de errado.
 *
 * As asserções leem os padrões **do esquema**, e não da variável de ambiente da
 * máquina que roda a suíte: o padrão é o que vale quando alguém esquece de
 * definir a variável, e é ele que um ambiente novo herda.
 */
describe('limite de taxa do cadastro: os padrões não recusam a fila (T23)', () => {
  // Piso, e não o valor exato. Subir é decisão livre — T23 §2 diz que subir
  // custa pouco, porque o limite existe contra automação em escala e um
  // atacante decidido não passa pelo NAT do evento. O que precisa de conta
  // refeita é descer.
  const PISO_POR_JANELA = 800
  const PISO_POR_HORA = 2_400

  const PORQUE =
    'o padrão recusaria a fila do evento; ver docs/relatorio-carga.md §4 e D-90 no CONTEXT.md'

  const padroes = (): ReturnType<typeof validarAmbiente> =>
    validarAmbiente({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/speedx',
      SESSION_SECRET: 'x'.repeat(32),
      APP_URL: 'http://localhost:3000',
    })

  it('RNF-12 — o padrão por janela não desce do piso calibrado', () => {
    const { RATE_LIMIT_CADASTROS_POR_JANELA: janela } = padroes()

    expect(
      janela,
      `RATE_LIMIT_CADASTROS_POR_JANELA=${String(janela)}, abaixo de ` +
        `${String(PISO_POR_JANELA)}: ${PORQUE}. Com o padrão antigo de 30, T18 mediu ` +
        `30 cadastros aceitos e 170 recusados com 429 em 200 do mesmo IP.`,
    ).toBeGreaterThanOrEqual(PISO_POR_JANELA)
  })

  it('RNF-12 — o padrão por hora não desce do piso calibrado', () => {
    const { RATE_LIMIT_CADASTROS_POR_HORA: hora } = padroes()

    expect(
      hora,
      `RATE_LIMIT_CADASTROS_POR_HORA=${String(hora)}, abaixo de ${String(PISO_POR_HORA)}: ` +
        `${PORQUE}. A faixa de hora é a segunda porta: afrouxar a janela sem ` +
        `afrouxar esta apenas adia a recusa em alguns minutos.`,
    ).toBeGreaterThanOrEqual(PISO_POR_HORA)
  })

  it('a faixa de hora acomoda mais que uma janela, senão ela é o limite de fato', () => {
    const { RATE_LIMIT_CADASTROS_POR_JANELA: janela, RATE_LIMIT_CADASTROS_POR_HORA: hora } =
      padroes()

    // Duas faixas em que a menor manda sempre são uma faixa só com um número
    // decorativo ao lado — e o número decorativo é justamente o que confunde
    // quem for recalibrar às pressas no dia do evento.
    expect(
      hora,
      `RATE_LIMIT_CADASTROS_POR_HORA=${String(hora)} não é maior que a janela ` +
        `(${String(janela)}): a faixa de hora recusaria antes da janela, e calibrar ` +
        `a janela viraria enfeite.`,
    ).toBeGreaterThan(janela)
  })

  it('a janela continua abaixo do que a faxina de 48 h preserva', () => {
    // `infra/higiene.ts` apaga marcas de limite com mais de 48 h. Uma janela
    // maior que isso contaria sobre linhas que a faxina já levou — um limite
    // que não protege e se apaga sozinho.
    const { RATE_LIMIT_JANELA_SEGUNDOS: segundos } = padroes()

    expect(segundos).toBeLessThanOrEqual(86_400)
  })

  it('.env.example não contradiz o padrão do código', () => {
    // O arquivo é o que as pessoas copiam. Um exemplo com o número antigo
    // reintroduz o defeito por cópia, sem passar por decisão nenhuma.
    const exemplo = ler('.env.example')

    const lido = (chave: string): number =>
      Number(new RegExp(`^${chave}="?(\\d+)"?$`, 'm').exec(exemplo)?.[1] ?? NaN)

    expect(lido('RATE_LIMIT_CADASTROS_POR_JANELA')).toBeGreaterThanOrEqual(PISO_POR_JANELA)
    expect(lido('RATE_LIMIT_CADASTROS_POR_HORA')).toBeGreaterThanOrEqual(PISO_POR_HORA)
  })
})
