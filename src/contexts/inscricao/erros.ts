import type { ZodError, core } from 'zod'
import { COCKPIT } from '@/shared/vocabulario'

/**
 * Erros de validação da Inscrição (RNF-17).
 *
 * O requisito pede mensagem específica por campo, e não um "dados inválidos"
 * único. A forma `{ campo, codigo, mensagem }` separa três leitores diferentes:
 * o formulário de T06 precisa do **campo** para destacar a linha certa, o teste
 * e o suporte precisam do **código** estável, e a pessoa precisa da
 * **mensagem**. Reaproveitar a mensagem como identificador quebraria os testes
 * na primeira vez que alguém melhorasse a redação.
 */

/**
 * Códigos de erro. União fechada de propósito: acrescentar uma regra sem
 * declarar o código aqui não compila, e é assim que a lista continua completa
 * quando T06 for desenhar as mensagens.
 */
export type CodigoErro =
  | 'campo_obrigatorio'
  | 'tipo_invalido'
  | 'nome_formato'
  | 'nome_tamanho'
  | 'email_formato'
  | 'email_tamanho'
  | 'telefone_formato'
  | 'idade_nao_inteira'
  | 'idade_minima'
  | 'idade_maxima'
  | 'cockpit_ausente'
  | 'cockpit_invalido'
  | 'cockpit_repetido'
  | 'consentimento_recusado'
  | 'responsavel_ausente'
  | 'aceite_responsavel_ausente'

export type ErroDeValidacao = {
  /** Caminho do campo, com ponto para aninhamento: `responsavel.telefone`. */
  readonly campo: string
  readonly codigo: CodigoErro
  readonly mensagem: string
}

/**
 * Entrada recusada pelo domínio.
 *
 * Carrega a lista inteira, e não o primeiro erro: quem preenche formulário em
 * celular na fila do evento não deve descobrir os problemas um por vez.
 */
export class InscricaoInvalidaError extends Error {
  readonly erros: readonly ErroDeValidacao[]

  constructor(erros: readonly ErroDeValidacao[]) {
    super(`Inscrição inválida: ${erros.map((e) => e.campo).join(', ')}`)
    this.name = 'InscricaoInvalidaError'
    this.erros = erros
  }
}

/** Erro cujo código a regra declarou explicitamente, via `params.codigo`. */
function codigoDeclarado(issue: core.$ZodIssue): CodigoErro | undefined {
  if (issue.code !== 'custom') return undefined

  const codigo = issue.params?.['codigo']

  return typeof codigo === 'string' ? (codigo as CodigoErro) : undefined
}

/**
 * Segue o caminho do erro dentro da entrada crua.
 *
 * Existe para distinguir "faltou preencher" de "veio no formato errado". A via
 * óbvia seria `issue.input`, mas o Zod só popula esse campo em algumas
 * configurações: confiar nele fazia todo tipo errado ser reportado como campo
 * ausente, e a mensagem chegava errada à pessoa.
 */
function valorNoCaminho(entrada: unknown, caminho: readonly PropertyKey[]): unknown {
  let atual = entrada

  for (const passo of caminho) {
    if (atual === null || typeof atual !== 'object') return undefined
    atual = (atual as Record<PropertyKey, unknown>)[passo]
  }

  return atual
}

/**
 * O que se diz quando o campo **não veio**, ou veio com o tipo errado.
 *
 * **Esta tabela existe porque o Zod responde em inglês.** As falhas de forma —
 * campo ausente e campo de tipo errado — são detectadas antes de qualquer regra
 * nossa rodar, então nenhuma delas passa por `regra()` e nenhuma tem mensagem
 * escrita por nós. O que chegava à pessoa era a frase crua da biblioteca:
 * _"Invalid input: expected number, received undefined"_, em inglês, no resumo
 * de erros e embaixo do campo. Quem deixa a idade em branco — e isso é o caso
 * comum, não o exótico — recebia exatamente isso.
 *
 * **O código já estava certo; faltava a frase.** `paraErrosDeValidacao` sempre
 * soube distinguir "não preencheu" de "preencheu errado", e o formulário já
 * mandava a idade ausente em vez de `0` justamente para que essa distinção
 * fosse possível (o comentário em `montarEnvio` diz isso). A distinção existia
 * e morria aqui, porque a mensagem vinha de fora. É o que RNF-17 pede, e é por
 * campo, não por formulário.
 *
 * **Duas frases por campo, e não um rótulo com molde.** O molde obrigaria a
 * concordância — "o nome é obrigatório" contra "a idade é obrigatória" — e
 * concordância montada em tempo de execução é como nasce "a idade é
 * obrigatório". Escritas, elas também deixam dizer a coisa certa onde o campo
 * não é texto: faltar `cockpits` não é "preencher", é escolher.
 */
