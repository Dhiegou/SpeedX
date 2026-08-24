import next from 'eslint-config-next/core-web-vitals'

/**
 * Fronteiras entre bounded contexts, impostas por lint.
 *
 * O SDD §1 estabelece que as fronteiras entre contextos SÃO a barreira de
 * privacidade. Isso só é verdade se houver algo impedindo o import errado —
 * caso contrário é convenção, e convenção não sobrevive a um dia de pressa.
 *
 * Mapa de dependências permitidas (SDD §2):
 *   Identidade  --Open Host-->            Cronometragem, Custódia
 *   Inscrição   --Customer/Supplier-->    Cronometragem  (somente via `contrato`)
 *   Inscrição, Cronometragem ---------->  Custódia
 *   Cronometragem --Published Language--> Classificação (por evento, não por import)
 *
 * Classificação não importa ninguém: seu modelo de leitura é construído a
 * partir do banco na própria projeção, e é justamente por não conhecer
 * e-mail, telefone e idade que RNF-08 e RNF-09 deixam de depender de disciplina.
 *
 * Nota de implementação: `patterns` usa sintaxe estilo gitignore, onde excluir
 * um diretório impede re-incluir qualquer coisa dentro dele. Por isso a fachada
 * (`@/contexts/x`) é bloqueada por `paths`, exato, e os subcaminhos por
 * `patterns` — só assim a exceção do `contrato` continua expressável.
 */

/** Subcaminhos do contexto, cobrindo alias e import relativo. */
function padroes(contexto) {
  return [
    `@/contexts/${contexto}/**`,
    `**/contexts/${contexto}/**`,
    `../${contexto}/**`,
    `../../contexts/${contexto}/**`,
  ]
}

/** A fachada do contexto — o `index.ts`, importado sem subcaminho. */
function fachadas(contexto) {
  return [`@/contexts/${contexto}`, `../${contexto}`, `../../contexts/${contexto}`]
}

function proibirContextos(contextos, mensagem, excecoes = []) {
  return {
    'no-restricted-imports': [
      'error',
      {
        paths: contextos.flatMap(fachadas).map((name) => ({ name, message: mensagem })),
        patterns: [
          {
            group: [...contextos.flatMap(padroes), ...excecoes],
            message: mensagem,
          },
        ],
      },
    ],
  }
}

const MSG_BANCO =
  'Acesso ao banco só a partir da camada de dados de um contexto. Nunca de rota, componente ou módulo compartilhado.'

const proibirBanco = {
  'no-restricted-imports': [
    'error',
    {
      paths: [{ name: '@/db', message: MSG_BANCO }],
      // `infra/` fala com o banco por definição, e por isso entra aqui junto:
      // uma rota que o importe estaria contornando o caso de uso do contexto
      // pelo caminho de baixo. Não precisa de entrada em `paths` porque não
      // existe fachada `@/infra` — só subcaminhos, que o padrão já cobre.
      patterns: [
        { group: ['@/db/**', '**/src/db/**', '@/infra/**', '**/src/infra/**'], message: MSG_BANCO },
      ],
    },
  ],
}

const MSG_INFRA =
  '`infra/` é a camada abaixo dos contextos: conhece o banco, não conhece regra de negócio. Se precisa de um contexto, não é infra.'

