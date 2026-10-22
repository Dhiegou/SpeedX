import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buscarParticipantes, listarFila } from '@/contexts/cronometragem/consultas'
import { excluirParticipante } from '@/contexts/custodia/expurgo'
import { fluxoDaExportacaoCompleta } from '@/contexts/custodia/exportacao'
import { registrarInscricao } from '@/contexts/inscricao/registrarInscricao'
import { submeterInscricao } from '@/contexts/inscricao/submeterInscricao'
import { emitirTokenFormulario } from '@/contexts/inscricao/tokenFormulario'
import * as schema from '@/db/schema'
import { formatarNumero, lerNumero } from '@/shared/numeroDeInscricao'
import { criarBancoDeTeste, violou, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * O número de inscrição (D-112).
 *
 * **Um número que muda é pior que número nenhum**, porque a pessoa confia nele.
 * O teste que importa aqui é o da exclusão: se o número fosse derivado da ordem
 * de inscrição, apagar uma pessoa renumeraria todo mundo depois dela, e é isso
 * que a escolha de coluna existe para impedir. Os outros provam que quem
 * guarda as invariantes é o banco, e não o código que hoje grava.
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
                   participante, operador, chave_idempotencia, limite_taxa cascade;
  `)
})

function entrada(nome: string, sobrescrever: Record<string, unknown> = {}) {
  return {
    nome,
    sobrenome: 'Ferreira',
    email: `${nome.toLowerCase()}@exemplo.com`,
    telefone: '(11) 98765-4321',
    idade: 30,
    consentimento: true,
    ...sobrescrever,
  }
}

async function numeros(): Promise<Map<string, number>> {
  const linhas = await banco.db
    .select({ nome: schema.participante.nome, numero: schema.participante.numero })
    .from(schema.participante)

  return new Map(linhas.map((l) => [l.nome, l.numero]))
}

describe('o banco atribui, e só no insert', () => {
  it('cada inscrição recebe o seguinte, e a resposta já o traz', async () => {
    const primeira = await registrarInscricao(banco.db, entrada('Ana'))
    const segunda = await registrarInscricao(banco.db, entrada('Bruno'))

    expect(segunda.numero).toBe(primeira.numero + 1)
    expect((await numeros()).get('Bruno')).toBe(segunda.numero)
  })

  it('recusa número escrito à mão', async () => {
    const erro = await violou(
      banco.cliente.query(
        `insert into participante (nome, sobrenome, email, telefone, idade, numero)
         values ('Ana', 'Lima', 'ana@exemplo.com', '11987654321', 30, 847)`,
      ),
    )

    expect(erro).toMatch(/numero/)
  })

  it('recusa reatribuir número de quem já tem', async () => {
    const { participanteId } = await registrarInscricao(banco.db, entrada('Ana'))

    const erro = await violou(
      banco.cliente.query(`update participante set numero = 1 where id = $1`, [participanteId]),
    )

    expect(erro).toMatch(/numero/)
  })
})

describe('excluir alguém não mexe no número de ninguém', () => {
  it('quem veio depois continua com o mesmo número, e o vago não volta', async () => {
    for (const nome of ['Ana', 'Bruno', 'Carla', 'Diego']) {
      await registrarInscricao(banco.db, entrada(nome))
    }

    const antes = await numeros()
    const bruno = await banco.db
      .select({ id: schema.participante.id })
      .from(schema.participante)
      .where(eq(schema.participante.nome, 'Bruno'))

    // A exclusão a pedido que o termo promete, pelo mesmo caminho de produção.
    await excluirParticipante(banco.db, bruno[0]?.id ?? '')

    const depois = await numeros()

    expect(depois.has('Bruno')).toBe(false)
    for (const nome of ['Ana', 'Carla', 'Diego']) {
      expect(depois.get(nome), nome).toBe(antes.get(nome))
    }

    // O número do Bruno fica vago para sempre: quem chega agora recebe outro.
    const nova = await registrarInscricao(banco.db, entrada('Elisa'))
    expect([...depois.values()]).not.toContain(nova.numero)
    expect(nova.numero).not.toBe(antes.get('Bruno'))
    expect(nova.numero).toBeGreaterThan(antes.get('Diego') ?? 0)
  })
})

describe('a confirmação mostra o número (submeter)', () => {
  const AGORA = 1_787_266_453_274

  function envio(chave: string, nome: string) {
    return {
      corpo: { ...entrada(nome), token: emitirTokenFormulario(AGORA - 30_000) },
      chave,
      origem: `203.0.113.${String(nome.length)}`,
      agora: AGORA,
    }
  }

  it('a resposta traz o número gravado, e o reenvio traz o mesmo', async () => {
    const chave = randomUUID()

    const primeira = await submeterInscricao(banco.db, envio(chave, 'Ana'))
    const reenvio = await submeterInscricao(banco.db, envio(chave, 'Ana'))

    if (primeira.situacao !== 'criada') throw new Error(primeira.situacao)
    if (reenvio.situacao !== 'repetida') throw new Error(reenvio.situacao)

    expect(primeira.corpo.numero).toBe((await numeros()).get('Ana'))
    // O reenvio da arquibancada não pode mostrar outro número.
    expect(reenvio.corpo.numero).toBe(primeira.corpo.numero)
  })
})

describe('o painel acha pelo número', () => {
  it('na Fila e na busca global, por igualdade', async () => {
    const homonimo = await registrarInscricao(banco.db, entrada('Dhiego'))
    await registrarInscricao(banco.db, entrada('Dhiego', { email: 'outro@exemplo.com' }))

    const termo = formatarNumero(homonimo.numero)

    const fila = await listarFila(banco.db, { busca: termo })
    const global = await buscarParticipantes(banco.db, { busca: termo })

    // Dois "Dhiego Ferreira", e uma busca só devolve a pessoa certa.
    expect(fila.itens.map((i) => i.participanteId)).toEqual([homonimo.participanteId])
    expect(global.itens.map((i) => i.participanteId)).toEqual([homonimo.participanteId])
  })

  it('a busca por nome continua por trecho', async () => {
    await registrarInscricao(banco.db, entrada('Dhiego'))

    expect((await listarFila(banco.db, { busca: 'hieg' })).itens).toHaveLength(1)
  })
})

describe('a exportação tem a coluna', () => {
  it('numero_inscricao, com o inteiro de cada pessoa', async () => {
    const { numero } = await registrarInscricao(banco.db, entrada('Ana'))

    const csv = await new Response(fluxoDaExportacaoCompleta(banco.db)).text()
    const [cabecalho, primeira] = csv.replace(/^﻿/, '').split('\r\n')
    const colunas = (cabecalho ?? '').split(';')
    const valores = (primeira ?? '').split(';')

    expect(colunas[1]).toBe('numero_inscricao')
    expect(valores[1]).toBe(String(numero))
  })
})

describe('formatar e ler', () => {
  it('quatro dígitos na tela, inteiro no banco', () => {
    expect(formatarNumero(7)).toBe('0007')
    expect(formatarNumero(847)).toBe('0847')
    expect(formatarNumero(12_345)).toBe('12345')
  })

  it('lê o que a pessoa digita, e recusa o que não é número', () => {
    expect(lerNumero('0847')).toBe(847)
    expect(lerNumero('#847')).toBe(847)
    expect(lerNumero(' 847 ')).toBe(847)
    expect(lerNumero('0')).toBeNull()
    expect(lerNumero('')).toBeNull()
    expect(lerNumero('Pessoa 400')).toBeNull()
    expect(lerNumero('8a7')).toBeNull()
  })
})