const FALTAS: Readonly<Record<string, { readonly ausente: string; readonly invalido: string }>> = {
  nome: { ausente: 'Preencha o nome.', invalido: 'Confira o nome.' },
  sobrenome: { ausente: 'Preencha o sobrenome.', invalido: 'Confira o sobrenome.' },
  email: { ausente: 'Preencha o e-mail.', invalido: 'Confira o e-mail.' },
  telefone: {
    ausente: 'Preencha o telefone com DDD.',
    invalido: 'Confira o telefone: digite só os números, com DDD.',
  },
  idade: {
    ausente: 'Preencha a idade.',
    invalido: 'Confira a idade: digite só números, em anos completos.',
  },
  cockpits: {
    ausente: `Escolha pelo menos um ${COCKPIT.singular}.`,
    invalido: `${COCKPIT.singular} inválido: as opções são 1 e 2.`,
  },
  consentimento: {
    ausente: 'É preciso aceitar o termo de consentimento para concluir a inscrição.',
    invalido: 'É preciso aceitar o termo de consentimento para concluir a inscrição.',
  },
  aceiteCompartilhamento: {
    ausente: 'Marque ou deixe em branco a autorização de repasse do telefone.',
    invalido: 'Marque ou deixe em branco a autorização de repasse do telefone.',
  },
  aceiteResponsavel: {
    ausente: 'O responsável precisa autorizar a participação para concluir a inscrição.',
    invalido: 'O responsável precisa autorizar a participação para concluir a inscrição.',
  },
  responsavel: {
    ausente:
      'Participante com menos de 18 anos precisa de nome, sobrenome e telefone do responsável.',
    invalido:
      'Participante com menos de 18 anos precisa de nome, sobrenome e telefone do responsável.',
  },
  'responsavel.nome': {
    ausente: 'Preencha o nome do responsável.',
    invalido: 'Confira o nome do responsável.',
  },
  'responsavel.sobrenome': {
    ausente: 'Preencha o sobrenome do responsável.',
    invalido: 'Confira o sobrenome do responsável.',
  },
  'responsavel.telefone': {
    ausente: 'Preencha o telefone do responsável, com DDD.',
    invalido: 'Confira o telefone do responsável: digite só os números, com DDD.',
  },
}

/**
 * A saída para o campo que ninguém previu.
 *
 * Um campo fora da tabela chega por duas vias, e as duas são de quem não está
 * preenchendo o formulário: o `token` do carimbo de hora, que a tela emite
 * sozinha, e qualquer corpo montado à mão contra a API. Dizer qual campo é
 * ajuda quem depura e não assusta quem não vai ver isto — mas em português,
 * que é a única coisa que esta constante garante.
 */
function generica(campo: string, ausente: boolean): string {
  return ausente
    ? `Falta o campo "${campo}" no envio.`
    : `O campo "${campo}" veio num formato que não dá para aceitar.`
}

/**
 * Converte o erro do Zod na lista estruturada.
 *
 * Quase toda regra do esquema declara o próprio código. O que sobra para o
 * fallback são as falhas de forma, que o Zod detecta antes de qualquer regra
 * nossa rodar: campo ausente e campo de tipo errado. **A mensagem dessas duas
 * é trocada aqui**, porque a que vem da biblioteca está em inglês (`FALTAS`).
 *
 * @param entrada a entrada crua, usada só para saber se o campo veio vazio.
 */
export function paraErrosDeValidacao(
  erro: ZodError,
  entrada?: unknown,
): readonly ErroDeValidacao[] {
  return erro.issues.map((issue) => {
    const campo = issue.path.join('.') || '(raiz)'
    const declarado = codigoDeclarado(issue)

    if (declarado !== undefined) return { campo, codigo: declarado, mensagem: issue.message }

    const ausente =
      issue.code === 'invalid_type' && valorNoCaminho(entrada, issue.path) === undefined

    return {
      campo,
      codigo: ausente ? 'campo_obrigatorio' : 'tipo_invalido',
      mensagem: ausente
        ? (FALTAS[campo]?.ausente ?? generica(campo, true))
        : (FALTAS[campo]?.invalido ?? generica(campo, false)),
    }
  })
}
