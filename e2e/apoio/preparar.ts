import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { criarOperador } from '@/contexts/identidade/criarOperador'
import { TERMO_V1_0 } from '@/contexts/inscricao/consentimento/v1-0'
import * as schema from '@/db/schema'
import { popular } from '@/db/seed'
import {
  ADULTA_CLASSIFICADA,
  CORREDORES_DE_ENSAIO,
  MENOR_DE_ENSAIO,
  OPERADORA,
  PARTICIPANTES_DO_SEED,
  SOBRENOME_DE_ENSAIO,
} from './dados'

/**
 * Preparo do banco dos testes de ponta a ponta (T17).
 *
 * **Banco próprio, descartável, recriado do zero a cada execução.** A
 * alternativa — apontar o e2e para o banco de desenvolvimento — economizaria
 * este arquivo e cobraria caro: o teste apaga e reescreve tudo, e a massa de
 * 2000 que T18 vai medir sumiria na primeira vez que alguém rodasse a suíte
 * distraído. Isolar transforma "cuidado ao rodar" em "não há o que dar errado".
 *
 * **Duas tentativas antes desta, e as duas ensinaram alguma coisa.**
 *
 * A primeira criava o banco e morria com "permissão negada ao criar banco de
 * dados": o papel da aplicação pode criar tabela e esquema, não banco — e é
 * assim que deve ser, porque é o mesmo papel que vai para produção.
 *
 * A segunda tentou isolar por **esquema**, com `search_path`, para não precisar
 * de privilégio nenhum. Morreu em `CREATE TYPE "public"."estado_tentativa"`:
 * o SQL gerado pelo drizzle-kit é **qualificado com `public`**, então as
 * migrações ignoram o `search_path` e insistem em escrever no esquema de
 * desenvolvimento. Reescrever o SQL em tempo de execução resolveria e trocaria
 * a coisa que mais importa aqui — que as migrações exercitadas sejam
 * exatamente as que vão para produção — por conveniência de ambiente.
 *
 * Sobrou o banco separado, que é o certo, e um privilégio a conceder uma vez:
 * `alter role <papel> createdb`. A mensagem de erro abaixo diz isso por
 * extenso, porque quem esbarrar nela daqui a seis meses não vai ter lido este
 * comentário.
 *
 * **Migrações de verdade, e não um esquema montado à parte.** As invariantes
 * caras deste sistema moram em constraints (D-05); montar as tabelas por outro
 * caminho testaria um banco que não é o que vai para produção.
 */

export const NOME_DO_BANCO_E2E = 'speedx_e2e'

/**
 * A `DATABASE_URL` do e2e, derivada da de desenvolvimento.
 *
 * Herda host, porta e credencial sem que este arquivo conheça nenhum dos três,
 * e sem uma segunda variável para alguém esquecer de configurar.
 */
export function urlDoBancoE2E(base: string): string {
  const url = new URL(base)
  url.pathname = `/${NOME_DO_BANCO_E2E}`
  return url.toString()
}

/** A URL do banco administrativo, para poder criar o outro. */
function urlAdministrativa(base: string): string {
  const url = new URL(base)
  url.pathname = '/postgres'
  return url.toString()
}

class BancoDeEnsaioAusenteError extends Error {
  constructor(papel: string) {
    super(
      `O banco "${NOME_DO_BANCO_E2E}" não existe e o papel "${papel}" não pode criá-lo.\n\n` +
        'Os testes de ponta a ponta não usam o banco de desenvolvimento de propósito: eles\n' +
        'apagam e reescrevem tudo, e a massa de 2000 sumiria junto.\n\n' +
        'Resolva uma vez, com um papel administrativo, de um dos dois jeitos:\n\n' +
        `  psql -c 'alter role "${papel}" createdb'        (a suíte passa a se virar sozinha)\n` +
        `  psql -c 'create database ${NOME_DO_BANCO_E2E} owner "${papel}"'\n`,
    )
    this.name = 'BancoDeEnsaioAusenteError'
  }
}

/** Falta de privilégio para criar banco. Qualquer outro erro é defeito. */
const semPrivilegio = (erro: unknown): boolean =>
  typeof (erro as { code?: unknown }).code === 'string' &&
  ['42501', '42P04'].includes((erro as { code: string }).code)

async function garantirBanco(base: string): Promise<void> {
  const admin = new Pool({ connectionString: urlAdministrativa(base), max: 1 })

  try {
    const existe = await admin.query('select 1 from pg_database where datname = $1', [
      NOME_DO_BANCO_E2E,
    ])

    if (existe.rowCount !== 0) return

    const consulta = await admin.query<{ papel: string }>('select current_user as papel')
    const papel = consulta.rows[0]?.papel ?? 'o papel da aplicação'

    try {
      // `create database` não aceita parâmetro e não roda dentro de transação;
      // daí o identificador entrar por interpolação. É uma constante deste
      // arquivo, não entrada de ninguém.
      await admin.query(`create database ${NOME_DO_BANCO_E2E}`)
    } catch (erro) {
      if (semPrivilegio(erro)) throw new BancoDeEnsaioAusenteError(papel)
      throw erro
    }
  } finally {
    await admin.end()
  }
}

type Db = ReturnType<typeof drizzle<typeof schema>>

