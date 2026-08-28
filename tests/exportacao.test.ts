import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { escapar, linha, nomeDoArquivo } from '@/contexts/custodia/csv'
import * as schema from '@/db/schema'
import { popular } from '@/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * A Exportação (T14 — RF-34, RF-35, RNF-10).
 *
 * É o oposto da Classificação: ali o modelo não tem campo para dado pessoal;
 * aqui o documento é a base inteira, com telefone e dados de Responsável de
 * menores. Os testes que mais importam são os dois que cercam essa exposição —
 * que ninguém sem sessão a alcance, e que a lista de repasse não carregue
 * ninguém que recusou.
 */

const estado = vi.hoisted(() => ({
  db: undefined as unknown,
  cookies: new Map<string, string>(),
}))

vi.mock('@/db', () => ({ db: () => estado.db }))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (nome: string) => {
        const valor = estado.cookies.get(nome)
        return valor === undefined ? undefined : { name: nome, value: valor }
      },
      set: (nome: string, valor: string) => estado.cookies.set(nome, valor),
      delete: (nome: string) => estado.cookies.delete(nome),
    }),
}))

vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('REDIRECIONOU')
  },
}))

const rota = await import('@/../app/api/exportacao/route')
const sessaoRota = await import('@/../app/api/painel/sessao/route')
const { criarOperador } = await import('@/contexts/identidade/criarOperador')

const SENHA = 'senha-de-operador-2026'
const AGORA = new Date('2026-09-12T14:00:00Z')

let banco: BancoDeTeste
let operadorId: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  estado.db = banco.db
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.cliente.exec(`
    truncate table lancamento, tentativa, consentimento, responsavel, participante,
                   sessao, operador, chave_idempotencia, limite_taxa cascade;
  `)
  estado.cookies.clear()

  const op = await criarOperador(banco.db, {
    usuario: 'marina',
    nome: 'Marina Costa',
    senha: SENHA,
  })
  operadorId = op.id
})

async function entrar(): Promise<void> {
  const r = await sessaoRota.POST(
    new NextRequest('http://localhost:3000/api/painel/sessao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario: 'marina', senha: SENHA }),
    }),
  )
  if (r.status !== 200) throw new Error('login falhou')
}

const exportar = (tipo?: string) =>
  rota.GET(
    new NextRequest(
      `http://localhost:3000/api/exportacao${tipo === undefined ? '' : `?tipo=${tipo}`}`,
    ),
  )

type Pessoa = {
  nome?: string
  sobrenome?: string
  idade?: number
  telefone?: string
  compartilha?: boolean
  responsavel?: boolean
  estado?: 'pendente' | 'valida' | 'ausente'
  cockpit?: 1 | 2
}

async function criar(p: Pessoa = {}): Promise<string> {
  const idade = p.idade ?? 30

  const [pessoa] = await banco.db
    .insert(schema.participante)
    .values({
      nome: p.nome ?? 'Marina',
      sobrenome: p.sobrenome ?? 'Costa',
      email: `${randomUUID()}@exemplo.com`,
      telefone: p.telefone ?? '11987654321',
      idade,
    })
    .returning({ id: schema.participante.id })

  const participanteId = pessoa?.id ?? ''

  if (p.responsavel ?? idade < 18) {
    await banco.db.insert(schema.responsavel).values({
      participanteId,
      nome: 'Paulo',
      sobrenome: 'Costa',
      telefone: '11912345678',
    })
  }

  await banco.db.insert(schema.consentimento).values({
    participanteId,
    versaoTermo: 'v1.0-2026-08-19',
    aceiteParticipante: true,
    aceiteResponsavel: idade < 18 ? true : null,
    aceiteCompartilhamento: p.compartilha ?? false,
  })

  const est = p.estado ?? 'valida'
  const resolvida = est !== 'pendente'

  await banco.db.insert(schema.tentativa).values({
    participanteId,
    cockpit: p.cockpit ?? 1,
    estado: est,
    tempoMs: est === 'valida' ? 83_450 : null,
    resolvidoEm: resolvida ? AGORA : null,
    operadorId: resolvida ? operadorId : null,
  })

  return participanteId
}

