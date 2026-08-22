import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'
import { InscricaoInvalidaError } from '@/contexts/inscricao/erros'
import { registrarInscricao } from '@/contexts/inscricao/registrarInscricao'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, violou, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * O caso de uso da Inscrição contra um Postgres de verdade (T04).
 *
 * O que só aparece aqui, e não nos testes de esquema: a transação. As
 * invariantes de BC-01 atravessam quatro tabelas, e Participante sem
 * Consentimento é exatamente o estado que uma falha no meio da gravação produz.
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

const RESPONSAVEL = { nome: 'Ana', sobrenome: 'Mendes', telefone: '11912345678' }

function entrada(sobrescrever: Record<string, unknown> = {}) {
  return {
    nome: 'Marina',
    sobrenome: 'Costa',
    email: 'marina@exemplo.com',
    telefone: '(11) 98765-4321',
    idade: 30,
    pitches: [1],
    consentimento: true,
    ...sobrescrever,
  }
}

describe('registrarInscricao — o que fica gravado', () => {
  it('grava o Participante com o telefone já sem máscara', async () => {
    await registrarInscricao(banco.db, entrada())

    const [linha] = await banco.db.select().from(schema.participante)

    expect(linha?.nome).toBe('Marina')
    expect(linha?.telefone).toBe('11987654321')
    expect(linha?.idade).toBe(30)
  })

  it('RF-08 — grava o Consentimento com a versão vigente do termo', async () => {
    await registrarInscricao(banco.db, entrada())

    const [linha] = await banco.db.select().from(schema.consentimento)

    expect(linha?.versaoTermo).toBe(TERMO_VIGENTE.versao)
    expect(linha?.aceiteParticipante).toBe(true)
    // Maior de idade: o conceito de aceite do responsável não se aplica.
    expect(linha?.aceiteResponsavel).toBeNull()
  })

  it('RF-03 — um Pitch gera uma Tentativa Pendente', async () => {
    await registrarInscricao(banco.db, entrada({ pitches: [1] }))

    const linhas = await banco.db.select().from(schema.tentativa)

    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.pitch).toBe(1)
    expect(linhas[0]?.estado).toBe('pendente')
    // Pendente é o único estado sem autoria: ninguém agiu sobre ela ainda.
    expect(linhas[0]?.operadorId).toBeNull()
    expect(linhas[0]?.resolvidoEm).toBeNull()
    expect(linhas[0]?.tempoMs).toBeNull()
  })

  it('RF-03 — dois Pitches geram duas Tentativas Pendentes', async () => {
    await registrarInscricao(banco.db, entrada({ pitches: [1, 2] }))

    const linhas = await banco.db.select().from(schema.tentativa)

    expect(linhas.map((l) => l.pitch).sort()).toEqual([1, 2])
    expect(linhas.every((l) => l.estado === 'pendente')).toBe(true)
  })

  it('o instante da inscrição vem do relógio do servidor, não da entrada', async () => {
    const antes = new Date()
    // Uma tentativa de plantar o instante pela requisição precisa ser ignorada.
    await registrarInscricao(banco.db, entrada({ inscritoEm: new Date('2000-01-01') }))

    const [linha] = await banco.db.select().from(schema.tentativa)

    expect(linha?.inscritoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000)
  })

  it('RF-10 — o resultado devolve exatamente o que foi enviado', async () => {
    const resultado = await registrarInscricao(banco.db, entrada({ pitches: [2, 1] }))

    expect(resultado.nome).toBe('Marina')
    expect(resultado.sobrenome).toBe('Costa')
    expect(resultado.pitches).toEqual([2, 1])
    expect(resultado.versaoTermo).toBe(TERMO_VIGENTE.versao)
    expect(resultado.participanteId).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('RF-05 a RF-07 — o ramo do menor de idade', () => {
  it('grava o Responsável e marca o aceite dele', async () => {
    await registrarInscricao(
      banco.db,
      entrada({ idade: 15, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    const [resp] = await banco.db.select().from(schema.responsavel)
    const [consent] = await banco.db.select().from(schema.consentimento)

    expect(resp?.nome).toBe('Ana')
    expect(resp?.telefone).toBe('11912345678')
    expect(consent?.aceiteResponsavel).toBe(true)
  })

  it('RF-07 — idade 18 com bloco de responsável não cria linha em responsavel', async () => {
    await registrarInscricao(
      banco.db,
      entrada({ idade: 18, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
    )

    expect(await banco.db.select().from(schema.responsavel)).toHaveLength(0)
    const [consent] = await banco.db.select().from(schema.consentimento)
    expect(consent?.aceiteResponsavel).toBeNull()
  })

  it('RF-06 — menor sem responsável não grava nada', async () => {
    await expect(registrarInscricao(banco.db, entrada({ idade: 15 }))).rejects.toBeInstanceOf(
      InscricaoInvalidaError,
    )

    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
  })
})

describe('D-23 — o repasse opcional', () => {
  it('grava a recusa quando a caixa fica desmarcada', async () => {
    await registrarInscricao(banco.db, entrada({ aceiteCompartilhamento: false }))

    const [linha] = await banco.db.select().from(schema.consentimento)

    expect(linha?.aceiteCompartilhamento).toBe(false)
  })

  it('a inscrição conclui normalmente sem a autorização', async () => {
    const resultado = await registrarInscricao(banco.db, entrada({ aceiteCompartilhamento: false }))

    expect(resultado.participanteId).toBeDefined()
    expect(await banco.db.select().from(schema.tentativa)).toHaveLength(1)
  })

  it('grava a autorização quando a caixa é marcada', async () => {
    await registrarInscricao(banco.db, entrada({ aceiteCompartilhamento: true }))

    const [linha] = await banco.db.select().from(schema.consentimento)

    expect(linha?.aceiteCompartilhamento).toBe(true)
  })
})

describe('a transação é indivisível', () => {
  /**
   * Faz a inserção de Tentativa falhar dentro da transação, com um gatilho no
   * próprio banco.
   *
   * Simular a falha no código da aplicação testaria o mock. O gatilho força o
   * erro no mesmo lugar onde ele aconteceria de verdade — durante o INSERT, com
   * Participante e Consentimento já gravados na transação aberta.
   */
  async function comFalhaNaTentativa(executar: () => Promise<unknown>) {
    await banco.cliente.exec(`
      create or replace function falhar_tentativa() returns trigger as $$
      begin raise exception 'falha simulada na Tentativa'; end;
      $$ language plpgsql;

      create trigger tentativa_falha_simulada before insert on tentativa
      for each row execute function falhar_tentativa();
    `)

    try {
      await executar()
    } finally {
      await banco.cliente.exec('drop trigger tentativa_falha_simulada on tentativa;')
    }
  }

  it('falha ao criar a Tentativa não deixa Participante órfão', async () => {
    await comFalhaNaTentativa(async () => {
      // `violou` desembrulha as causas: o Drizzle embrulha o erro do Postgres
      // num "Failed query", e sem desembrulhar o teste passaria com qualquer
      // falha de escrita, inclusive um erro de sintaxe nosso.
      expect(await violou(registrarInscricao(banco.db, entrada()))).toMatch(/falha simulada/)
    })

    // O estado que a transação existe para impedir: pessoa cadastrada sem
    // nenhuma Tentativa, invisível para a Fila e presente na Exportação.
    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
    expect(await banco.db.select().from(schema.consentimento)).toHaveLength(0)
  })

  it('falha no ramo do menor também desfaz o Responsável', async () => {
    await comFalhaNaTentativa(async () => {
      expect(
        await violou(
          registrarInscricao(
            banco.db,
            entrada({ idade: 16, responsavel: RESPONSAVEL, aceiteResponsavel: true }),
          ),
        ),
      ).toMatch(/falha simulada/)
    })

    expect(await banco.db.select().from(schema.responsavel)).toHaveLength(0)
    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
  })

  it('depois de uma falha, a inscrição seguinte funciona', async () => {
    await comFalhaNaTentativa(async () => {
      await expect(registrarInscricao(banco.db, entrada())).rejects.toThrow()
    })

    await registrarInscricao(banco.db, entrada())

    expect(await banco.db.select().from(schema.participante)).toHaveLength(1)
  })
})

describe('RNF-13 — o servidor revalida, mesmo com o cliente burlado', () => {
  it('recusa idade 12 vinda de requisição forjada', async () => {
    await expect(registrarInscricao(banco.db, entrada({ idade: 12 }))).rejects.toBeInstanceOf(
      InscricaoInvalidaError,
    )

    expect(await banco.db.select().from(schema.participante)).toHaveLength(0)
  })

  it('recusa envio sem aceite do termo', async () => {
    await expect(
      registrarInscricao(banco.db, entrada({ consentimento: false })),
    ).rejects.toBeInstanceOf(InscricaoInvalidaError)

    expect(await banco.db.select().from(schema.consentimento)).toHaveLength(0)
  })

  it('recusa Pitch inexistente antes de chegar ao banco', async () => {
    await expect(registrarInscricao(banco.db, entrada({ pitches: [3] }))).rejects.toBeInstanceOf(
      InscricaoInvalidaError,
    )
  })
})

describe('duas inscrições independentes', () => {
  it('homônimos convivem: o cadastro não é único por nome', async () => {
    // Em 2000 inscrições brasileiras, nome repetido é certeza. Distinguir os
    // dois é trabalho do painel (RF-15), não motivo para recusar o segundo.
    await registrarInscricao(banco.db, entrada({ telefone: '11911111111' }))
    await registrarInscricao(banco.db, entrada({ telefone: '11922222222' }))

    const linhas = await banco.db.select().from(schema.participante)

    expect(linhas).toHaveLength(2)
    expect(new Set(linhas.map((l) => l.id)).size).toBe(2)
  })

  it('cada Participante tem o próprio Consentimento', async () => {
    const primeira = await registrarInscricao(banco.db, entrada())
    await registrarInscricao(banco.db, entrada({ email: 'outra@exemplo.com' }))

    const consentimentos = await banco.db
      .select()
      .from(schema.consentimento)
      .where(eq(schema.consentimento.participanteId, primeira.participanteId))

    expect(consentimentos).toHaveLength(1)
    expect(await banco.db.select().from(schema.consentimento)).toHaveLength(2)
  })
})
