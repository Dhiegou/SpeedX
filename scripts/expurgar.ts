import { createInterface } from 'node:readline'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  contarBase,
  excluirParticipante,
  expurgarTudo,
  higienizar,
  procurarPorEmail,
  resumoAnonimo,
  type ContagemDaBase,
  type ResumoAnonimo,
} from '@/contexts/custodia/expurgo'
import {
  DIAS_DE_RETENCAO,
  DataDoEventoInvalidaError,
  diasRestantes,
  lerDiaDoEvento,
  prazoVencido,
  vencimentoDaRetencao,
} from '@/contexts/custodia/retencao'
import * as schema from '@/db/schema'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { lerArgumentos, presente, texto, type Argumentos } from '@/shared/argumentos'
import { env } from '@/shared/env'
import { registrarOperacao } from '@/shared/log'
import { formatTempo } from '@/shared/tempo'

carregarAmbienteDoTerminal()

/**
 * Expurgo e exclusão (T15 — RNF-11, RF-09).
 *
 * ```
 * npm run expurgar -- --evento 2026-09-12                       # ensaio: mostra o que sairia
 * npm run expurgar -- --evento 2026-09-12 --confirmar           # expurgo total
 * npm run expurgar -- --email alguem@exemplo.com                # procura o pedido de exclusão
 * npm run expurgar -- --participante <uuid> --confirmar         # exclusão individual
 * npm run expurgar -- --higiene                                 # faxina sob demanda
 * ```
 *
 * **Comando de terminal, e não rota do painel.** Um botão "apagar tudo" no
 * painel é um botão que alguém aperta às dezoito horas do dia do evento. Quem
 * roda isto precisa ter a `DATABASE_URL` nas mãos — a mesma autorização por
 * acesso ao ambiente que governa a criação de contas (RNF-14).
 *
 * **Três travas, e cada uma existe por um acidente diferente:**
 *
 * 1. **Sem `--confirmar`, nada é apagado.** O padrão é o ensaio, que conta e
 *    mostra. Quem digita o comando errado vê um relatório, não uma base vazia.
 * 2. **A data do evento é obrigatória e não tem valor padrão.** O prazo foi
 *    prometido contra um dia específico (PE-02); um padrão aqui seria um
 *    palpite com poder de apagar a base, e a data ainda nem está definida
 *    (PE-06).
 * 3. **O expurgo total recusa rodar antes do vencimento.** Apagar cedo é mais
 *    protetivo em tese e catastrófico na prática: o caso real não é o
 *    organizador zeloso, é um dedo trocado na data no meio da semana do evento.
 *    `--antecipar` existe para quem de fato quer, e diz o que está fazendo.
 */

const RESPONSAVEL_FALTANDO =
  'Informe quem está executando: --responsavel "Nome de quem executa". ' +
  'O comprovante precisa dizer quem apagou, e ninguém confere isso depois.'

function ajuda(): void {
  console.log(`
Expurgo e exclusão de dados (T15).

  npm run expurgar -- --evento AAAA-MM-DD
      Ensaio do expurgo total: conta o que existe e diz se o prazo venceu.
      Não apaga nada.

  npm run expurgar -- --evento AAAA-MM-DD --confirmar --responsavel "Nome"
      Expurgo total. Recusa rodar antes de ${String(DIAS_DE_RETENCAO)} dias
      depois do evento; use --antecipar para forçar.

  npm run expurgar -- --email pessoa@exemplo.com
      Procura de quem é o pedido de exclusão. Não apaga nada.

  npm run expurgar -- --participante <uuid> --confirmar --responsavel "Nome"
      Exclusão individual, a pedido (termo, seção "exclusao").

  npm run expurgar -- --higiene
      Apaga chaves de idempotência e marcas de limite com mais de 48 h, e
      sessões expiradas ou encerradas. Roda sozinho a cada hora; isto é para
      quando o ambiente não colaborar.

Antes do expurgo total, exporte a base: npm run dev e GET /api/exportacao.
O procedimento completo está em docs/retencao.md.
`)
}

function tabela(contagem: ContagemDaBase): string {
  return Object.entries(contagem)
    .map(([nome, total]) => `  ${nome.padEnd(20)} ${String(total).padStart(7)}`)
    .join('\n')
}

/**
 * O resumo anônimo em texto legível.
 *
 * Sai no ensaio e antes do expurgo, nos dois casos **antes** de qualquer
 * DELETE: é a última chance de alguém perceber que a base ligada não é a que
 * ele pensava — doze participantes onde deveriam estar duas mil é um banco de
 * teste, e o comando estaria prestes a apagar o errado.
 */
