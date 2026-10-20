import { createInterface } from 'node:readline'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  criarOperador,
  desativarOperador,
  existeOperador,
  OperadorDuplicadoError,
  redefinirSenha,
} from '@/contexts/identidade/criarOperador'
import { destravarLogin } from '@/contexts/identidade/destravarLogin'
import { SenhaFracaError, TAMANHO_MINIMO_SENHA } from '@/contexts/identidade/senha'
import * as schema from '@/db/schema'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { lerArgumentos } from '@/shared/argumentos'
import { env } from '@/shared/env'
import { registrarOperacao } from '@/shared/log'

carregarAmbienteDoTerminal()

/**
 * Criação de contas de Operador pela linha de comando (RNF-14).
 *
 * `npm run criar-operador -- --usuario marina --nome "Marina Costa"`
 * `npm run criar-operador -- --desativar marina`
 * `npm run criar-operador -- --destravar marina`
 * `npm run criar-operador -- --redefinir-senha marina`
 *
 * **Este é o único caminho que cria conta neste sistema.** Não há rota, não há
 * formulário, não há convite por link. Quem roda isto já tem a `DATABASE_URL`
 * nas mãos — a autorização é o acesso ao ambiente, e não uma permissão que o
 * próprio sistema conceda e possa ser escalada.
 *
 * **A senha não entra por argumento.** Ela é digitada no prompt, sem eco.
 * Argumento de linha de comando aparece no histórico do shell e na lista de
 * processos da máquina, onde fica visível para qualquer usuário do sistema —
 * gravar a senha do painel nos dois seria desfazer o trabalho de `scrypt` antes
 * mesmo dele começar.
 */

/**
 * Pergunta sem devolver eco ao terminal.
 *
 * O `readline` do Node escreve cada tecla de volta; sobrescrever
 * `_writeToOutput` durante a leitura é a forma de silenciá-lo sem trazer uma
 * dependência só para isso. A propriedade não é pública, e é por isso que o
 * acesso está isolado aqui, em três linhas, em vez de espalhado.
 */
function perguntarOculto(pergunta: string): Promise<string> {
  const leitor = createInterface({ input: process.stdin, output: process.stdout })

  const silenciavel = leitor as unknown as { _writeToOutput?: (texto: string) => void }
  const original = silenciavel._writeToOutput

  return new Promise<string>((resolver) => {
    process.stdout.write(pergunta)

    silenciavel._writeToOutput = () => {
      /* nada: a senha não volta para a tela */
    }

    leitor.question('', (resposta) => {
      silenciavel._writeToOutput = original
      process.stdout.write('\n')
      leitor.close()
      resolver(resposta)
    })
  })
}

function perguntar(pergunta: string): Promise<string> {
  const leitor = createInterface({ input: process.stdin, output: process.stdout })

  return new Promise<string>((resolver) => {
    leitor.question(pergunta, (resposta) => {
      leitor.close()
      resolver(resposta.trim())
    })
  })
}

/** Usuário inexistente: recusa com rastro, e sem criar conta por engano. */
function recusarRedefinicao(usuario: string): void {
  registrarOperacao({
    evento: 'identidade.redefinir_senha',
    resultado: 'recusada',
    motivo: 'usuario_inexistente',
  })
  console.error(`Nenhum Operador com o usuário "${usuario}". Nada foi alterado.`)
  process.exitCode = 1
}

