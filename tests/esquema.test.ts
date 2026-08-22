import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '@/db/schema'
import {
  criarBancoDeTeste,
  participanteValido,
  violou,
  type BancoDeTeste,
} from './apoio/bancoDeTeste'

/**
 * As invariantes que o banco precisa recusar sozinho.
 *
 * RF-12 permite Operadores simultâneos, e sob concorrência a verificação em
 * aplicação tem uma janela entre conferir e gravar. Estes testes garantem que,
 * mesmo que algum caminho de código erre, o banco não aceita — e cada asserção
 * confere o **nome da constraint**, não só que a escrita falhou.
 */

let banco: BancoDeTeste

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel,
                   participante, operador, chave_idempotencia cascade;
  `)
})

async function criarParticipante(sobrescrever: Record<string, unknown> = {}): Promise<string> {
  const [linha] = await banco.db
    .insert(schema.participante)
    .values(participanteValido(sobrescrever) as typeof schema.participante.$inferInsert)
    .returning({ id: schema.participante.id })

  return linha!.id
}

async function criarOperador(usuario = 'ana'): Promise<string> {
  const [linha] = await banco.db
    .insert(schema.operador)
    .values({ usuario, nome: 'Ana Operadora', senhaHash: 'hash' })
    .returning({ id: schema.operador.id })

  return linha!.id
}

describe('participante', () => {
  it('RF-04 — idade 12 é recusada pelo banco', async () => {
    expect(await violou(criarParticipante({ idade: 12 }))).toMatch(/participante_idade_minima/)
  })

  it('RF-04 — idade 13 é aceita', async () => {
    await expect(criarParticipante({ idade: 13 })).resolves.toBeTypeOf('string')
  })

  it('telefone precisa ser só dígitos, no comprimento brasileiro', async () => {
    expect(await violou(criarParticipante({ telefone: '(11) 98765-4321' }))).toMatch(
      /participante_telefone_digitos/,
    )
    expect(await violou(criarParticipante({ telefone: '119876' }))).toMatch(
      /participante_telefone_digitos/,
    )
  })
})

describe('consentimento', () => {
  it('RF-08 — consentimento com aceite falso não existe', async () => {
    const participanteId = await criarParticipante()

    expect(
      await violou(
        banco.db.insert(schema.consentimento).values({
          participanteId,
          versaoTermo: 'v1.0',
          aceiteParticipante: false,
        }),
      ),
    ).toMatch(/consentimento_aceite_verdadeiro/)
  })

  it('RNF-07 — aceite do responsável nunca é registrado como falso', async () => {
    const participanteId = await criarParticipante({ idade: 15 })

    expect(
      await violou(
        banco.db.insert(schema.consentimento).values({
          participanteId,
          versaoTermo: 'v1.0',
          aceiteParticipante: true,
          aceiteResponsavel: false,
        }),
      ),
    ).toMatch(/consentimento_responsavel_nunca_falso/)
  })

  it('o repasse opcional aceita "não" — e o "não" fica registrado (D-23)', async () => {
    // Ao contrário dos outros dois aceites, `false` aqui é dado válido, não
    // violação. Se alguém acrescentar um check exigindo `true`, o repasse deixa
    // de ser opcional no banco e a recusa vira impossível de registrar.
    const participanteId = await criarParticipante()

    await banco.db.insert(schema.consentimento).values({
      participanteId,
      versaoTermo: 'v1.0',
      aceiteParticipante: true,
      aceiteCompartilhamento: false,
    })

    const [linha] = await banco.db
      .select({ compartilhou: schema.consentimento.aceiteCompartilhamento })
      .from(schema.consentimento)

    expect(linha?.compartilhou).toBe(false)
  })

  it('sem informar, o repasse fica como recusado — ausência não é autorização', async () => {
    const participanteId = await criarParticipante()

    await banco.db
      .insert(schema.consentimento)
      .values({ participanteId, versaoTermo: 'v1.0', aceiteParticipante: true })

    const [linha] = await banco.db
      .select({ compartilhou: schema.consentimento.aceiteCompartilhamento })
      .from(schema.consentimento)

    expect(linha?.compartilhou).toBe(false)
  })

  it('um participante tem no máximo um consentimento', async () => {
    const participanteId = await criarParticipante()
    const valores = { participanteId, versaoTermo: 'v1.0', aceiteParticipante: true }

    await banco.db.insert(schema.consentimento).values(valores)

    expect(await violou(banco.db.insert(schema.consentimento).values(valores))).toMatch(
      /consentimento_participante_id_unique/,
    )
  })
})

describe('tentativa', () => {
  it('RF-25 — duas tentativas no mesmo Pitch para a mesma pessoa são recusadas', async () => {
    const participanteId = await criarParticipante()

    await banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1 })

    expect(
      await violou(banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1 })),
    ).toMatch(/tentativa_participante_pitch_unica/)
  })

  it('RF-03 e RF-24 — a mesma pessoa pode disputar os dois Pitches', async () => {
    const participanteId = await criarParticipante()

    await banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1 })

    await expect(
      banco.db.insert(schema.tentativa).values({ participanteId, pitch: 2 }),
    ).resolves.toBeDefined()
  })

  it('só existem os Pitches 1 e 2', async () => {
    const participanteId = await criarParticipante()

    expect(
      await violou(banco.db.insert(schema.tentativa).values({ participanteId, pitch: 3 })),
    ).toMatch(/tentativa_pitch_valido/)
  })

  it('Válida sem tempo é recusada', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'valida',
          operadorId,
          resolvidoEm: new Date(),
        }),
      ),
    ).toMatch(/tentativa_tempo_coerente_com_estado/)
  })

  it('Pendente com tempo é recusada', async () => {
    const participanteId = await criarParticipante()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1, tempoMs: 83_450 }),
      ),
    ).toMatch(/tentativa_tempo_coerente_com_estado/)
  })

  it('RF-21 — Ausente não carrega tempo', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'ausente',
          tempoMs: 83_450,
          operadorId,
          resolvidoEm: new Date(),
        }),
      ),
    ).toMatch(/tentativa_tempo_coerente_com_estado/)
  })

  it('RF-23 — tentativa resolvida sem operador é recusada', async () => {
    const participanteId = await criarParticipante()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'valida',
          tempoMs: 83_450,
          resolvidoEm: new Date(),
        }),
      ),
    ).toMatch(/tentativa_autoria_coerente_com_estado/)
  })

  it('RF-23 — tentativa resolvida sem instante de resolução é recusada', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'valida',
          tempoMs: 83_450,
          operadorId,
        }),
      ),
    ).toMatch(/tentativa_resolucao_coerente_com_estado/)
  })

  it('RF-23 — tentativa pendente com instante de resolução é recusada', async () => {
    const participanteId = await criarParticipante()

    expect(
      await violou(
        banco.db
          .insert(schema.tentativa)
          .values({ participanteId, pitch: 1, resolvidoEm: new Date() }),
      ),
    ).toMatch(/tentativa_resolucao_coerente_com_estado/)
  })

  it('RF-23 — tentativa pendente com operador registrado é recusada', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1, operadorId }),
      ),
    ).toMatch(/tentativa_autoria_coerente_com_estado/)
  })

  it('tempo zero é recusado', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'valida',
          tempoMs: 0,
          operadorId,
          resolvidoEm: new Date(),
        }),
      ),
    ).toMatch(/tentativa_tempo_coerente_com_estado|tentativa_tempo_positivo/)
  })

  it('tempo negativo é recusado', async () => {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    expect(
      await violou(
        banco.db.insert(schema.tentativa).values({
          participanteId,
          pitch: 1,
          estado: 'valida',
          tempoMs: -1,
          operadorId,
          resolvidoEm: new Date(),
        }),
      ),
    ).toMatch(/tentativa_tempo_positivo/)
  })

  it('nasce Pendente por padrão (SDD BC-02)', async () => {
    const participanteId = await criarParticipante()

    const [linha] = await banco.db
      .insert(schema.tentativa)
      .values({ participanteId, pitch: 1 })
      .returning()

    expect(linha!.estado).toBe('pendente')
    expect(linha!.tempoMs).toBeNull()
    expect(linha!.operadorId).toBeNull()
    expect(linha!.resolvidoEm).toBeNull()
  })
})

describe('lancamento — trilha de auditoria (RF-23)', () => {
  async function tentativaValida(): Promise<{ tentativaId: string; operadorId: string }> {
    const participanteId = await criarParticipante()
    const operadorId = await criarOperador()

    const [linha] = await banco.db
      .insert(schema.tentativa)
      .values({
        participanteId,
        pitch: 1,
        estado: 'valida',
        tempoMs: 83_450,
        operadorId,
        resolvidoEm: new Date(),
      })
      .returning({ id: schema.tentativa.id })

    return { tentativaId: linha!.id, operadorId }
  }

  it('registro grava o valor novo e nenhum anterior', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    await expect(
      banco.db
        .insert(schema.lancamento)
        .values({ tentativaId, tipo: 'registro', tempoMsNovo: 83_450, operadorId }),
    ).resolves.toBeDefined()
  })

  it('registro sem valor novo é recusado — auditoria que não explica nada', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    expect(
      await violou(
        banco.db.insert(schema.lancamento).values({ tentativaId, tipo: 'registro', operadorId }),
      ),
    ).toMatch(/lancamento_valores_coerentes_com_tipo/)
  })

  it('correção guarda o valor anterior e o novo', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    await expect(
      banco.db.insert(schema.lancamento).values({
        tentativaId,
        tipo: 'correcao',
        tempoMsAnterior: 83_450,
        tempoMsNovo: 82_100,
        operadorId,
      }),
    ).resolves.toBeDefined()
  })

  it('correção sem o valor anterior é recusada', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    expect(
      await violou(
        banco.db
          .insert(schema.lancamento)
          .values({ tentativaId, tipo: 'correcao', tempoMsNovo: 82_100, operadorId }),
      ),
    ).toMatch(/lancamento_valores_coerentes_com_tipo/)
  })

  it('ausência não carrega tempo algum', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    expect(
      await violou(
        banco.db
          .insert(schema.lancamento)
          .values({ tentativaId, tipo: 'ausencia', tempoMsNovo: 83_450, operadorId }),
      ),
    ).toMatch(/lancamento_valores_coerentes_com_tipo/)
  })

  it('todo lançamento tem operador — a coluna não aceita nulo', async () => {
    const { tentativaId } = await tentativaValida()

    expect(
      await violou(
        banco.db
          .insert(schema.lancamento)
          // @ts-expect-error o teste existe para provar que o banco recusa mesmo se o tipo for burlado
          .values({ tentativaId, tipo: 'registro', tempoMsNovo: 83_450 }),
      ),
    ).toMatch(/operador_id/)
  })

  it('excluir um operador com lançamentos é impedido — a autoria não se perde', async () => {
    const { tentativaId, operadorId } = await tentativaValida()

    await banco.db
      .insert(schema.lancamento)
      .values({ tentativaId, tipo: 'registro', tempoMsNovo: 83_450, operadorId })

    expect(
      await violou(banco.cliente.exec(`delete from operador where id = '${operadorId}'`)),
    ).toMatch(/lancamento_operador_id/)
  })
})

describe('exclusão de participante (T15)', () => {
  it('leva junto tentativas, consentimento e responsável', async () => {
    const participanteId = await criarParticipante({ idade: 15 })

    await banco.db
      .insert(schema.responsavel)
      .values({ participanteId, nome: 'Paulo', sobrenome: 'Costa', telefone: '11912345678' })
    await banco.db.insert(schema.consentimento).values({
      participanteId,
      versaoTermo: 'v1.0',
      aceiteParticipante: true,
      aceiteResponsavel: true,
    })
    await banco.db.insert(schema.tentativa).values({ participanteId, pitch: 1 })

    await banco.cliente.exec(`delete from participante where id = '${participanteId}'`)

    expect(await banco.db.select().from(schema.tentativa)).toHaveLength(0)
    expect(await banco.db.select().from(schema.responsavel)).toHaveLength(0)
    expect(await banco.db.select().from(schema.consentimento)).toHaveLength(0)
  })
})

describe('índices sensíveis a collation (RF-16)', () => {
  /**
   * Este bloco existe por causa de uma divergência medida em 2026-08-23, na
   * primeira vez que o projeto falou com um PostgreSQL nativo.
   *
   * O PGlite roda em collation `C`; o Postgres instalado num Windows pt-BR
   * nasce em `Portuguese_Brazil.1252`. Em `C`, um btree comum atende
   * `LIKE 'mar%'`. Fora dela, **não atende** — verificado com
   * `enable_seqscan = off`, quando o planejador preferiu um Seq Scan
   * desabilitado a usar o índice.
   *
   * Consequência: se alguém tirar `text_pattern_ops` do esquema, a suíte
   * continua verde e a busca do painel (T10) vira varredura sequencial sobre
   * 2000+ linhas a cada tecla digitada pelo Operador — em produção, e só lá.
   *
   * Não dá para testar o **plano** aqui, porque no PGlite o plano é outro por
   * construção. Dá para testar a **declaração**, que é o que se perde num
   * refactor distraído.
   */
  it('a busca por nome e sobrenome usa `text_pattern_ops`', async () => {
    const { rows } = await banco.cliente.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes
       where schemaname = 'public' and tablename = 'participante'
       order by indexname`,
    )

    const porNome = rows.find((r) => r.indexname === 'participante_nome_idx')
    const porSobrenome = rows.find((r) => r.indexname === 'participante_sobrenome_idx')

    expect(porNome?.indexdef).toContain('text_pattern_ops')
    expect(porSobrenome?.indexdef).toContain('text_pattern_ops')
    // Sem `lower`, a busca do painel distinguiria maiúscula de minúscula e o
    // índice não serviria para a consulta que T10 vai escrever.
    expect(porNome?.indexdef).toContain('lower')
    expect(porSobrenome?.indexdef).toContain('lower')
  })

  it('a unicidade do usuário do Operador é sobre `lower(usuario)`', async () => {
    const { rows } = await banco.cliente.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
       where schemaname = 'public' and indexname = 'operador_usuario_minusculo_idx'`,
    )

    expect(rows[0]?.indexdef).toContain('UNIQUE')
    expect(rows[0]?.indexdef).toContain('lower')
  })
})