async function texto(resposta: Response): Promise<string> {
  return resposta.text()
}

// ---------------------------------------------------------------------------

describe('o CSV que o Excel vai abrir', () => {
  it('separa por ponto e vírgula e termina linha com CRLF', () => {
    expect(linha(['a', 'b'])).toBe('a;b\r\n')
  })

  it('protege campo com separador, aspas ou quebra de linha', () => {
    expect(escapar('Costa; Silva')).toBe('"Costa; Silva"')
    expect(escapar('diz "oi"')).toBe('"diz ""oi"""')
    expect(escapar('linha\nquebrada')).toBe('"linha\nquebrada"')
  })

  it('neutraliza fórmula — o campo vem de formulário público', () => {
    // Injeção de fórmula em CSV: alguém se cadastra como `=1+1` e o Excel do
    // organizador **executa** aquilo ao abrir. O caminho está todo aberto neste
    // sistema — entrada pública, sem autenticação, arquivo aberto por alguém de
    // confiança numa máquina de trabalho.
    expect(escapar('=1+1')).toBe("'=1+1")
    expect(escapar('+55 11 99999')).toBe("'+55 11 99999")
    expect(escapar('-2')).toBe("'-2")
    expect(escapar('@SUM(A1)')).toBe("'@SUM(A1)")
    // Um nome comum não é tocado.
    expect(escapar('Marina Costa')).toBe('Marina Costa')
  })

  it('vazio e nulo viram célula vazia, não a palavra "null"', () => {
    expect(escapar(null)).toBe('')
    expect(escapar(undefined)).toBe('')
  })

  it('o nome do arquivo traz a data, para não virar quatro iguais na pasta', () => {
    expect(nomeDoArquivo('speedx-exportacao', new Date(2026, 8, 12, 17, 5))).toBe(
      'speedx-exportacao-2026-09-12-1705.csv',
    )
  })
})

describe('acesso (RF-35, RNF-10)', () => {
  it('sem sessão, nenhuma das três exportações sai', async () => {
    await criar()

    for (const tipo of ['completa', 'repasse', 'pendencias']) {
      const r = await exportar(tipo)
      expect(r.status, tipo).toBe(401)
      expect(await texto(r)).not.toContain('11987654321')
    }
  })

  it('com sessão, sai — e nunca em cache', async () => {
    await criar()
    await entrar()

    const r = await exportar('completa')

    expect(r.status).toBe(200)
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    expect(r.headers.get('Cache-Control')).toContain('private')
    // Uma exportação guardada em cache compartilhado seria servida ao próximo
    // que pedisse a mesma URL.
    expect(r.headers.get('Vary')).toContain('Cookie')
  })

  it('vem como anexo, com nome de arquivo datado', async () => {
    await criar()
    await entrar()

    const disposicao = (await exportar('completa')).headers.get('Content-Disposition')

    expect(disposicao).toContain('attachment')
    expect(disposicao).toMatch(/speedx-exportacao-\d{4}-\d{2}-\d{2}-\d{4}\.csv/)
  })

  it('tipo desconhecido é 400, não a exportação completa por engano', async () => {
    await entrar()

    expect((await exportar('tudo')).status).toBe(400)
  })
})