function resumoEmTexto(resumo: ResumoAnonimo): string {
  const ms = (valor: number | null): string => (valor === null ? '—' : formatTempo(valor))

  const linhas = resumo.pitches.map(
    (p) =>
      `  pitch ${String(p.pitch)}  ${String(p.tentativas).padStart(5)} tentativas  ` +
      `${String(p.validas).padStart(5)} válidas  ${String(p.ausentes).padStart(4)} ausentes  ` +
      `${String(p.pendentes).padStart(4)} pendentes  melhor ${ms(p.melhorMs)}  ` +
      `mediana ${ms(p.medianaMs)}  pior ${ms(p.piorMs)}`,
  )

  return [
    `  participantes       ${String(resumo.participantes)} ` +
      `(${String(resumo.menoresDeIdade)} menores de idade)`,
    ...linhas,
  ].join('\n')
}

/**
 * A confirmação digitada por extenso.
 *
 * `--confirmar` já foi passado quando se chega aqui; esta é a segunda porta, e
 * ela pede a palavra inteira porque um `y` é fácil demais de apertar por
 * reflexo depois de um comando longo.
 *
 * **Fim de entrada é "não".** Sem terminal — num pipe, num agendador, num CI —
 * o `readline` fecha sem nunca chamar a resposta. Sem este tratamento a
 * promessa ficaria pendurada para sempre; com um tratamento descuidado, o
 * silêncio viraria consentimento. Só existe uma leitura segura das duas, e é a
 * que recusa: nada aqui pode ser desfeito.
 */
function confirmarNoTeclado(pergunta: string, esperado: string): Promise<boolean> {
  const leitor = createInterface({ input: process.stdin, output: process.stdout })

  return new Promise<boolean>((resolver) => {
    leitor.on('close', () => {
      resolver(false)
    })

    leitor.question(`${pergunta}\nDigite "${esperado}" para prosseguir: `, (resposta) => {
      // Resolve **antes** de fechar: `close()` emite o evento acima na hora, e
      // a promessa já resolvida ignora o `false` que vem depois. Na ordem
      // inversa, uma confirmação legítima seria engolida pelo próprio close.
      resolver(resposta.trim() === esperado)
      leitor.close()
    })
  })
}

type Db = ReturnType<typeof drizzle<typeof schema>>

// ---------------------------------------------------------------------------

async function total(db: Db, argumentos: Argumentos): Promise<void> {
  const dataInformada = texto(argumentos, 'evento')

  if (dataInformada === null) {
    console.error(
      'Informe a data do evento: --evento AAAA-MM-DD.\n' +
        `A guarda é de ${String(DIAS_DE_RETENCAO)} dias contados a partir dela, e o comando ` +
        'não adivinha essa data.',
    )
    process.exit(1)
  }

  const dia = lerDiaDoEvento(dataInformada)
  const vencimento = vencimentoDaRetencao(dia)
  const venceu = prazoVencido(dia)
  const contagem = await contarBase(db)

  console.log(`\nEvento em ${dataInformada}. Guarda de ${String(DIAS_DE_RETENCAO)} dias.`)
  console.log(`Vence em ${vencimento.toISOString()} (00:00 no fuso do evento).`)
  console.log(venceu ? 'O prazo VENCEU.' : `Faltam ${String(diasRestantes(dia))} dia(s).`)
  console.log(`\nO que existe na base agora:\n${tabela(contagem)}`)
  console.log(
    `\nO que sobrevive ao expurgo — números, e só:\n${resumoEmTexto(await resumoAnonimo(db))}`,
  )

  if (!presente(argumentos, 'confirmar')) {
    console.log(
      '\nEnsaio: nada foi apagado. Repita com --confirmar --responsavel "Nome" para executar.',
    )
    return
  }

  const responsavel = texto(argumentos, 'responsavel')
  if (responsavel === null) {
    console.error(`\n${RESPONSAVEL_FALTANDO}`)
    process.exit(1)
  }

  if (!venceu && !presente(argumentos, 'antecipar')) {
    console.error(
      `\nRecusado: o prazo só vence em ${vencimento.toISOString()}.\n` +
        'Se a antecipação é intencional, repita com --antecipar.',
    )
    process.exit(1)
  }

  const aceitou = await confirmarNoTeclado(
    `\nIsto apaga ${String(contagem.participante)} participante(s) e tudo que se liga a eles. ` +
      'Não há como desfazer.',
    'APAGAR',
  )

  if (!aceitou) {
    console.log('Cancelado. Nada foi apagado.')
    return
  }

  const resultado = await expurgarTudo(db)

  registrarOperacao({
    evento: 'custodia.expurgo.total',
    resultado: 'sucesso',
    motivo: 'prazo_de_retencao',
    contagens: resultado.antes,
  })

  console.log('\n--- comprovante de expurgo -------------------------------')
  console.log(`executado em      ${new Date().toISOString()}`)
  console.log(`responsável       ${responsavel}`)
  console.log(`evento            ${dataInformada}`)
  console.log(`antecipado        ${venceu ? 'não' : 'sim'}`)
  console.log(`\nlinhas apagadas:\n${tabela(resultado.antes)}`)
  console.log(`\nconferência (tem de ser tudo zero):\n${tabela(resultado.depois)}`)
  console.log('----------------------------------------------------------')
  console.log(
    '\nGuarde este comprovante. Falta ainda tirar o site do ar: o termo promete que\n' +
      'a página de classificação deixa de existir no mesmo prazo (docs/retencao.md).',
  )
}

