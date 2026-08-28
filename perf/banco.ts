/**
 * Endereço e credenciais do banco de carga. **Sem efeito nenhum ao importar.**
 *
 * Isto começou dentro de `preparar.ts`, e a lição custou uma medição inteira:
 * `medir.ts` importava `urlDoBancoDeCarga` de lá, e `preparar.ts` **executa a si
 * mesmo** ao ser carregado — a última linha do arquivo chama `principal()`.
 * Importar a constante disparava o preparo, `truncate` incluído, em paralelo
 * com a medição. A primeira execução mediu 3227 linhas; a segunda mediu zero,
 * porque o apagamento ganhou a corrida.
 *
 * O defeito não é o `truncate`: é um arquivo ser as duas coisas ao mesmo tempo,
 * biblioteca e comando. Quem exporta não executa.
 */

export const NOME_DO_BANCO_DE_CARGA = 'speedx_carga'

/**
 * O Operador do teste de escrita. A senha é fixa e está aqui em claro de
 * propósito: este banco é descartável, não tem dado de ninguém e nunca sobe.
 * Um segredo de verdade aqui seria um segredo a mais para vazar sem nada em
 * troca.
 */
export const OPERADOR_DE_CARGA = {
  usuario: 'carga',
  nome: 'Operador de Carga',
  senha: 'carga-de-teste-2026',
} as const

/** Deriva a URL do banco de carga da de desenvolvimento — sem uma segunda variável. */
export function urlDoBancoDeCarga(base: string): string {
  const url = new URL(base)
  url.pathname = `/${NOME_DO_BANCO_DE_CARGA}`
  return url.toString()
}

/** A URL do banco administrativo, para poder criar o outro. */
export function urlAdministrativa(base: string): string {
  const url = new URL(base)
  url.pathname = '/postgres'
  return url.toString()
}