const MSG_CLASSIFICACAO =
  'Classificação opera sobre Nome Público e não conhece dado pessoal. Outros contextos são proibidos, e o banco só em `projecao.ts` (RNF-08, RNF-09).'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**'],
  },

  ...next,

  // BC-01 Inscrição — não conhece nenhum outro contexto.
  {
    files: ['src/contexts/inscricao/**/*.{ts,tsx}'],
    rules: proibirContextos(
      ['cronometragem', 'classificacao', 'identidade', 'custodia'],
      'Inscrição é upstream: publica eventos e contrato, não importa outros contextos (SDD §2).',
    ),
  },

  // BC-02 Cronometragem — usa Identidade (Open Host) e alcança Inscrição só pelo contrato.
  {
    files: ['src/contexts/cronometragem/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...fachadas('classificacao'),
            ...fachadas('custodia'),
            ...fachadas('inscricao'),
          ].map((name) => ({
            name,
            message:
              'Cronometragem só alcança Inscrição por `@/contexts/inscricao/contrato`; Classificação e Custódia são downstream (SDD §2).',
          })),
          patterns: [
            {
              group: [
                ...padroes('classificacao'),
                ...padroes('custodia'),
                ...padroes('inscricao'),
                '!@/contexts/inscricao/contrato',
                '!**/contexts/inscricao/contrato',
                '!../inscricao/contrato',
              ],
              message:
                'Cronometragem só alcança Inscrição por `@/contexts/inscricao/contrato`; Classificação e Custódia são downstream (SDD §2).',
            },
          ],
        },
      ],
    },
  },

  // BC-03 Classificação — isolada de todo mundo, inclusive do banco.
  {
    files: ['src/contexts/classificacao/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...['inscricao', 'cronometragem', 'identidade', 'custodia'].flatMap(fachadas),
            '@/db',
          ].map((name) => ({ name, message: MSG_CLASSIFICACAO })),
          patterns: [
            {
              group: [
                ...['inscricao', 'cronometragem', 'identidade', 'custodia'].flatMap(padroes),
                '@/db/**',
                '**/src/db/**',
              ],
              message: MSG_CLASSIFICACAO,
            },
          ],
        },
      ],
    },
  },

  // Exceção única: a projeção é a fronteira onde o dado é traduzido, uma vez só.
  // Continua proibida de importar outros contextos — apenas o banco lhe é liberado.
  {
    files: ['src/contexts/classificacao/projecao.ts'],
    rules: proibirContextos(
      ['inscricao', 'cronometragem', 'identidade', 'custodia'],
      'Nem a projeção importa outros contextos: ela lê o banco e traduz na fronteira.',
    ),
  },

  // BC-04 Identidade — genérico e substituível, não conhece o domínio de corrida.
  {
    files: ['src/contexts/identidade/**/*.{ts,tsx}'],
    rules: proibirContextos(
      ['inscricao', 'cronometragem', 'classificacao', 'custodia'],
      'Identidade não contém regra do domínio de corrida (SDD BC-04).',
    ),
  },

  // BC-05 Custódia — único autorizado a cruzar dado pessoal com resultado.
  {
    files: ['src/contexts/custodia/**/*.{ts,tsx}'],
    rules: proibirContextos(
      ['classificacao'],
      'Custódia exporta dado completo; Classificação é a superfície pública. Não se misturam.',
    ),
  },

  // `shared/` é folha: primitivos, formatação, erros. Não conhece contexto nem banco.
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: proibirContextos(
      ['inscricao', 'cronometragem', 'classificacao', 'identidade', 'custodia'],
      '`shared/` é folha da árvore de dependências: se precisa de um contexto, não é shared.',
      ['@/db', '@/db/**', '**/src/db/**', '@/infra/**', '**/src/infra/**'],
    ),
  },

  // `infra/` — mecanismo comum que alcança o banco. Nasceu em T08, quando o
  // limite de taxa passou a servir Inscrição e Identidade ao mesmo tempo e
  // nenhum dos dois podia importar o outro (SDD §2).
  {
    files: ['src/infra/**/*.{ts,tsx}'],
    rules: proibirContextos(
      ['inscricao', 'cronometragem', 'classificacao', 'identidade', 'custodia'],
      MSG_INFRA,
    ),
  },

  // Rotas e componentes chamam casos de uso, nunca o banco direto (restrição 3 do anexo).
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: proibirBanco,
  },

  // Exceção única, do mesmo feitio da de `classificacao/projecao.ts`: o health
  // check pergunta se **este processo** alcança o banco. A regra acima existe
  // para impedir que uma rota contorne o caso de uso de um contexto pelo
  // caminho de baixo, e aqui não há caso de uso a contornar — não existe regra
  // de negócio chamada "o banco está de pé". Um caso de uso inventado só para
  // atravessar a sondagem seria uma camada que não decide nada.
  //
  // A exceção tem exatamente um arquivo de largura, e `tests/fronteiras.test.ts`
  // falha se ela crescer.
  {
    files: ['app/api/saude/route.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
]

export default config