// ---------------------------------------------------------------------------

async function individual(db: Db, argumentos: Argumentos): Promise<void> {
  const email = texto(argumentos, 'email')

  if (email !== null) {
    const achados = await procurarPorEmail(db, email)

    if (achados.length === 0) {
      console.log(
        `Nenhum participante com esse e-mail. Pode ser que já tenha sido excluído, ou que\n` +
          'o pedido tenha vindo de um endereço diferente do usado na inscrição.',
      )
      return
    }

    console.log(`\n${String(achados.length)} participante(s) com esse e-mail:\n`)
    for (const p of achados) {
      console.log(
        `  ${p.id}  ${p.nome} ${p.sobrenome}  tel ...${p.ultimos4Telefone}  ${String(p.idade)} anos`,
      )
    }
    console.log(
      '\nConfira de quem é o pedido e repita com:\n' +
        '  npm run expurgar -- --participante <uuid> --confirmar --responsavel "Nome"',
    )
    return
  }

  const participanteId = texto(argumentos, 'participante')
  if (participanteId === null) return ajuda()

  if (!presente(argumentos, 'confirmar')) {
    console.log('Ensaio: nada foi apagado. Repita com --confirmar --responsavel "Nome".')
    return
  }

  const responsavel = texto(argumentos, 'responsavel')
  if (responsavel === null) {
    console.error(RESPONSAVEL_FALTANDO)
    process.exit(1)
  }

  const resultado = await excluirParticipante(db, participanteId)

  if (!resultado.encontrado) {
    console.log(`Nenhum participante com o id ${participanteId}. Nada foi apagado.`)
    return
  }

  registrarOperacao({
    evento: 'custodia.exclusao',
    resultado: 'sucesso',
    motivo: 'pedido_do_titular',
    // O id de quem foi apagado. É opaco e não resolve mais para nada — que é
    // exatamente o que uma auditoria de exclusão precisa provar.
    referencia: resultado.participanteId,
    contagens: {
      participante: 1,
      tentativa: resultado.tentativasRemovidas,
      lancamento: resultado.lancamentosRemovidos,
    },
  })

  console.log('\n--- comprovante de exclusão ------------------------------')
  console.log(`executado em      ${new Date().toISOString()}`)
  console.log(`responsável       ${responsavel}`)
  console.log(`participante      ${resultado.participanteId}`)
  console.log(`menor de idade    ${resultado.eraMenorDeIdade ? 'sim' : 'não'}`)
  console.log(`tentativas        ${String(resultado.tentativasRemovidas)}`)
  console.log(`lançamentos       ${String(resultado.lancamentosRemovidos)}`)
  console.log('----------------------------------------------------------')

  console.log(
    '\nA linha sai da Classificação pública na próxima revalidação — menos de um minuto,\n' +
      'somando o memo da projeção ao cache de borda.',
  )

  if (resultado.autorizouRepasse) {
    console.log(
      '\nATENÇÃO: esta pessoa tinha autorizado o repasse do telefone.\n' +
        'O termo promete encaminhar o pedido a quem recebeu. Escreva HOJE para a FIAP e\n' +
        'para a escolinha pedindo a exclusão da cópia que está com eles, e guarde a\n' +
        'resposta junto deste comprovante. Nós não apagamos a cópia deles.',
    )
  } else {
    console.log(
      '\nEsta pessoa não autorizou o repasse: não há cópia com a FIAP nem com a escolinha.',
    )
  }
}

// ---------------------------------------------------------------------------

async function faxina(db: Db): Promise<void> {
  const contagens = await higienizar(db)

  registrarOperacao({ evento: 'custodia.higiene', resultado: 'sucesso', contagens })

  console.log(
    `Higiene concluída: ${String(contagens.chaveIdempotencia)} chave(s) de idempotência, ` +
      `${String(contagens.limiteTaxa)} marca(s) de limite e ${String(contagens.sessao)} sessão(ões).`,
  )
}

// ---------------------------------------------------------------------------

async function principal(): Promise<void> {
  const argumentos = lerArgumentos(process.argv.slice(2))
  const { DATABASE_URL, NODE_ENV } = env()

  if (presente(argumentos, 'ajuda') || Object.keys(argumentos).length === 0) {
    ajuda()
    return
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    max: 1,
  })

  try {
    const db = drizzle(pool, { schema })

    if (presente(argumentos, 'higiene')) return await faxina(db)
    if (presente(argumentos, 'email') || presente(argumentos, 'participante')) {
      return await individual(db, argumentos)
    }

    await total(db, argumentos)
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  if (erro instanceof DataDoEventoInvalidaError) {
    console.error(erro.message)
  } else {
    console.error('Falha no expurgo:', erro)
  }

  process.exit(1)
})
