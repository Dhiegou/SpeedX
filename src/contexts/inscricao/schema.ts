import { z } from 'zod'
import { COCKPIT } from '@/shared/vocabulario'
import type { Cockpit } from './contrato'
import type { CodigoErro } from './erros'
import { IDADE_MAIORIDADE, IDADE_MAXIMA, IDADE_MINIMA } from './idades'

/**
 * Validação da Inscrição (RF-02 a RF-08, RNF-13, RNF-17).
 *
 * Este é o esquema que vale. O formulário de T06 usa o mesmo módulo, mas isso é
 * conveniência: o servidor revalida sempre, porque a validação de interface não
 * sobrevive a uma requisição forjada (restrição 2 do anexo do PRD, RNF-13).
 *
 * A idade não é um campo entre outros. Ela decide **qual objeto existe**: um
 * Participante de 17 anos e um de 18 têm invariantes diferentes (SDD BC-01).
 * Por isso a saída é uma união discriminada, e não um objeto com campos de
 * responsável opcionais pendurados. Com campos opcionais, "menor sem
 * responsável" seria representável, e alguém precisaria lembrar de conferir a
 * cada uso; com a união, não existe valor do tipo `menor` sem Responsável.
 */

/**
 * As idades moram em `idades.ts`, sem dependência nenhuma, para que a
 * interface possa lê-las sem carregar o Zod junto (RNF-04). Reexportadas aqui
 * porque este continua sendo o lugar onde se procura por elas.
 */
export { IDADE_MAIORIDADE, IDADE_MAXIMA, IDADE_MINIMA } from './idades'

/**
 * Nome de pessoa: letras com acento, espaço, hífen e apóstrofo.
 *
 * Dígitos e pontuação ficam de fora porque o campo alimenta a página pública e
 * a busca do painel. Apóstrofo e hífen entram porque "D'Ávila" e "Silva-Costa"
 * são nomes comuns, e recusá-los mandaria a pessoa mentir o próprio nome.
 */
const NOME = /^[\p{L}][\p{L}\s'-]*$/u

/** Declara uma regra de domínio com código próprio, do jeito que RNF-17 exige. */
function regra(codigo: CodigoErro, mensagem: string) {
  return { error: mensagem, params: { codigo } }
}

const nome = (campo: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => v.length >= 2 && v.length <= 60,
      regra('nome_tamanho', `${campo} deve ter de 2 a 60 caracteres.`),
    )
    .refine(
      (v) => NOME.test(v),
      regra('nome_formato', `${campo} aceita apenas letras, espaço, hífen e apóstrofo.`),
    )

const email = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v.length <= 254, regra('email_tamanho', 'E-mail longo demais (máximo 254).'))
  .refine(
    (v) => z.email().safeParse(v).success,
    regra('email_formato', 'E-mail inválido. Confira se tem "@" e o domínio.'),
  )

/**
 * Telefone.
 *
 * A máscara é removida antes de validar: a pessoa digita "(11) 98765-4321" e o
 * banco guarda `11987654321`, que é o formato que a constraint exige e o que a
 * derivação dos quatro últimos dígitos do painel espera (RF-15).
 */
const telefone = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(
    (v) => /^\d{10,11}$/.test(v),
    regra('telefone_formato', 'Telefone deve ter DDD e 8 ou 9 dígitos. Exemplo: (11) 98765-4321.'),
  )

const idade = z
  .number()
  .refine(
    (v) => Number.isInteger(v),
    regra('idade_nao_inteira', 'Idade deve ser um número inteiro.'),
  )
  .refine(
    (v) => v >= IDADE_MINIMA,
    regra(
      'idade_minima',
      `A participação é permitida a partir de ${String(IDADE_MINIMA)} anos. Quem tem menos não pode se inscrever.`,
    ),
  )
  .refine(
    (v) => v <= IDADE_MAXIMA,
    regra('idade_maxima', `Idade acima de ${String(IDADE_MAXIMA)} anos: confira o valor digitado.`),
  )

/** Cockpits declarados (RF-03). Ao menos um, sem repetição, dentro de [1, 2]. */
const cockpits = z
  .array(z.number())
  .refine(
    (v) => v.length > 0,
    regra('cockpit_ausente', `Escolha pelo menos um ${COCKPIT.singular}.`),
  )
  .refine(
    (v) => v.every((p) => p === 1 || p === 2),
    regra('cockpit_invalido', `${COCKPIT.singular} inválido: as opções são 1 e 2.`),
  )
  .refine(
    (v) => new Set(v).size === v.length,
    regra('cockpit_repetido', `Cada ${COCKPIT.singular} pode ser escolhido uma vez só.`),
  )
  .transform((v) => v as Cockpit[])

