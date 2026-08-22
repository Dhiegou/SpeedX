/**
 * O modelo publicado de BC-04 — e ele é minúsculo de propósito.
 *
 * O SDD diz que Cronometragem e Custódia devem depender apenas do conceito de
 * "Operador autenticado", nunca do mecanismo. Isto aqui é esse conceito. Nome
 * de usuário, hash de senha, estado da conta e sessão não aparecem: são
 * assunto interno deste contexto, e o dia em que a autenticação for trocada por
 * outra coisa nada disso pode vazar para fora.
 *
 * `nome` está aqui porque o painel precisa mostrar quem está logado e RF-23
 * precisa nomear quem fez o Lançamento. `id` é o que a coluna `operador_id`
 * guarda.
 */
export type Operador = {
  readonly id: string
  readonly nome: string
}
