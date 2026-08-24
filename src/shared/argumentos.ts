/**
 * Leitura de argumentos de linha de comando, no formato `--chave valor`.
 *
 * Nasceu dentro de `scripts/criar-operador.ts` em T08 e saiu de lá em T15,
 * quando o expurgo passou a precisar exatamente da mesma coisa. Dois comandos
 * com dois analisadores próprios divergem no primeiro dia em que um deles
 * ganha uma bandeira sem valor — e a diferença entre `--confirmar` interpretado
 * como `true` e como a string seguinte é, aqui, apagar ou não apagar a base.
 *
 * Não traz dependência: `parseArgs` do Node faria isto, e exigiria declarar o
 * tipo de cada opção antes de ler. Estas quinze linhas cobrem os dois usos.
 */

/** `--nome valor` vira `{ nome: 'valor' }`; `--confirmar` sozinho vira `true`. */
export type Argumentos = { readonly [chave: string]: string | true }

export function lerArgumentos(argv: readonly string[]): Argumentos {
  const resultado: Record<string, string | true> = {}

  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i]
    if (atual === undefined || !atual.startsWith('--')) continue

    const chave = atual.slice(2)
    const seguinte = argv[i + 1]

    if (seguinte !== undefined && !seguinte.startsWith('--')) {
      resultado[chave] = seguinte
      i += 1
    } else {
      resultado[chave] = true
    }
  }

  return resultado
}

/** O valor da opção quando ela veio com valor; `null` quando veio sozinha ou não veio. */
export function texto(argumentos: Argumentos, chave: string): string | null {
  const valor = argumentos[chave]
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

/** Se a bandeira foi passada, com ou sem valor. */
export function presente(argumentos: Argumentos, chave: string): boolean {
  return argumentos[chave] !== undefined
}