const consentimento = z
  .boolean()
  .refine(
    (v) => v,
    regra(
      'consentimento_recusado',
      'É preciso aceitar o termo de consentimento para concluir a inscrição.',
    ),
  )

const dadosDoResponsavel = z.object({
  nome: nome('O nome do responsável'),
  sobrenome: nome('O sobrenome do responsável'),
  telefone,
})

/**
 * Entrada crua, antes de a idade decidir o ramo.
 *
 * Campos de Responsável entram como opcionais porque o cliente pode legitimamente
 * enviá-los e depois corrigir a idade para 18 (RF-07). O descarte acontece na
 * transformação abaixo.
 */
const entrada = z.object({
  nome: nome('O nome'),
  sobrenome: nome('O sobrenome'),
  email,
  telefone,
  idade,
  cockpits,
  consentimento,
  /** Repasse à FIAP e à escolinha: opcional (D-23). Ausente significa recusa. */
  aceiteCompartilhamento: z.boolean().default(false),
  responsavel: dadosDoResponsavel.optional(),
  aceiteResponsavel: z.boolean().optional(),
})

export type Responsavel = z.infer<typeof dadosDoResponsavel>

type Comuns = {
  readonly nome: string
  readonly sobrenome: string
  readonly email: string
  readonly telefone: string
  readonly idade: number
  readonly cockpits: readonly Cockpit[]
  readonly aceiteCompartilhamento: boolean
}

/**
 * Inscrição válida.
 *
 * Note o que **não** está aqui: `consentimento` e `aceiteResponsavel`. Os dois
 * foram validados como verdadeiros para o valor existir, então carregá-los
 * adiante só criaria a possibilidade de alguém gravar `false`. O ramo `menor`
 * já significa "responsável presente e consentimento dele registrado".
 */
export type Inscricao =
  | ({ readonly tipo: 'adulto' } & Comuns)
  | ({ readonly tipo: 'menor'; readonly responsavel: Responsavel } & Comuns)

function comuns(valor: z.infer<typeof entrada>): Comuns {
  return {
    nome: valor.nome,
    sobrenome: valor.sobrenome,
    email: valor.email,
    telefone: valor.telefone,
    idade: valor.idade,
    cockpits: valor.cockpits,
    aceiteCompartilhamento: valor.aceiteCompartilhamento,
  }
}

/**
 * Esquema completo: valida, decide o ramo pela idade e devolve a união.
 *
 * O ramo vem **da idade**, nunca de um campo `tipo` enviado pelo cliente. Um
 * discriminador que chega pela rede é um discriminador que o cliente escolhe, e
 * a regra que separa menor de adulto é a mais sensível do sistema (RNF-07).
 */
export const esquemaInscricao = entrada
  .superRefine((valor, ctx) => {
    // Fora da faixa que produz Participante, as exigências de Responsável não
    // se aplicam. Sem esta linha, quem digita 12 anos recebe "precisa de
    // responsável" junto com "idade mínima é 13", e a segunda mensagem sugere
    // que preencher o responsável resolveria. Não resolve: RF-04 é absoluto.
    if (valor.idade < IDADE_MINIMA || valor.idade >= IDADE_MAIORIDADE) return

    if (valor.responsavel === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['responsavel'],
        message:
          'Participante com menos de 18 anos precisa de nome, sobrenome e telefone do responsável.',
        params: { codigo: 'responsavel_ausente' satisfies CodigoErro },
      })
    }

    if (valor.aceiteResponsavel !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['aceiteResponsavel'],
        message: 'O responsável precisa autorizar a participação para concluir a inscrição.',
        params: { codigo: 'aceite_responsavel_ausente' satisfies CodigoErro },
      })
    }
  })
  .transform((valor): Inscricao => {
    // Maior de idade: o bloco de responsável é descartado aqui, e some porque o
    // tipo `adulto` não tem onde guardá-lo (RF-07). Não é um `delete`
    // defensivo, é a ausência do campo na forma de saída.
    if (valor.idade >= IDADE_MAIORIDADE) {
      return { tipo: 'adulto', ...comuns(valor) }
    }

    // `superRefine` já garantiu a presença; a asserção existe porque o Zod não
    // consegue estreitar o tipo a partir de uma checagem condicional.
    return { tipo: 'menor', responsavel: valor.responsavel as Responsavel, ...comuns(valor) }
  })

export type EntradaInscricao = z.input<typeof esquemaInscricao>
