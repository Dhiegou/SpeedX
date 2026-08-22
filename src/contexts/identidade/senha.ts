import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * Derivação e conferência de senha do Operador (BC-04).
 *
 * **scrypt, e não Argon2id nem bcrypt.** A T08 pediu um dos dois; o que os une
 * e importa é serem lentos de propósito e caros em memória, e scrypt é as duas
 * coisas — com a diferença de já estar dentro do Node. `argon2` e `bcrypt`
 * exigem compilação nativa via node-gyp, e o provedor de hospedagem deste
 * projeto ainda não existe (PE-05): uma dependência que precisa de toolchain C
 * é exatamente o tipo de coisa que falha no primeiro deploy, e o evento dura um
 * dia sem janela de manutenção. `bcryptjs`, a alternativa em JavaScript puro,
 * resolve a compilação piorando o que interessa: é várias vezes mais lento por
 * hash legítimo e continua limitando a senha a 72 bytes.
 *
 * Se a hospedagem escolhida em T19 oferecer Argon2id sem custo de build, trocar
 * é barato: o formato guarda o algoritmo, e `conferirSenha` decide por ele.
 *
 * Parâmetros: N=2^16, r=8, p=1 — 64 MiB por conferência, algo em torno de dois
 * décimos de segundo. Contas de Operador são meia dúzia e o login acontece uma
 * vez por pessoa por dia; o custo cai inteiro sobre quem tenta adivinhar.
 */

const derivar = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

const ALGORITMO = 'scrypt'
const N = 65_536
const R = 8
const P = 1
const TAMANHO_SAL = 16
const TAMANHO_CHAVE = 32

/** O Node recusa a derivação se `maxmem` não couber 128 · N · r com folga. */
const MAXMEM = 160 * 1024 * 1024

const SEPARADOR = '$'

/**
 * Tamanho mínimo da senha do Operador.
 *
 * Doze, e não oito. Não há auto-cadastro (RNF-14): as contas são criadas por
 * quem tem acesso ao ambiente, uma vez, com calma — o argumento de "senha longa
 * atrapalha a adoção" não se aplica a meia dúzia de pessoas. Não há exigência
 * de símbolo nem de maiúscula, que empurram todo mundo para `Senha@2026`.
 */
export const TAMANHO_MINIMO_SENHA = 12

/**
 * Teto de tamanho. Existe porque a derivação é cara por construção: sem limite,
 * um campo de senha vira um jeito barato de ocupar 64 MiB do servidor por
 * requisição.
 */
export const TAMANHO_MAXIMO_SENHA = 200

export class SenhaFracaError extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'SenhaFracaError'
  }
}

/** Recusa o que não deve nem chegar à derivação. Usado só na criação da conta. */
export function validarForcaDaSenha(senha: unknown): string {
  if (typeof senha !== 'string' || senha.length < TAMANHO_MINIMO_SENHA) {
    throw new SenhaFracaError(
      `A senha do Operador precisa de ao menos ${String(TAMANHO_MINIMO_SENHA)} caracteres.`,
    )
  }

  if (senha.length > TAMANHO_MAXIMO_SENHA) {
    throw new SenhaFracaError(
      `A senha do Operador não pode passar de ${String(TAMANHO_MAXIMO_SENHA)} caracteres.`,
    )
  }

  return senha
}

/**
 * Deriva o hash de armazenamento.
 *
 * O resultado carrega os parâmetros junto: trocar N no futuro não invalida o
 * que já está gravado, porque a conferência lê o custo de cada hash em vez de
 * supor o atual.
 */
export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL)
  const chave = await derivar(senha, sal, TAMANHO_CHAVE, { N, r: R, p: P, maxmem: MAXMEM })

  return [
    ALGORITMO,
    String(N),
    String(R),
    String(P),
    sal.toString('base64url'),
    chave.toString('base64url'),
  ].join(SEPARADOR)
}

type Custo = { readonly N: number; readonly r: number; readonly p: number }

type HashLido = { readonly sal: Buffer; readonly chave: Buffer; readonly custo: Custo }

function lerHash(hash: string): HashLido | null {
  const partes = hash.split(SEPARADOR)
  if (partes.length !== 6) return null

  const [algoritmo, nTexto, rTexto, pTexto, salTexto, chaveTexto] = partes
  if (algoritmo !== ALGORITMO) return null

  const custo = { N: Number(nTexto), r: Number(rTexto), p: Number(pTexto) }

  const plausivel =
    Number.isInteger(custo.N) &&
    custo.N > 1 &&
    // Um `N` absurdo vindo de uma linha corrompida seria um jeito de fazer o
    // servidor tentar alocar gigabytes por requisição de login.
    custo.N <= N &&
    Number.isInteger(custo.r) &&
    custo.r > 0 &&
    custo.r <= 32 &&
    Number.isInteger(custo.p) &&
    custo.p > 0 &&
    custo.p <= 16

  if (!plausivel || salTexto === undefined || chaveTexto === undefined) return null

  const sal = Buffer.from(salTexto, 'base64url')
  const chave = Buffer.from(chaveTexto, 'base64url')

  if (sal.length === 0 || chave.length === 0) return null

  return { sal, chave, custo }
}

/**
 * Confere a senha contra o hash gravado.
 *
 * Comparação em tempo constante. Hash ilegível devolve `false` em vez de
 * lançar: uma linha corrompida no banco não pode virar 500 na tela de login,
 * onde a diferença entre erro e recusa é justamente o que não se quer contar
 * a quem está tentando.
 */
export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  if (senha.length > TAMANHO_MAXIMO_SENHA) return false

  const lido = lerHash(hash)
  if (lido === null) return false

  const candidata = await derivar(senha, lido.sal, lido.chave.length, {
    ...lido.custo,
    maxmem: MAXMEM,
  })

  return candidata.length === lido.chave.length && timingSafeEqual(candidata, lido.chave)
}

/**
 * Hash descartável, com o custo real.
 *
 * Serve para o login gastar o mesmo tempo quando o usuário não existe. Sem
 * isso, "usuário inexistente" responde em microssegundos e "senha errada" em
 * duzentos milissegundos — a resposta genérica exigida pela T08 seria genérica
 * só no texto, e qualquer relógio enumeraria as contas do painel.
 */
let fachada: Promise<string> | undefined

export async function gastarTempoDeConferencia(senha: string): Promise<void> {
  // Derivado sob demanda e reaproveitado. No import seria pior dos dois lados:
  // 64 MiB e dois décimos de segundo cobrados de todo processo que apenas
  // importa o módulo, inclusive o que nunca vai atender um login.
  fachada ??= gerarHash('nenhum-operador-com-esta-senha')

  await conferirSenha(senha, await fachada)
}
