import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

/**
 * Massa de desenvolvimento: 2000 Participantes e ~3000 Tentativas (RNF-02).
 *
 * Não é dado bonito — é dado que reproduz o que quebra:
 *  - **homônimos**, porque em 2000 cadastros brasileiros nomes repetidos são
 *    certeza, e distinguir os dois é o trabalho do Operador (RF-15);
 *  - **acentos**, porque a busca precisa lidar com "João" (RF-16);
 *  - **menores de idade** com Responsável, porque é o fluxo com mais regra;
 *  - **empates de tempo**, porque o desempate é o que decide o pódio (RF-31);
 *  - **ausentes e pendentes**, porque Fila e Exportação divergem justamente aí.
 *
 * Determinística de propósito: semente fixa produz a mesma massa toda vez, e um
 * teste de carga cujo dado muda a cada execução não compara com o anterior.
 *
 * Os identificadores são gerados aqui, não pelo banco, para que tudo entre em
 * lotes. Inserir linha a linha custava ~100 ms por participante — três minutos
 * só para montar a base antes de qualquer medição de T18.
 */

/** Aceita qualquer driver Postgres do Drizzle: `pg` em produção, PGlite nos testes. */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const SEMENTE_PADRAO = 42
const TAMANHO_DO_LOTE = 500

/** Gerador congruente linear com semente fixa. */
function aleatorio(semente: number): () => number {
  let estado = semente

  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return estado / 4_294_967_296
  }
}

const NOMES = [
  'João',
  'Maria',
  'José',
  'Ana',
  'Pedro',
  'Íris',
  'Lucas',
  'Júlia',
  'Gabriel',
  'Beatriz',
  'Rafael',
  'Letícia',
  'Thiago',
  'Camila',
  'André',
  'Larissa',
  'Mateus',
  'Fernanda',
  'Bruno',
  'Sofia',
] as const

const SOBRENOMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Rodrigues',
  'Ferreira',
  'Alves',
  'Pereira',
  'Lima',
  'Gomes',
  'Costa',
  'Ribeiro',
  'Martins',
  'Carvalho',
  'Almeida',
  'Gonçalves',
] as const

export type ResumoSeed = {
  participantes: number
  menores: number
  tentativas: number
  validas: number
  ausentes: number
  pendentes: number
}

async function inserirEmLotes<T>(
  linhas: T[],
  gravar: (lote: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < linhas.length; i += TAMANHO_DO_LOTE) {
    await gravar(linhas.slice(i, i + TAMANHO_DO_LOTE))
  }
}

