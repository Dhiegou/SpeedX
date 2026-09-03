/**
 * Gera o SQL de criação de um Operador **sem tocar no banco**.
 *
 * `npm run operador:sql -- --usuario marina --nome "Marina Costa"`
 *
 * **Isto não substitui `npm run criar-operador`**, que é o caminho normal e
 * faz mais: recusa usuário duplicado pela unicidade do banco, sabe desativar e
 * destravar conta. Use aquele sempre que o banco estiver alcançável.
 *
 * Este existe para quando ele não está. A porta 5432 é bloqueada em muitas
 * redes institucionais — a da FIAP entre elas —, e sem um caminho alternativo
 * a criação da primeira conta de Operador fica refém de onde a pessoa está.
 * Aqui o hash é derivado localmente, com o mesmo `gerarHash` do sistema, e o
 * INSERT é levado ao banco por HTTPS: o SQL Editor do provedor.
 *
 * **A senha não sai da máquina.** O que viaja é o hash scrypt, e dele não se
 * volta. Ela também não vira argumento de linha de comando — argumento aparece
 * no histórico do shell e na lista de processos, visível a qualquer usuário da
 * máquina. É digitada no prompt, sem eco.
 *
 * **O que este script não confere:** se o usuário já existe. O INSERT falha no
 * banco pela unicidade funcional de `operador_usuario_minusculo_idx`, que é
 * onde a regra mora de propósito (ver `criarOperador.ts`) — a mensagem virá do
 * Postgres, não daqui.
 */
import { createInterface } from 'node:readline'
import { gerarHash, TAMANHO_MINIMO_SENHA, validarForcaDaSenha } from '@/contexts/identidade/senha'

function perguntarOculto(pergunta: string): Promise<string> {
  const io = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const saida = io as unknown as { _writeToOutput?: (t: string) => void }
  const original = saida._writeToOutput
  return new Promise((resolver) => {
    saida._writeToOutput = (texto: string) => {
      if (texto.includes(pergunta)) process.stdout.write(texto)
    }
    io.question(pergunta, (resposta) => {
      saida._writeToOutput = original
      process.stdout.write('\n')
      io.close()
      resolver(resposta)
    })
  })
}

function argumento(nome: string): string {
  const i = process.argv.indexOf(`--${nome}`)
  const valor = i >= 0 ? process.argv[i + 1] : undefined
  if (valor === undefined) throw new Error(`Falta --${nome}`)
  return valor
}

async function principal(): Promise<void> {
  const usuario = argumento('usuario')
  const nome = argumento('nome')

  const senha = await perguntarOculto(`Senha (mínimo ${String(TAMANHO_MINIMO_SENHA)} caracteres): `)

  validarForcaDaSenha(senha)
  const hash = await gerarHash(senha)

  console.log('\n-- Cole no SQL Editor do Neon (console.neon.tech > seu projeto > SQL Editor):\n')
  console.log('insert into operador (usuario, nome, senha_hash)')
  console.log(`values ('${usuario}', '${nome.replace(/'/g, "''")}', '${hash}');\n`)
}

principal().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