async function semearNomeados(db: Db, operadorId: string): Promise<void> {
  // Os cinco de RF-19: pendentes no Pitch 1, na ordem de inscrição, que é a
  // ordem em que a Fila vai apresentá-los.
  for (const [posicao, corredor] of CORREDORES_DE_ENSAIO.entries()) {
    const [pessoa] = await db
      .insert(schema.participante)
      .values({
        nome: corredor.nome,
        sobrenome: SOBRENOME_DE_ENSAIO,
        email: `${corredor.nome.toLowerCase()}@exemplo.test`,
        telefone: `1195551${String(posicao).padStart(4, '0')}`,
        idade: corredor.idade,
        // Instantes crescentes e distintos: a Fila ordena por inscrição, e
        // cinco linhas com o mesmo carimbo teriam ordem indefinida.
        criadoEm: new Date(Date.UTC(2026, 8, 12, 9, posicao)),
      })
      .returning({ id: schema.participante.id })

    await db.insert(schema.consentimento).values({
      participanteId: pessoa!.id,
      versaoTermo: TERMO_V1_0.versao,
      aceiteParticipante: true,
    })

    await db.insert(schema.tentativa).values({
      participanteId: pessoa!.id,
      pitch: 1,
      inscritoEm: new Date(Date.UTC(2026, 8, 12, 9, posicao)),
    })
  }

  // A menor de idade, com Responsável: prova de RNF-09 na página pública.
  const [menor] = await db
    .insert(schema.participante)
    .values({
      nome: MENOR_DE_ENSAIO.nome,
      sobrenome: MENOR_DE_ENSAIO.sobrenome,
      email: MENOR_DE_ENSAIO.email,
      telefone: MENOR_DE_ENSAIO.telefone,
      idade: MENOR_DE_ENSAIO.idade,
    })
    .returning({ id: schema.participante.id })

  await db.insert(schema.responsavel).values({
    participanteId: menor!.id,
    ...MENOR_DE_ENSAIO.responsavel,
  })

  await db.insert(schema.consentimento).values({
    participanteId: menor!.id,
    versaoTermo: TERMO_V1_0.versao,
    aceiteParticipante: true,
    aceiteResponsavel: true,
  })

  await db.insert(schema.tentativa).values({
    participanteId: menor!.id,
    pitch: 1,
    estado: 'valida',
    tempoMs: 83_400,
    resolvidoEm: new Date(Date.UTC(2026, 8, 12, 10, 0)),
    operadorId,
  })

  // A adulta classificada, com sobrenome completo visível — o contraponto que
  // torna o teste de vazamento capaz de distinguir "não apareceu" de "a página
  // não carregou".
  const [adulta] = await db
    .insert(schema.participante)
    .values({
      nome: ADULTA_CLASSIFICADA.nome,
      sobrenome: ADULTA_CLASSIFICADA.sobrenome,
      email: ADULTA_CLASSIFICADA.email,
      telefone: ADULTA_CLASSIFICADA.telefone,
      idade: ADULTA_CLASSIFICADA.idade,
    })
    .returning({ id: schema.participante.id })

  await db.insert(schema.consentimento).values({
    participanteId: adulta!.id,
    versaoTermo: TERMO_V1_0.versao,
    aceiteParticipante: true,
  })

  await db.insert(schema.tentativa).values({
    participanteId: adulta!.id,
    pitch: 1,
    estado: 'valida',
    tempoMs: ADULTA_CLASSIFICADA.tempoMs,
    resolvidoEm: new Date(Date.UTC(2026, 8, 12, 10, 1)),
    operadorId,
  })
}

/**
 * Chamado uma vez por execução, antes de qualquer teste.
 *
 * Recebe a `DATABASE_URL` já carregada por quem chamou — este módulo não lê
 * ambiente nem arquivo, para poder ser exercitado de fora.
 */
export async function prepararBanco(base: string): Promise<void> {
  await garantirBanco(base)

  const pool = new Pool({ connectionString: urlDoBancoE2E(base), max: 1 })

  try {
    const db = drizzle(pool, { schema })

    await migrate(db, { migrationsFolder: './src/db/migrations' })

    // Do zero a cada execução: um teste que dependa do que a execução anterior
    // deixou passa uma vez e falha na seguinte, e o motivo é impossível de ver.
    await pool.query(`
      truncate table lancamento, tentativa, consentimento, responsavel, participante,
                     sessao, operador, chave_idempotencia, limite_taxa cascade;
    `)

    // `popular` cria o Operador do seed, que é quem assina os tempos semeados.
    const resumo = await popular(db, { participantes: PARTICIPANTES_DO_SEED })

    const [operadorDoSeed] = await db.select({ id: schema.operador.id }).from(schema.operador)

    await semearNomeados(db, operadorDoSeed!.id)

    // A conta que o teste usa para entrar passa pelo mesmo caso de uso do CLI
    // (RNF-14): não existe outro caminho que crie conta, nem para teste.
    await criarOperador(db, OPERADORA)

    console.log(
      `[e2e] banco "${NOME_DO_BANCO_E2E}" pronto: ` +
        `${String(resumo.participantes + CORREDORES_DE_ENSAIO.length + 2)} participantes, ` +
        `operadora "${OPERADORA.usuario}".`,
    )
  } finally {
    await pool.end()
  }
}
