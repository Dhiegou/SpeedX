import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumirLimite,
  ESCOPO_CADASTRO,
  identificarOrigem,
} from '@/contexts/inscricao/limiteDeTaxa'
import { submeterInscricao } from '@/contexts/inscricao/submeterInscricao'
import { emitirTokenFormulario } from '@/contexts/inscricao/tokenFormulario'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * A borda de rede da Inscrição contra um Postgres de verdade (T05).
 *
 * O que só aparece aqui, e não nos testes de T04: o mesmo envio chegando duas
 * vezes. O SDD §4.3 é explícito — transporte confiável garante entrega, não
 * unicidade de efeito. Quem perde a confirmação no 4G da arquibancada aperta
 * "enviar" de novo, e o sistema não pode responder com dois cadastros.
 */

let banco: BancoDeTeste

const AGORA = 1_787_266_453_274
const ORIGEM = '203.0.113.7'

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel,
                   participante, operador, chave_idempotencia, limite_taxa cascade;
  `)
})

/** Envio válido, com token emitido há tempo suficiente para não parecer robô. */
function corpo(sobrescrever: Record<string, unknown> = {}) {
  return {
    nome: 'Marina',
    sobrenome: 'Costa',
    email: 'marina@exemplo.com',
    telefone: '(11) 98765-4321',
    idade: 30,
    pitches: [1],
    consentimento: true,
    token: emitirTokenFormulario(AGORA - 30_000),
    ...sobrescrever,
  }
}

function envio(sobrescrever: Partial<Parameters<typeof submeterInscricao>[1]> = {}) {
  return {
    corpo: corpo(),
    chave: randomUUID(),
    origem: ORIGEM,
    agora: AGORA,
    ...sobrescrever,
  }
}

async function participantes(): Promise<number> {
  return (await banco.db.select().from(schema.participante)).length
}

describe('FL-03 — idempotência', () => {
  it('o mesmo envio com a mesma chave produz um Participante e a mesma resposta', async () => {
    const comando = envio()

    const primeira = await submeterInscricao(banco.db, comando)
    const segunda = await submeterInscricao(banco.db, comando)

    expect(primeira.situacao).toBe('criada')
    expect(segunda.situacao).toBe('repetida')
    expect(await participantes()).toBe(1)

    // Não basta não duplicar: a segunda resposta precisa ser a mesma, senão a
    // tela de confirmação muda embaixo de quem já tinha visto a primeira.
    expect(segunda).toMatchObject({ corpo: { nome: 'Marina', sobrenome: 'Costa', pitches: [1] } })
  })

  it('o mesmo envio com chave diferente produz dois Participantes', async () => {
    // Não é defeito: são duas inscrições. Duas pessoas com o mesmo nome existem,
    // e a idempotência responde por reenvio, não por semelhança de conteúdo.
    await submeterInscricao(banco.db, envio())
    const segunda = await submeterInscricao(banco.db, envio())

    expect(segunda.situacao).toBe('criada')
    expect(await participantes()).toBe(2)
  })

  it('a mesma chave com outro envio é conflito, e não devolve o dado de ninguém', async () => {
    // O risco real: duas pessoas no mesmo ponto de inscrição acabam com a mesma
    // chave. Sem a comparação do conteúdo, a segunda receberia a confirmação
    // com o nome da primeira — vazamento (RNF-08), não só resposta errada.
    const chave = randomUUID()

    await submeterInscricao(banco.db, envio({ chave }))

    const outra = await submeterInscricao(
      banco.db,
      envio({ chave, corpo: corpo({ nome: 'Bruno', email: 'bruno@exemplo.com' }) }),
    )

    expect(outra.situacao).toBe('chave_em_conflito')
    expect(outra).not.toHaveProperty('corpo')
    expect(await participantes()).toBe(1)
  })

  it('exige chave, e exige que ela seja um UUID', async () => {
    // Chave curta escolhida à mão colide entre pessoas diferentes, e colisão
    // aqui é justamente o caso acima. Recusar cedo é mais barato.
    expect((await submeterInscricao(banco.db, envio({ chave: null }))).situacao).toBe(
      'chave_ausente',
    )
    expect((await submeterInscricao(banco.db, envio({ chave: '1' }))).situacao).toBe(
      'chave_ausente',
    )
    expect(await participantes()).toBe(0)
  })

  it('reenvio sobrevive a token novo: recarregar a página não vira conflito', async () => {
    // O token muda a cada carga da página. Se entrasse na digestão do envio, a
    // retentativa mais comum de todas — recarregar e mandar de novo — viraria
    // conflito em vez de devolver a confirmação.
    const chave = randomUUID()
    const original = corpo()

    await submeterInscricao(banco.db, envio({ chave, corpo: original }))

    const reenvio = await submeterInscricao(
      banco.db,
      envio({ chave, corpo: { ...original, token: emitirTokenFormulario(AGORA - 10_000) } }),
    )

    expect(reenvio.situacao).toBe('repetida')
    expect(await participantes()).toBe(1)
  })

  it('a chave só é gravada se o cadastro for gravado', async () => {
    await submeterInscricao(banco.db, envio({ corpo: corpo({ idade: 12 }) }))

    const chaves = await banco.db.select().from(schema.chaveIdempotencia)

    expect(chaves).toHaveLength(0)
  })
})

describe('RNF-13 — a validação do servidor não depende da tela', () => {
  it('recusa idade 12 vinda de fora do navegador', async () => {
    const resultado = await submeterInscricao(banco.db, envio({ corpo: corpo({ idade: 12 }) }))

    expect(resultado).toMatchObject({ situacao: 'invalida' })
    expect(resultado).toHaveProperty('erros')
    if (resultado.situacao !== 'invalida') throw new Error('esperava recusa por validação')
    expect(resultado.erros.map((e) => e.codigo)).toContain('idade_minima')
    expect(await participantes()).toBe(0)
  })

  it('recusa envio sem consentimento', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ consentimento: false }) }),
    )

    expect(resultado.situacao).toBe('invalida')
    expect(await participantes()).toBe(0)
  })

  it('recusa menor com bloco de responsável incompleto', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({
        corpo: corpo({
          idade: 15,
          responsavel: { nome: 'Ana', sobrenome: 'Mendes' },
          aceiteResponsavel: true,
        }),
      }),
    )

    expect(resultado.situacao).toBe('invalida')
    expect(await participantes()).toBe(0)
  })

  it('devolve a lista inteira de problemas, não o primeiro', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ email: 'sem-arroba', telefone: '123', pitches: [] }) }),
    )

    if (resultado.situacao !== 'invalida') throw new Error('esperava recusa por validação')
    expect(resultado.erros.length).toBeGreaterThanOrEqual(3)
  })
})

describe('RNF-12 — anti-automação', () => {
  it('honeypot preenchido não grava nada e parece sucesso', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ empresa: 'Acme Ltda' }) }),
    )

    expect(resultado.situacao).toBe('descartada')
    expect(await participantes()).toBe(0)

    // A forma da resposta precisa ser a de um cadastro criado: um 4xx aqui
    // ensinaria ao autor do robô exatamente qual campo é a armadilha.
    expect(resultado).toHaveProperty('corpo')
  })

  it('honeypot é examinado antes de tudo, inclusive da chave', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({ chave: null, corpo: corpo({ empresa: 'x' }) }),
    )

    expect(resultado.situacao).toBe('descartada')
  })

  it('honeypot vazio é o caso normal e não atrapalha ninguém', async () => {
    // O campo chega em todo envio do formulário, sempre vazio. Se string vazia
    // disparasse a armadilha, ninguém se inscreveria.
    const resultado = await submeterInscricao(banco.db, envio({ corpo: corpo({ empresa: '' }) }))

    expect(resultado.situacao).toBe('criada')
  })

  it('recusa envio sem token e envio rápido demais', async () => {
    const semToken = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ token: undefined }) }),
    )
    const veloz = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ token: emitirTokenFormulario(AGORA - 200) }) }),
    )

    expect(semToken.situacao).toBe('automacao_suspeita')
    expect(veloz).toMatchObject({ situacao: 'automacao_suspeita' })
    expect(await participantes()).toBe(0)
  })

  it('página aberta há horas pede recarga, não acusa de automação', async () => {
    const resultado = await submeterInscricao(
      banco.db,
      envio({ corpo: corpo({ token: emitirTokenFormulario(AGORA - 7 * 60 * 60 * 1000) }) }),
    )

    expect(resultado.situacao).toBe('formulario_expirado')
  })
})

describe('RNF-12 — limite de taxa por origem', () => {
  /** Preenche a janela como se a origem já tivesse concluído `quantos` cadastros. */
  async function ocupar(quantos: number, origem = ORIGEM): Promise<void> {
    const identificador = identificarOrigem(origem)

    for (let i = 0; i < quantos; i += 1) {
      await consumirLimite(
        banco.db,
        ESCOPO_CADASTRO,
        identificador,
        new Date(AGORA - (i + 1) * 1000),
      )
    }
  }

  it('excedido o limite, responde 429 lógico e não grava', async () => {
    // 29 marcas na janela + o cadastro real deste teste fecham as 30 do padrão.
    await ocupar(29)

    const trigesimo = await submeterInscricao(banco.db, envio())
    const excedente = await submeterInscricao(banco.db, envio())

    expect(trigesimo.situacao).toBe('criada')
    expect(excedente).toMatchObject({ situacao: 'limite_excedido' })
    if (excedente.situacao !== 'limite_excedido') throw new Error('esperava limite')
    expect(excedente.esperarSegundos).toBeGreaterThan(0)
    expect(await participantes()).toBe(1)
  })

  it('o cadastro concluído consome cota; a validação recusada não', async () => {
    // Quem erra o telefone quatro vezes está preenchendo um formulário no
    // celular, não atacando o sistema. Contar cota por tentativa recusada
    // tranca essa pessoa fora e derruba a meta de conclusão do PRD §7.
    for (let i = 0; i < 6; i += 1) {
      await submeterInscricao(banco.db, envio({ corpo: corpo({ idade: 12 }) }))
    }

    const marcas = await banco.db.select().from(schema.limiteTaxa)
    expect(marcas).toHaveLength(0)

    await submeterInscricao(banco.db, envio())
    expect(await banco.db.select().from(schema.limiteTaxa)).toHaveLength(1)
  })

  it('o limite é por origem: outra conexão não paga pela primeira', async () => {
    await ocupar(30)

    const outra = await submeterInscricao(banco.db, envio({ origem: '198.51.100.42' }))

    expect(outra.situacao).toBe('criada')
  })

  it('marca envelhecida sai da janela e devolve a cota', async () => {
    await ocupar(30)

    // Onze minutos depois, a janela curta de dez minutos já esvaziou.
    const depois = await submeterInscricao(banco.db, envio({ agora: AGORA + 11 * 60 * 1000 }))

    expect(depois.situacao).toBe('criada')
  })

  it('RNF-08 — o que fica gravado é o HMAC da origem, nunca o endereço', async () => {
    await submeterInscricao(banco.db, envio())

    const [marca] = await banco.db.select().from(schema.limiteTaxa)

    expect(marca?.identificador).toBeDefined()
    expect(marca?.identificador).not.toContain(ORIGEM)
    expect(marca?.identificador).toBe(identificarOrigem(ORIGEM))
  })

  it('sem endereço de origem, o cadastro passa e nenhuma cota é criada', async () => {
    // A alternativa seria um balde único para "origem desconhecida", e aí a
    // primeira dúzia de participantes trancaria o evento inteiro.
    const resultado = await submeterInscricao(banco.db, envio({ origem: null }))

    expect(resultado.situacao).toBe('criada')
    expect(await banco.db.select().from(schema.limiteTaxa)).toHaveLength(0)
  })

  it('a marca de cota entra na mesma transação do cadastro', async () => {
    await submeterInscricao(banco.db, envio())

    const [participante] = await banco.db.select().from(schema.participante)
    const marcas = await banco.db.select().from(schema.limiteTaxa)
    const chaves = await banco.db
      .select()
      .from(schema.chaveIdempotencia)
      .where(eq(schema.chaveIdempotencia.escopo, ESCOPO_CADASTRO))

    expect(participante).toBeDefined()
    expect(marcas).toHaveLength(1)
    expect(chaves).toHaveLength(1)
  })
})

describe('RATE_LIMIT_ATIVO — desligamento de emergência', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('desligado, a janela cheia deixa de bloquear', async () => {
    // Esta alavanca só vai ser puxada num dia em que ninguém tem tempo de
    // testá-la. É agora ou nunca.
    vi.resetModules()
    vi.stubEnv('RATE_LIMIT_ATIVO', 'false')

    const modulo = await import('@/contexts/inscricao/limiteDeTaxa')
    const identificador = modulo.identificarOrigem(ORIGEM)

    for (let i = 0; i < 50; i += 1) {
      await modulo.consumirLimite(
        banco.db,
        modulo.ESCOPO_CADASTRO,
        identificador,
        new Date(AGORA - (i + 1) * 1000),
      )
    }

    const veredito = await modulo.verificarLimite(
      banco.db,
      modulo.politicaCadastro(),
      identificador,
      AGORA,
    )

    expect(veredito.permitido).toBe(true)
  })
})