describe('a exportação completa (RF-34)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('traz Válidas, Ausentes e Pendentes — é a base, não a classificação', async () => {
    await criar({ nome: 'ComTempo', estado: 'valida' })
    await criar({ nome: 'NaoVeio', estado: 'ausente' })
    await criar({ nome: 'Esperando', estado: 'pendente' })

    const csv = await texto(await exportar('completa'))

    expect(csv).toContain('ComTempo')
    // RF-21: quem não compareceu permanece nos dados exportados.
    expect(csv).toContain('NaoVeio')
    expect(csv).toContain('Esperando')
    expect(csv.split('\r\n').filter((l) => l.trim() !== '')).toHaveLength(4)
  })

  it('começa com BOM, para "Assumpção" não virar "AssumpÃ§Ã£o"', async () => {
    await criar({ nome: 'João', sobrenome: 'Assumpção' })

    const resposta = await exportar('completa')
    const bytes = new Uint8Array(await resposta.arrayBuffer())

    // Conferido nos **bytes**, e não no texto: `Response.text()` decodifica em
    // UTF-8 e descarta o BOM inicial por especificação. A primeira versão deste
    // teste olhava o texto e acusava ausência de um BOM que estava lá — o
    // Excel, que lê bytes, teria aberto o arquivo certo.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toContain('Assumpção')
  })

  it('dados de Responsável aparecem para menor e ficam vazios para maior', async () => {
    await criar({ nome: 'Menor', idade: 15 })
    await criar({ nome: 'Maior', idade: 30 })

    const linhas = (await texto(await exportar('completa'))).split('\r\n')
    const doMenor = linhas.find((l) => l.includes('Menor')) ?? ''
    const doMaior = linhas.find((l) => l.includes('Maior')) ?? ''

    expect(doMenor).toContain('Paulo')
    expect(doMenor).toContain('11912345678')
    expect(doMenor).toContain('sim')

    expect(doMaior).not.toContain('Paulo')
    expect(doMaior).not.toContain('11912345678')
  })

  it('traz o tempo formatado e o bruto — um para ler, outro para reprocessar', async () => {
    await criar()

    const csv = await texto(await exportar('completa'))

    expect(csv).toContain('01:23.45')
    expect(csv).toContain('83450')
  })

  it('registra quem lançou e quantas correções houve', async () => {
    await criar()

    const csv = await texto(await exportar('completa'))

    expect(csv).toContain('Marina Costa')
    expect(csv.trim().split('\r\n')[1]?.endsWith(';0')).toBe(true)
  })

  it('quem correu os dois Cockpits ocupa duas linhas seguidas', async () => {
    const participanteId = await criar({ nome: 'Dois', cockpit: 1 })
    await banco.db
      .insert(schema.tentativa)
      .values({ participanteId, cockpit: 2, estado: 'pendente' })

    const linhas = (await texto(await exportar('completa')))
      .split('\r\n')
      .filter((l) => l.includes('Dois'))

    expect(linhas).toHaveLength(2)
    // Ordenadas por participante e Cockpit: as duas linhas da mesma pessoa ficam
    // juntas na planilha.
    expect(linhas[0]?.includes(';1;')).toBe(true)
    expect(linhas[1]?.includes(';2;')).toBe(true)
  })

  it('sai em lotes maiores que o tamanho do lote, sem perder linha', async () => {
    // O gerador pagina de 500 em 500; uma massa maior que isso é o que prova
    // que o cursor não pula nem repete.
    await popular(banco.db, { participantes: 600 })

    const csv = await texto(await exportar('completa'))
    const linhas = csv.split('\r\n').filter((l) => l.trim() !== '')

    const [contagem] = await banco.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.tentativa)

    // Menos o cabeçalho. Se o cursor pulasse ou repetisse, este número mudaria.
    expect(linhas.length - 1).toBe(contagem?.total)
  })
})