async function principal(): Promise<void> {
  const argumentos = lerArgumentos(process.argv.slice(2))
  const { DATABASE_URL, NODE_ENV } = env()

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    max: 1,
  })

  try {
    const db = drizzle(pool, { schema })

    const aDestravar = argumentos.destravar
    if (typeof aDestravar === 'string') {
      const { porConta, porOrigem } = await destravarLogin(db, aDestravar)

      console.log(
        `Limite de login zerado: ${String(porConta)} marca(s) da conta "${aDestravar}" e ` +
          `${String(porOrigem)} de origem. O limite volta a contar na próxima tentativa.`,
      )
      return
    }

    const aRedefinir = argumentos['redefinir-senha']
    if (typeof aRedefinir === 'string') {
      // Recusa antes de pedir a senha: digitar duas vezes doze caracteres para
      // descobrir no fim que o usuário estava errado é tempo jogado fora.
      if (!(await existeOperador(db, aRedefinir))) {
        recusarRedefinicao(aRedefinir)
        return
      }

      const senha = await perguntarOculto(`Senha nova (mínimo ${String(TAMANHO_MINIMO_SENHA)}): `)
      const confirmacao = await perguntarOculto('Repita a senha nova: ')

      if (senha !== confirmacao) {
        console.error('As senhas não conferem. Nada foi alterado.')
        process.exitCode = 1
        return
      }

      let redefinicao: Awaited<ReturnType<typeof redefinirSenha>>
      try {
        redefinicao = await redefinirSenha(db, aRedefinir, senha)
      } catch (erro) {
        if (erro instanceof SenhaFracaError) throw erro

        // Erro de consulta do Drizzle traz os parâmetros no texto, e um deles é
        // o hash novo. Daqui sai só a mensagem do Postgres, que não os carrega.
        const causa = erro instanceof Error && erro.cause instanceof Error ? erro.cause : null
        registrarOperacao({ evento: 'identidade.redefinir_senha', resultado: 'erro' })
        console.error(
          `Falha ao redefinir a senha. Nada foi alterado: a troca é uma transação só.` +
            (causa === null ? '' : ` Banco: ${causa.message}`),
        )
        process.exitCode = 1
        return
      }

      if (redefinicao === null) {
        recusarRedefinicao(aRedefinir)
        return
      }

      const { porConta, porOrigem } = redefinicao.destravamento

      // Sem senha e sem hash: a referência é o id da conta, e o resto é contagem.
      registrarOperacao({
        evento: 'identidade.redefinir_senha',
        resultado: 'sucesso',
        motivo: 'terminal',
        referencia: redefinicao.operadorId,
        contagens: { sessao: redefinicao.sessoesEncerradas, limite_taxa: porConta + porOrigem },
      })

      console.log(`Senha do Operador "${aRedefinir}" redefinida.`)
      console.log(
        `Login destravado: ${String(porConta)} marca(s) da conta e ${String(porOrigem)} de origem zeradas.`,
      )
      console.log(
        `Sessões encerradas: ${String(redefinicao.sessoesEncerradas)}. Quem estava logado precisa entrar de novo.`,
      )

      if (!redefinicao.ativo) {
        console.log(
          'Atenção: a conta está desativada, e a redefinição não a reativa. A senha nova só entra com a conta ativa.',
        )
      }
      return
    }

    const aDesativar = argumentos.desativar
    if (typeof aDesativar === 'string') {
      const desativado = await desativarOperador(db, aDesativar)

      console.log(
        desativado
          ? `Operador "${aDesativar}" desativado. As sessões abertas caem na próxima requisição.`
          : `Nenhum Operador com o usuário "${aDesativar}".`,
      )
      return
    }

    const usuario =
      typeof argumentos.usuario === 'string' ? argumentos.usuario : await perguntar('Usuário: ')
    const nome =
      typeof argumentos.nome === 'string' ? argumentos.nome : await perguntar('Nome completo: ')

    const senha = await perguntarOculto(`Senha (mínimo ${String(TAMANHO_MINIMO_SENHA)}): `)
    const confirmacao = await perguntarOculto('Repita a senha: ')

    if (senha !== confirmacao) {
      console.error('As senhas não conferem. Nada foi criado.')
      process.exit(1)
    }

    const operador = await criarOperador(db, { usuario, nome, senha })

    console.log(`Operador criado: ${operador.nome} (${operador.id}).`)
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  // Erro esperado sai como uma frase; o resto sai inteiro, porque é defeito.
  if (erro instanceof OperadorDuplicadoError || erro instanceof SenhaFracaError) {
    console.error(erro.message)
  } else {
    console.error('Falha ao criar o Operador:', erro)
  }

  process.exit(1)
})