export async function popular(
  db: Db,
  {
    participantes = 2000,
    semente = SEMENTE_PADRAO,
    proporcaoNosDoisCockpits = 0.5,
  }: {
    participantes?: number
    semente?: number
    /**
     * Fração que disputa os **dois** Cockpits (RF-03). Padrão 0,5, que é a
     * massa realista de desenvolvimento — cerca de 1,5 Tentativa por pessoa.
     *
     * T18 usa 1: 2000 pessoas viram 4000 Tentativas, que é o **teto** do
     * evento e o pior caso do documento público. Um teste de carga contra a
     * média mede o dia bom; o número que interessa é o do dia cheio.
     */
    proporcaoNosDoisCockpits?: number
  } = {},
): Promise<ResumoSeed> {
  const rnd = aleatorio(semente)
  const inicio = new Date('2026-08-18T08:00:00Z').getTime()

  const operadorId = randomUUID()
  await db.insert(schema.operador).values({
    id: operadorId,
    usuario: 'seed',
    nome: 'Operador de Teste',
    senhaHash: 'nao-serve-para-login',
  })

  const participantesLinhas: (typeof schema.participante.$inferInsert)[] = []
  const responsaveisLinhas: (typeof schema.responsavel.$inferInsert)[] = []
  const consentimentosLinhas: (typeof schema.consentimento.$inferInsert)[] = []
  const tentativasLinhas: (typeof schema.tentativa.$inferInsert)[] = []

  const resumo: ResumoSeed = {
    participantes: 0,
    menores: 0,
    tentativas: 0,
    validas: 0,
    ausentes: 0,
    pendentes: 0,
  }

  for (let i = 0; i < participantes; i += 1) {
    const id = randomUUID()
    const nome = NOMES[Math.floor(rnd() * NOMES.length)]!
    const sobrenome = SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]!

    // 8% de menores: proporção suficiente para o fluxo de Responsável aparecer
    // em qualquer amostra sem dominar a massa.
    const menor = rnd() < 0.08
    const idade = menor ? 13 + Math.floor(rnd() * 5) : 18 + Math.floor(rnd() * 45)
    const inscritoEm = new Date(inicio + i * 15_000)

    participantesLinhas.push({
      id,
      nome,
      sobrenome,
      email: `participante${i}@exemplo.com`,
      telefone: `119${String(10_000_000 + i).slice(0, 8)}`,
      idade,
      criadoEm: inscritoEm,
    })
    resumo.participantes += 1

    if (menor) {
      resumo.menores += 1
      responsaveisLinhas.push({
        participanteId: id,
        nome: NOMES[Math.floor(rnd() * NOMES.length)]!,
        sobrenome,
        telefone: `1198${String(1_000_000 + i).slice(0, 7)}`,
      })
    }

    consentimentosLinhas.push({
      participanteId: id,
      versaoTermo: 'v1.0-seed',
      aceiteParticipante: true,
      aceiteResponsavel: menor ? true : null,
      // Cerca de um terço recusa o repasse opcional (D-23). A massa precisa ter
      // os dois casos: a exportação de T14 e o expurgo de T15 tratam cada um de
      // um jeito, e base só com "sim" esconderia o caminho da recusa.
      aceiteCompartilhamento: rnd() < 0.66,
    })

    // Metade corre os dois Cockpits (RF-03) — ou toda a massa, sob T18.
    const cockpits = rnd() < proporcaoNosDoisCockpits ? [1, 2] : [rnd() < 0.5 ? 1 : 2]

    for (const cockpit of cockpits) {
      const sorteio = rnd()

      // Tempos concentrados numa faixa estreita e em passos de 100 ms, para que
      // empates aconteçam de verdade e o desempate seja exercitado (RF-31).
      const tempoMs = 60_000 + Math.floor(rnd() * 600) * 100

      if (sorteio < 0.82) {
        resumo.validas += 1
        tentativasLinhas.push({
          participanteId: id,
          cockpit,
          estado: 'valida',
          tempoMs,
          inscritoEm,
          resolvidoEm: new Date(inicio + 3_600_000 + resumo.validas * 1_000),
          operadorId,
        })
      } else if (sorteio < 0.9) {
        resumo.ausentes += 1
        tentativasLinhas.push({
          participanteId: id,
          cockpit,
          estado: 'ausente',
          inscritoEm,
          resolvidoEm: new Date(inicio + 3_600_000 + resumo.ausentes * 1_000),
          operadorId,
        })
      } else {
        resumo.pendentes += 1
        tentativasLinhas.push({ participanteId: id, cockpit, inscritoEm })
      }

      resumo.tentativas += 1
    }
  }

  await inserirEmLotes(participantesLinhas, (lote) => db.insert(schema.participante).values(lote))
  await inserirEmLotes(responsaveisLinhas, (lote) => db.insert(schema.responsavel).values(lote))
  await inserirEmLotes(consentimentosLinhas, (lote) => db.insert(schema.consentimento).values(lote))
  await inserirEmLotes(tentativasLinhas, (lote) => db.insert(schema.tentativa).values(lote))

  // Sem estatísticas atualizadas, o planejador escolhe plano errado e qualquer
  // medição de desempenho depois disto mede a falta de `analyze`.
  await db.execute(sql`analyze`)

  return resumo
}
