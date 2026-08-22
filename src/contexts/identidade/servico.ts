import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/db'
import { emProducao, env } from '@/shared/env'
import { autenticar, type ComandoLogin, type ResultadoLogin } from './autenticar'
import type { Operador } from './modelo'
import { encerrarSessao, renovarSessao, resolverSessao, type SessaoValida } from './sessao'

/**
 * Composição do contexto: liga os casos de uso à conexão real e ao cookie.
 *
 * Mesmo papel de `inscricao/servico.ts`. A rota não conhece banco (o lint
 * recusa `@/db` em `app/**`) e não conhece sessão: ela chama daqui.
 *
 * **Este arquivo é o único lugar do sistema que lê o cookie de sessão.** É a
 * promessa do item 5 da T08 — os demais contextos conhecem `getOperadorAtual()`
 * e nada mais sobre autenticação — e `tests/painelGuarda.test.ts` falha se o
 * nome do cookie aparecer em qualquer outro arquivo.
 */

/**
 * Nome do cookie.
 *
 * O prefixo `__Host-` é uma regra que o **navegador** impõe: só aceita o cookie
 * se vier por HTTPS, com `Path=/` e **sem** `Domain`. Isso fecha a porta de um
 * subdomínio qualquer sobrescrever a sessão do painel, o que nenhum atributo
 * que a aplicação escreva sozinha consegue impedir.
 *
 * Fora de produção o prefixo não serve: `http://localhost` não satisfaz a
 * exigência de HTTPS e o navegador descarta o cookie em silêncio — sem o
 * desvio, ninguém consegue logar em desenvolvimento.
 */
export function nomeDoCookie(): string {
  return emProducao() ? '__Host-speedx_sessao' : 'speedx_sessao'
}

function atributosDoCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    // Fora de produção seria descartado por `http://localhost`.
    secure: emProducao(),
    // `Lax`, não `Strict`: o Operador chega ao painel por link colado num
    // grupo de mensagens, e `Strict` faria a primeira navegação chegar sem
    // cookie e cair no login mesmo com sessão viva. Escrita nenhuma acontece
    // por navegação — os endpoints do painel são POST com corpo JSON, que
    // requisição de outro site não consegue forjar sem CORS.
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  } as const
}

/** Login: autentica, abre a sessão e grava o cookie. */
export async function entrar(comando: ComandoLogin): Promise<ResultadoLogin> {
  const resultado = await autenticar(db(), comando)

  if (resultado.situacao === 'autenticado') {
    const armazem = await cookies()
    armazem.set(nomeDoCookie(), resultado.token, atributosDoCookie(resultado.expiraEm))
  }

  return resultado
}

/** Logout explícito: encerra a linha da sessão e apaga o cookie. */
export async function sair(): Promise<void> {
  const armazem = await cookies()
  const token = armazem.get(nomeDoCookie())?.value ?? null

  // Nesta ordem: a linha primeiro. Se apagar o cookie e a escrita falhar, a
  // sessão continua viva no banco com ninguém sabendo o token — que é lixo,
  // mas inofensivo. Ao contrário, uma sessão encerrada no banco com o cookie
  // ainda no aparelho é apenas um redirecionamento para o login.
  await encerrarSessao(db(), token)

  armazem.delete(nomeDoCookie())
}

/**
 * A sessão desta requisição, resolvida no máximo uma vez.
 *
 * `cache` do React memoiza dentro de uma mesma renderização: o layout do painel
 * e os componentes abaixo dele perguntam quem está logado sem multiplicar
 * consultas.
 */
const sessaoAtual = cache(async (): Promise<SessaoValida | null> => {
  const token = (await cookies()).get(nomeDoCookie())?.value ?? null

  return resolverSessao(db(), token)
})

/**
 * O que os demais contextos conhecem sobre autenticação. Nada além disto.
 *
 * Devolve `null` sem redirecionar nem lançar: quem precisa de decisão de acesso
 * usa `exigirOperador` ou `exigirOperadorNaApi`.
 */
export async function getOperadorAtual(): Promise<Operador | null> {
  return (await sessaoAtual())?.operador ?? null
}

/**
 * Guarda das páginas do painel.
 *
 * Roda no servidor, durante a renderização. É a barreira de RF-11 — não a
 * ausência de link para o painel, não um `if` no cliente. Sem sessão, ninguém
 * chega a montar a árvore de componentes que consulta a fila.
 *
 * **Não renova a sessão.** Server Component não pode escrever cookie: a
 * resposta pode já ter começado a ser transmitida. A renovação acontece nas
 * rotas de API do painel, que é por onde o Operador de fato passa o dia — ver
 * `exigirOperadorNaApi`.
 */
export async function exigirOperador(): Promise<Operador> {
  const sessao = await sessaoAtual()

  if (sessao === null) redirect(ROTA_LOGIN)

  return sessao.operador
}

export const ROTA_LOGIN = '/painel/login'

export type GuardaDaApi =
  | { readonly autorizado: true; readonly operador: Operador }
  | { readonly autorizado: false; readonly resposta: Response }

/**
 * Guarda das rotas de API do painel.
 *
 * Responde 401 em vez de redirecionar: quem chama é `fetch` do painel, e um 302
 * para HTML faria o cliente tratar a página de login como se fosse dado.
 *
 * Aqui a renovação silenciosa acontece, porque rota de API pode escrever
 * cookie. Durante a operação o painel chama a API o tempo todo, então a sessão
 * desliza sozinha enquanto houver trabalho — e para quem logou e ficou parado
 * vale o teto de `SESSAO_HORAS`, que cobre o evento inteiro.
 */
export async function exigirOperadorNaApi(): Promise<GuardaDaApi> {
  const sessao = await sessaoAtual()

  if (sessao === null) {
    return {
      autorizado: false,
      resposta: Response.json(
        { erro: { codigo: 'nao_autenticado', mensagem: 'Faça login para usar o painel.' } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    }
  }

  const novoPrazo = await renovarSessao(db(), sessao)

  if (novoPrazo !== null) {
    const armazem = await cookies()
    const token = armazem.get(nomeDoCookie())?.value

    if (token !== undefined) {
      armazem.set(nomeDoCookie(), token, atributosDoCookie(novoPrazo))
    }
  }

  return { autorizado: true, operador: sessao.operador }
}

/** Quanto tempo a sessão dura sem uso, em horas. Mostrado na tela de login. */
export function horasDeSessao(): number {
  return env().SESSAO_HORAS
}
