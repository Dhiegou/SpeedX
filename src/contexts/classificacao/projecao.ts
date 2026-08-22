/**
 * Projeção materializada da Classificação — a fronteira onde o dado transacional
 * vira modelo público.
 *
 * É o **único** arquivo de Classificação autorizado a alcançar o banco: o lint
 * bloqueia `@/db/**` em todo o resto do contexto. A regra existe para que a
 * tradução aconteça em um lugar nomeado, e não espalhada por consultas ad hoc.
 *
 * Regras que a implementação de T12 precisa respeitar:
 *  - ler apenas Tentativas com estado `valida` (Ausente e Pendente nunca entram)
 *  - selecionar apenas as colunas necessárias: o que não é lido não pode vazar
 *  - ler a idade **apenas** para decidir o formato do nome, via
 *    `deveAbreviarSobrenome`, e não copiá-la para o modelo de saída (RNF-08)
 *  - converter nome + sobrenome em Nome Público na leitura, via `paraNomePublico`
 *  - ordenar por tempo crescente, desempatando pelo Lançamento mais antigo (RF-31)
 *
 * Implementação em T12.
 */

export {}
