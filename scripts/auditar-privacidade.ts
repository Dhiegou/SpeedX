import { Pool } from 'pg'
import { exigeTls } from '@/db'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { env } from '@/shared/env'

/**
 * Auditoria de privacidade executável (T21 Parte 1 — RNF-08, RNF-09, RNF-10).
 *
 * `npm run auditar` · `npm run auditar -- https://<dominio>`
 *
 * **Por que um comando e não uma leitura.** A T21 manda auditar por leitura do
 * código, e a leitura está feita — está escrita em `docs/checklist-pre-evento.md`.
 * Mas leitura confere o código de hoje contra a massa de hoje. Este comando
 * confere o **corpo que sai de verdade** contra o **banco de verdade**, e pode
 * ser repetido contra homologação, contra produção na véspera e contra produção
 * no meio do evento — que é quando o dado deixa de ser sintético.
 *
 * As três perguntas que ele responde, e nenhuma delas se responde lendo:
 *
 *  1. **Algum menor de 18 teve o sobrenome publicado?** (RNF-09) O teste de
 *     unidade prova que `paraNomePublico` abrevia; isto prova que ninguém
 *     escapou da função no caminho até a rede, com a base inteira.
 *  2. **Sobrou algum campo pessoal no corpo público?** (RNF-08) E-mail,
 *     telefone, idade, dado de Responsável.
 *  3. **Alguma rota de dado completo responde sem sessão?** (RNF-10)
 *
 * **O homônimo é a armadilha, e ele derrubou a primeira versão deste script.**
 * Se um adulto e um menor se chamam "Pedro Rodrigues", o nome completo aparece
 * legitimamente na página, publicado pelo adulto — então perguntar "o nome
 * completo do menor aparece no corpo?" acusa vazamento onde não há. A ressalva
 * óbvia ("a não ser que exista adulto homônimo") é pior: contra a massa real
 * ela dispensou **151 de 151** menores, e o script passou a dizer "ok" sem ter
 * verificado nada. Vinte nomes e vinte sobrenomes em duas mil pessoas colidem
 * sempre. A verificação de RNF-09 é por **contagem** — ver `auditarNomes`.
 */

carregarAmbienteDoTerminal()

const ALVO = process.argv[2] ?? 'http://localhost:3300'

type Achado = { gravidade: 'falha' | 'ok' | 'aviso'; o_que: string; detalhe: string }

const achados: Achado[] = []

const anotar = (gravidade: Achado['gravidade'], o_que: string, detalhe: string): void => {
  achados.push({ gravidade, o_que, detalhe })
}

type Pessoa = { nome: string; sobrenome: string; idade: number }

/**
 * RNF-09 — nenhum sobrenome completo de menor de 18 sai na página pública.
 *
 * **A verificação é por contagem, e a primeira versão deste script era por
 * presença.** Ela perguntava "o nome completo do menor aparece no corpo?", com
 * a ressalva "a não ser que exista um adulto homônimo que o tenha publicado
 * legitimamente". Contra a massa real a ressalva engoliu tudo: **151 de 151
 * menores tinham adulto homônimo**, porque vinte nomes e vinte sobrenomes em
 * duas mil pessoas colidem sempre. O script dizia "ok" sem ter verificado nada.
 *
 * Contagem não tem esse buraco. Para cada par nome+sobrenome:
 *
 *  - o nome **completo** deve aparecer no documento exatamente tantas vezes
 *    quantas forem as Tentativas Válidas de **adultos** com aquele nome;
 *  - o nome **abreviado** deve aparecer exatamente tantas vezes quantas forem
 *    as dos **menores**.
 *
 * Um sobrenome de menor que escape produz uma ocorrência a mais no primeiro
 * número, e nenhum homônimo esconde isso.
 */
async function auditarNomes(
  pool: Pool,
  linhas: readonly (readonly [string, ...unknown[]])[],
): Promise<void> {
  const { rows } = await pool.query<Pessoa & { validas: string }>(
    `select p.nome, p.sobrenome, p.idade, count(*) as validas
     from participante p join tentativa t on t.participante_id = p.id
     where t.estado = 'valida'
     group by p.nome, p.sobrenome, p.idade`,
  )

  if (rows.length === 0) {
    anotar('aviso', 'RNF-09 — sobrenome de menor', 'nenhuma Tentativa válida na base')
    return
  }

  /** Quantas vezes cada nome público aparece no documento transmitido. */
  const publicados = new Map<string, number>()
  for (const [nome] of linhas) publicados.set(nome, (publicados.get(nome) ?? 0) + 1)

  /** O que o banco diz que **deveria** aparecer, e quantas vezes. */
  const esperado = new Map<string, number>()

  for (const r of rows) {
    const vezes = Number(r.validas)
    const chave = r.idade >= 18 ? `${r.nome} ${r.sobrenome}` : `${r.nome} ${[...r.sobrenome][0]!}.`

    esperado.set(chave, (esperado.get(chave) ?? 0) + vezes)
  }

  const divergencias: string[] = []

  for (const [nome, vezes] of esperado) {
    const publicado = publicados.get(nome) ?? 0
    if (publicado !== vezes)
      divergencias.push(`"${nome}": esperadas ${String(vezes)}, publicadas ${String(publicado)}`)
  }

  for (const nome of publicados.keys()) {
    if (!esperado.has(nome)) divergencias.push(`"${nome}": publicado sem origem no banco`)
  }

  const menores = rows.filter((r) => r.idade < 18)
  const tentativasDeMenores = menores.reduce((s, r) => s + Number(r.validas), 0)

  if (divergencias.length > 0) {
    anotar(
      'falha',
      'RNF-09 — nome publicado diverge do banco',
      divergencias.slice(0, 5).join(' · '),
    )
    return
  }

  anotar(
    'ok',
    'RNF-09 — sobrenome de menor',
    `${String(tentativasDeMenores)} Tentativas de menores publicadas com sobrenome abreviado; ` +
      `${String(esperado.size)} nomes distintos conferidos por contagem, nenhum a mais nem a menos`,
  )
}