describe('a lista de repasse (D-23)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('traz só quem autorizou, e só nome e telefone', async () => {
    await criar({ nome: 'Autorizou', telefone: '11911111111', compartilha: true })
    await criar({ nome: 'Recusou', telefone: '11922222222', compartilha: false })

    const csv = await texto(await exportar('repasse'))

    expect(csv).toContain('Autorizou')
    expect(csv).toContain('11911111111')

    // O ponto inteiro da caixa opcional do formulário.
    expect(csv).not.toContain('Recusou')
    expect(csv).not.toContain('11922222222')
    // Nem e-mail, nem idade, nem responsável: é lista de contato.
    expect(csv).not.toContain('@exemplo.com')
  })

  it('ninguém que recusou aparece, na massa inteira', async () => {
    await popular(banco.db, { participantes: 300 })

    const csv = await texto(await exportar('repasse'))

    const recusaram = await banco.db
      .select({
        telefone: schema.participante.telefone,
        aceite: schema.consentimento.aceiteCompartilhamento,
      })
      .from(schema.participante)
      .innerJoin(
        schema.consentimento,
        eq(schema.consentimento.participanteId, schema.participante.id),
      )

    const telefonesRecusados = recusaram.filter((r) => !r.aceite).map((r) => r.telefone)
    const telefonesAutorizados = new Set(recusaram.filter((r) => r.aceite).map((r) => r.telefone))

    expect(telefonesRecusados.length).toBeGreaterThan(0)

    for (const telefone of telefonesRecusados) {
      // Um telefone repetido entre um que autorizou e um que recusou apareceria
      // legitimamente. Só é violação quando ninguém o autorizou.
      if (!telefonesAutorizados.has(telefone)) {
        expect(csv, `telefone de quem recusou vazou: ${telefone}`).not.toContain(telefone)
      }
    }
  })

  it('quem correu os dois Cockpits aparece uma vez — é contato, não tentativa', async () => {
    const participanteId = await criar({ nome: 'Unico', compartilha: true })
    await banco.db
      .insert(schema.tentativa)
      .values({ participanteId, cockpit: 2, estado: 'pendente' })

    const csv = await texto(await exportar('repasse'))

    expect(csv.split('Unico')).toHaveLength(2)
  })
})

describe('o relatório de pendências (PRD §7)', () => {
  beforeEach(async () => {
    await entrar()
  })

  it('lista exatamente as Tentativas sem tempo e sem ausência', async () => {
    await criar({ nome: 'Pendente1', estado: 'pendente' })
    await criar({ nome: 'Pendente2', estado: 'pendente', cockpit: 2 })
    await criar({ nome: 'Resolvida', estado: 'valida' })
    await criar({ nome: 'Ausente', estado: 'ausente' })

    const csv = await texto(await exportar('pendencias'))

    expect(csv).toContain('Pendente1')
    expect(csv).toContain('Pendente2')
    // Ausente **é** um desfecho: sai da métrica.
    expect(csv).not.toContain('Ausente')
    expect(csv).not.toContain('Resolvida')
  })

  it('mostra só os quatro últimos dígitos — é para achar na arquibancada', async () => {
    await criar({ nome: 'Pendente', telefone: '11987654321', estado: 'pendente' })

    const csv = await texto(await exportar('pendencias'))

    expect(csv).toContain('4321')
    expect(csv).not.toContain('11987654321')
  })

  it('com tudo resolvido, o relatório fica só com o cabeçalho — a meta é zero', async () => {
    await criar({ estado: 'valida' })

    const csv = await texto(await exportar('pendencias'))

    expect(csv.split('\r\n').filter((l) => l.trim() !== '')).toHaveLength(1)
  })
})

describe('auditoria da própria exportação (escopo 3)', () => {
  it('toda exportação deixa quem e quando no log', async () => {
    await criar()
    await entrar()

    const escritas: string[] = []
    const espiao = vi.spyOn(process.stdout, 'write').mockImplementation((t: unknown): boolean => {
      escritas.push(String(t))
      return true
    })

    await exportar('completa')
    espiao.mockRestore()

    const registro = escritas.find((l) => l.includes('custodia.exportacao')) ?? ''

    expect(registro).toContain('"resultado":"sucesso"')
    expect(registro).toContain('"motivo":"completa"')
    // Quem: o identificador do Operador. O nome não entra no log (RNF-08).
    expect(registro).toContain(operadorId)
    expect(registro).toContain('"instante"')
  })

  it('a tentativa sem sessão também deixa rastro', async () => {
    const escritas: string[] = []
    const espiao = vi.spyOn(process.stdout, 'write').mockImplementation((t: unknown): boolean => {
      escritas.push(String(t))
      return true
    })

    await exportar('completa')
    espiao.mockRestore()

    expect(escritas.join('')).toContain('"motivo":"sem_sessao"')
  })
})
