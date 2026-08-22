/**
 * Leitura de cabeçalhos de requisição. Sem estado, sem banco, sem contexto.
 */

/**
 * Endereço de origem da requisição.
 *
 * A aplicação nunca fala direto com o celular de quem se inscreve: entre os
 * dois há a borda da hospedagem. `X-Forwarded-For` é uma lista construída por
 * acréscimo, e o **primeiro** elemento é o cliente segundo quem escreveu — quer
 * dizer, segundo qualquer um, porque o cliente pode mandar o cabeçalho já
 * preenchido e a borda apenas acrescenta.
 *
 * Isto é aceitável aqui, e não seria em uma decisão de autorização: o único uso
 * é o limite de taxa (RNF-12), onde forjar a origem serve para *escapar* do
 * limite, nunca para trancar outra pessoa fora — cada valor forjado abre um
 * balde novo em vez de encher o de alguém.
 *
 * **Depende de T19:** a borda precisa sobrescrever (não acrescentar) o
 * cabeçalho. Se não sobrescrever, o limite vira decorativo, e é por isso que
 * T21 confere o valor que chega aqui em vez de supor.
 */
export function enderecoDeOrigem(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get('x-forwarded-for')

  if (encaminhado !== null) {
    const primeiro = encaminhado.split(',')[0]?.trim()
    if (primeiro !== undefined && primeiro !== '') return primeiro
  }

  const direto = cabecalhos.get('x-real-ip')?.trim()

  return direto !== undefined && direto !== '' ? direto : null
}

/**
 * Confere o `Content-Type` da requisição.
 *
 * Compara só o tipo, ignorando parâmetros: `application/json; charset=utf-8` é
 * o que a maioria dos clientes manda e é a mesma coisa.
 */
export function ehTipo(cabecalhos: Headers, esperado: string): boolean {
  const tipo = cabecalhos.get('content-type')

  if (tipo === null) return false

  return tipo.split(';')[0]?.trim().toLowerCase() === esperado
}