/** RNF-08 — o corpo público não carrega campo pessoal nenhum. */
function auditarCorpoPublico(corpo: string): void {
  const email = corpo.match(/[A-Za-z0-9._+-]+@[A-Za-z0-9-]+\.[A-Za-z]+/g) ?? []
  // Dez dígitos seguidos é a forma de um telefone brasileiro sem máscara.
  const telefone = corpo.match(/\d{10,}/g) ?? []

  const chaves = [...new Set([...corpo.matchAll(/"([a-zA-Z]+)":/g)].map((a) => a[1]!))].sort()
  const esperadas = ['geradoEm', 'linhas', 'total']
  const inesperadas = chaves.filter((c) => !esperadas.includes(c))

  if (email.length > 0)
    anotar('falha', 'RNF-08 — e-mail no corpo público', email.slice(0, 3).join(', '))
  if (telefone.length > 0)
    anotar(
      'falha',
      'RNF-08 — sequência de telefone no corpo público',
      telefone.slice(0, 3).join(', '),
    )
  if (inesperadas.length > 0)
    anotar('falha', 'RNF-08 — campo inesperado no documento', inesperadas.join(', '))

  if (email.length === 0 && telefone.length === 0 && inesperadas.length === 0) {
    anotar(
      'ok',
      'RNF-08 — corpo público',
      `${String(Math.round(corpo.length / 1024))} KB, campos: ${chaves.join(', ')}`,
    )
  }
}

/** RNF-10 — dado pessoal completo exige sessão. */
async function auditarRotasProtegidas(): Promise<void> {
  const protegidas: [string, string][] = [
    ['GET', '/api/exportacao?tipo=completa'],
    ['GET', '/api/exportacao?tipo=repasse'],
    ['GET', '/api/exportacao?tipo=pendencias'],
    ['GET', '/api/metricas'],
    ['GET', '/api/painel/fila?cockpit=1'],
    ['GET', '/api/painel/participante?busca=a'],
    ['POST', '/api/painel/tempo'],
    ['POST', '/api/painel/ausencia'],
    ['POST', '/api/painel/tentativa'],
  ]

  const abertas: string[] = []

  for (const [metodo, caminho] of protegidas) {
    const resposta = await fetch(`${ALVO}${caminho}`, {
      method: metodo,
      ...(metodo === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
    })

    if (resposta.status !== 401) abertas.push(`${caminho} → ${String(resposta.status)}`)
  }

  if (abertas.length > 0) {
    anotar('falha', 'RNF-10 — rota de dado completo sem 401', abertas.join('; '))
    return
  }

  anotar(
    'ok',
    'RNF-10 — rotas protegidas',
    `${String(protegidas.length)} rotas responderam 401 sem cookie`,
  )
}

async function principal(): Promise<void> {
  const { DATABASE_URL } = env()

  console.log(`Auditando ${ALVO}\n`)

  const resposta = await fetch(`${ALVO}/api/classificacao`)

  if (!resposta.ok) {
    throw new Error(`/api/classificacao respondeu ${String(resposta.status)}.`)
  }

  const corpo = await resposta.text()
  const documento = JSON.parse(corpo) as { total: number; linhas: [string, number, number][] }
  const nomesPublicados = new Set(documento.linhas.map((l) => l[0]))

  auditarCorpoPublico(corpo)
  await auditarRotasProtegidas()

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: exigeTls(DATABASE_URL) ? { rejectUnauthorized: true } : undefined,
    max: 1,
  })

  try {
    await auditarNomes(pool, documento.linhas)
  } finally {
    await pool.end()
  }

  console.log(
    `Documento público: ${String(documento.total)} linhas, ${String(nomesPublicados.size)} nomes distintos.\n`,
  )

  for (const a of achados) {
    const marca = a.gravidade === 'falha' ? 'FALHA' : a.gravidade === 'aviso' ? 'aviso' : '  ok '
    console.log(`[${marca}] ${a.o_que}\n         ${a.detalhe}`)
  }

  const falhas = achados.filter((a) => a.gravidade === 'falha')

  if (falhas.length > 0) {
    console.error(`\n${String(falhas.length)} falha(s) de privacidade. Não publique assim.`)
    process.exit(1)
  }

  console.log('\nNenhum vazamento encontrado.')
}

principal().catch((erro: unknown) => {
  console.error('Falha ao auditar:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
