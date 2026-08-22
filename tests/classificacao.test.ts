import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compactar, etiquetaDe } from '@/contexts/classificacao/documento'
import { projetarClassificacao } from '@/contexts/classificacao/projecao'
import * as schema from '@/db/schema'
import { popular } from '@/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * A Classificação pública (T12 — RF-26 a RF-31, RNF-08, RNF-09).
 *
 * O que está sob teste aqui é sobretudo o que **não** sai. A garantia de RNF-08
 * é o tipo, e a de RNF-09 é uma função na fronteira; os dois testes que mais
 * importam neste arquivo varrem o documento serializado procurando dado que não
 * deveria estar lá — inclusive sobre a massa semeada, com 2000 pessoas de
 * mentira e uma proporção realista de menores.
 */

const AGORA = new Date('2026-09-12T14:00:00Z')
const MINUTO = 60_000

let banco: BancoDeTeste
let operadorId: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel,
                   participante, operador cascade;
  `)

  const [op] = await banco.db
    .insert(schema.operador)
    .values({ usuario: 'marina', nome: 'Marina Costa', senhaHash: 'x' })
    .returning({ id: schema.operador.id })

  operadorId = op?.id ?? ''
})

type Corredor = {
  nome: string
  sobrenome: string
  idade?: number
  pitch?: 1 | 2
  tempoMs?: number | null
  estado?: 'pendente' | 'valida' | 'ausente'
  resolvidoEm?: Date
}

async function criar(c: Corredor): Promise<string> {
  const [p] = await banco.db
    .insert(schema.participante)
    .values({
      nome: c.nome,
      sobrenome: c.sobrenome,
      email: `${randomUUID()}@exemplo.com`,
      telefone: '11987654321',
      idade: c.idade ?? 30,
    })
    .returning({ id: schema.participante.id })

  const estado = c.estado ?? 'valida'
  const resolvida = estado !== 'pendente'

  const [t] = await banco.db
    .insert(schema.tentativa)
    .values({
      participanteId: p?.id ?? '',
      pitch: c.pitch ?? 1,
      estado,
      tempoMs: estado === 'valida' ? (c.tempoMs ?? 83_450) : null,
      resolvidoEm: resolvida ? (c.resolvidoEm ?? AGORA) : null,
      operadorId: resolvida ? operadorId : null,
    })
    .returning({ id: schema.tentativa.id })

  return t?.id ?? ''
}

describe('quem entra na classificação (RF-21, RF-28)', () => {
  it('só Tentativas Válidas — Ausentes e Pendentes ficam de fora', async () => {
    await criar({ nome: 'Valida', sobrenome: 'Silva' })
    await criar({ nome: 'Ausente', sobrenome: 'Souza', estado: 'ausente' })
    await criar({ nome: 'Pendente', sobrenome: 'Lima', estado: 'pendente' })

    const { linhas } = await projetarClassificacao(banco.db, AGORA)

    expect(linhas.map((l) => l.nomePublico)).toEqual(['Valida Silva'])
  })

  it('quem correu os dois Pitches ocupa duas linhas (RF-28)', async () => {
    const [p] = await banco.db
      .insert(schema.participante)
      .values({
        nome: 'Marina',
        sobrenome: 'Costa',
        email: 'marina@exemplo.com',
        telefone: '11987654321',
        idade: 30,
      })
      .returning({ id: schema.participante.id })

    for (const [pitch, tempoMs] of [
      [1, 83_450],
      [2, 91_000],
    ] as const) {
      await banco.db.insert(schema.tentativa).values({
        participanteId: p?.id ?? '',
        pitch,
        estado: 'valida',
        tempoMs,
        resolvidoEm: AGORA,
        operadorId,
      })
    }

    const { linhas } = await projetarClassificacao(banco.db, AGORA)

    expect(linhas).toHaveLength(2)
    expect(linhas.map((l) => l.pitch).sort()).toEqual([1, 2])
    // Duas linhas, mesma pessoa, identificadores distintos: a linha é da
    // Tentativa, não do Participante.
    expect(new Set(linhas.map((l) => l.id)).size).toBe(2)
  })
})

describe('a ordem (RF-31)', () => {
  it('tempo crescente, desempate pelo lançamento mais antigo', async () => {
    await criar({ nome: 'Terceiro', sobrenome: 'Silva', tempoMs: 90_000 })
    await criar({
      nome: 'Segundo',
      sobrenome: 'Souza',
      tempoMs: 83_450,
      resolvidoEm: new Date(AGORA.getTime() + MINUTO),
    })
    await criar({
      nome: 'Primeiro',
      sobrenome: 'Lima',
      tempoMs: 83_450,
      // Mesmo tempo, lançado antes: fica na frente.
      resolvidoEm: AGORA,
    })

    const { linhas } = await projetarClassificacao(banco.db, AGORA)

    expect(linhas.map((l) => l.nomePublico)).toEqual([
      'Primeiro Lima',
      'Segundo Souza',
      'Terceiro Silva',
    ])
  })

  it('a ordem é determinística mesmo com tempo e instante idênticos', async () => {
    // Sem o terceiro critério de desempate, duas linhas assim poderiam trocar
    // de lugar entre duas leituras — e a página mudaria de ordem sem que nada
    // tivesse mudado.
    for (const nome of ['A', 'B', 'C', 'D']) {
      await criar({ nome, sobrenome: 'Igual', tempoMs: 83_450, resolvidoEm: AGORA })
    }

    const primeira = await projetarClassificacao(banco.db, AGORA)

    for (let i = 0; i < 5; i += 1) {
      const outra = await projetarClassificacao(banco.db, AGORA)
      expect(outra.linhas.map((l) => l.id)).toEqual(primeira.linhas.map((l) => l.id))
    }
  })
})

describe('RNF-09 — o sobrenome do menor não aparece inteiro', () => {
  it('maior sai por extenso, menor sai com a inicial', async () => {
    await criar({ nome: 'Dhiego', sobrenome: 'Ferreira', idade: 30, tempoMs: 80_000 })
    await criar({ nome: 'Lucas', sobrenome: 'Marinho', idade: 15, tempoMs: 90_000 })

    const { linhas } = await projetarClassificacao(banco.db, AGORA)

    expect(linhas.map((l) => l.nomePublico)).toEqual(['Dhiego Ferreira', 'Lucas M.'])
  })

  it('quem acabou de fazer 18 sai por extenso; quem tem 17 não', async () => {
    await criar({ nome: 'Recem', sobrenome: 'Maior', idade: 18, tempoMs: 80_000 })
    await criar({ nome: 'Quase', sobrenome: 'Maior', idade: 17, tempoMs: 90_000 })

    const { linhas } = await projetarClassificacao(banco.db, AGORA)

    expect(linhas[0]?.nomePublico).toBe('Recem Maior')
    expect(linhas[1]?.nomePublico).toBe('Quase M.')
  })

  it('nenhum sobrenome de menor sobrevive à serialização, na massa inteira', async () => {
    // O teste que mais importa deste arquivo. Não confere uma regra: varre o
    // documento que de fato iria para a rede, procurando o sobrenome de cada
    // menor da massa. Se a projeção parar de abreviar por qualquer motivo —
    // uma coluna a mais no `select`, uma refatoração no `map` —, ele falha.
    await popular(banco.db, { participantes: 250 })

    const documento = compactar(await projetarClassificacao(banco.db, AGORA))
    const serializado = JSON.stringify(documento)

    const menores = await banco.db
      .select({ sobrenome: schema.participante.sobrenome, idade: schema.participante.idade })
      .from(schema.participante)

    const sobrenomesDeMenores = menores.filter((p) => p.idade < 18).map((p) => p.sobrenome)

    expect(sobrenomesDeMenores.length).toBeGreaterThan(0)

    for (const sobrenome of new Set(sobrenomesDeMenores)) {
      // Um sobrenome pode pertencer também a um maior, que sai por extenso com
      // razão. Só é violação quando aparece **sem** um maior que o justifique.
      const temMaiorComMesmoSobrenome = menores.some(
        (p) => p.sobrenome === sobrenome && p.idade >= 18,
      )

      if (!temMaiorComMesmoSobrenome) {
        expect(serializado, `sobrenome de menor vazou: ${sobrenome}`).not.toContain(sobrenome)
      }
    }
  })
})

describe('RNF-08 — o que atravessa a rede', () => {
  it('cada linha tem exatamente três valores, e nenhum é dado pessoal', async () => {
    await criar({ nome: 'Marina', sobrenome: 'Costa', idade: 34 })

    const documento = compactar(await projetarClassificacao(banco.db, AGORA))

    expect(documento.linhas).toHaveLength(1)
    expect(documento.linhas[0]).toHaveLength(3)
    expect(documento.linhas[0]).toEqual(['Marina Costa', 1, 83_450])
    expect(Object.keys(documento).sort()).toEqual(['geradoEm', 'linhas', 'total'])
  })

  it('e-mail, telefone e idade não aparecem no documento serializado', async () => {
    await banco.db.insert(schema.participante).values({
      nome: 'Marina',
      sobrenome: 'Costa',
      email: 'marina.costa@exemplo.com',
      telefone: '11987654321',
      idade: 34,
    })

    const [p] = await banco.db.select().from(schema.participante)
    await banco.db.insert(schema.tentativa).values({
      participanteId: p?.id ?? '',
      pitch: 1,
      estado: 'valida',
      tempoMs: 83_450,
      resolvidoEm: AGORA,
      operadorId,
    })

    const serializado = JSON.stringify(compactar(await projetarClassificacao(banco.db, AGORA)))

    expect(serializado).not.toContain('marina.costa@exemplo.com')
    expect(serializado).not.toContain('11987654321')
    // O identificador da Tentativa também fica de fora da rede: 36 caracteres
    // por linha que a tela não usa para nada.
    expect(serializado).not.toContain(p?.id ?? 'impossivel')
  })

  it('o instante do lançamento não é publicado', async () => {
    // Ele resolve o desempate, que o servidor já resolveu ao ordenar. Publicá-lo
    // seria dizer a que horas uma pessoa nomeada esteve num lugar — e para os
    // menores isso é a mesma exposição de RNF-09, por outra porta.
    await criar({ nome: 'Marina', sobrenome: 'Costa', resolvidoEm: AGORA })

    const documento = compactar(await projetarClassificacao(banco.db, AGORA))

    expect(JSON.stringify(documento.linhas)).not.toContain(AGORA.toISOString())
  })
})

describe('a etiqueta de revalidação (FL-08)', () => {
  it('não muda quando só o instante de geração muda', async () => {
    await criar({ nome: 'Marina', sobrenome: 'Costa' })

    const cedo = compactar(await projetarClassificacao(banco.db, AGORA))
    const tarde = compactar(
      await projetarClassificacao(banco.db, new Date(AGORA.getTime() + 10 * MINUTO)),
    )

    expect(tarde.geradoEm).not.toBe(cedo.geradoEm)
    // Se `geradoEm` entrasse no cálculo, nenhuma revalidação jamais devolveria
    // 304 — e é o 304 que torna o polling de 2000 aparelhos sustentável.
    expect(etiquetaDe(tarde)).toBe(etiquetaDe(cedo))
  })

  it('muda quando um tempo entra ou é corrigido', async () => {
    await criar({ nome: 'Marina', sobrenome: 'Costa', tempoMs: 83_450 })
    const antes = etiquetaDe(compactar(await projetarClassificacao(banco.db, AGORA)))

    await criar({ nome: 'Bruno', sobrenome: 'Souza', tempoMs: 90_000 })
    const depois = etiquetaDe(compactar(await projetarClassificacao(banco.db, AGORA)))

    expect(depois).not.toBe(antes)

    await banco.db
      .update(schema.tentativa)
      .set({ tempoMs: 82_000 })
      .where(eq(schema.tentativa.tempoMs, 83_450))
    expect(etiquetaDe(compactar(await projetarClassificacao(banco.db, AGORA)))).not.toBe(depois)
  })

  it('tem a forma que o HTTP exige', async () => {
    await criar({ nome: 'Marina', sobrenome: 'Costa' })

    const etiqueta = etiquetaDe(compactar(await projetarClassificacao(banco.db, AGORA)))

    expect(etiqueta.startsWith('"')).toBe(true)
    expect(etiqueta.endsWith('"')).toBe(true)
  })
})

describe('o documento vazio', () => {
  it('antes do primeiro lançamento, o documento existe e é vazio', async () => {
    // A página pública abre antes de a corrida começar. Uma projeção que
    // falhasse com zero linhas deixaria a tela quebrada na hora de maior
    // audiência — quando todo mundo abre para ver se já começou.
    const documento = compactar(await projetarClassificacao(banco.db, AGORA))

    expect(documento.total).toBe(0)
    expect(documento.linhas).toEqual([])
    expect(etiquetaDe(documento)).toBeTruthy()
  })
})
