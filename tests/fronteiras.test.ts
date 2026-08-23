import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * A regra de fronteira é a barreira de privacidade do sistema (SDD §1).
 * Se ela silenciosamente parar de valer, nada quebra — até um sobrenome
 * completo aparecer em tela pública no dia do evento.
 *
 * Este teste existe porque isso já aconteceu uma vez durante T01: os padrões
 * de `no-restricted-imports` usam sintaxe estilo gitignore, e
 * `@/contexts/x/**` sozinho não barra `@/contexts/x`. O import de fachada
 * passava limpo. Nenhuma revisão de código pegaria isso a olho nu.
 */

const eslint = new ESLint({ cwd: process.cwd() })

async function erros(codigo: string, arquivo: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: arquivo })
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message)
}

// A primeira chamada resolve a configuração do ESLint e custa segundos; as
// seguintes reaproveitam. Sem isso, o custo cai sobre o primeiro caso de teste
// e o faz estourar o tempo limite quando a suíte roda em paralelo.
beforeAll(async () => {
  await erros('export {}', 'src/shared/aquecimento.ts')
})

describe('fronteiras entre bounded contexts', () => {
  it('Classificação não importa Inscrição — nem pela fachada, nem pelo contrato', async () => {
    const arquivo = 'src/contexts/classificacao/teste.ts'

    expect(await erros(`import '@/contexts/inscricao'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '@/contexts/inscricao/contrato'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '../inscricao'`, arquivo)).toHaveLength(1)
  })

  it('Classificação não alcança o banco fora da projeção', async () => {
    expect(await erros(`import '@/db'`, 'src/contexts/classificacao/teste.ts')).toHaveLength(1)
    expect(await erros(`import '@/db/schema'`, 'src/contexts/classificacao/teste.ts')).toHaveLength(
      1,
    )
  })

  it('a projeção pode ler o banco — é a fronteira onde a tradução acontece', async () => {
    expect(await erros(`import '@/db'`, 'src/contexts/classificacao/projecao.ts')).toHaveLength(0)
  })

  it('Cronometragem alcança Inscrição apenas pelo contrato publicado', async () => {
    const arquivo = 'src/contexts/cronometragem/teste.ts'

    expect(await erros(`import '@/contexts/inscricao/contrato'`, arquivo)).toHaveLength(0)
    expect(await erros(`import '@/contexts/inscricao'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '@/contexts/inscricao/repositorio'`, arquivo)).toHaveLength(1)
  })

  it('Cronometragem usa a infraestrutura comum, não a de Inscrição', async () => {
    const arquivo = 'src/contexts/cronometragem/teste.ts'

    // O limite de taxa (T08) e a idempotência (T09) saíram de dentro de
    // Inscrição justamente porque Cronometragem precisa dos dois e não pode
    // importar aquele contexto. Se o caminho de baixo fechar, a alternativa
    // vira duplicar o mecanismo — que é como duas idempotências divergem.
    expect(await erros(`import '@/infra/idempotencia'`, arquivo)).toHaveLength(0)
    expect(await erros(`import '@/db/schema'`, arquivo)).toHaveLength(0)
  })

  it('Cronometragem não conhece Classificação nem Custódia', async () => {
    const arquivo = 'src/contexts/cronometragem/teste.ts'

    expect(await erros(`import '@/contexts/classificacao'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '@/contexts/custodia'`, arquivo)).toHaveLength(1)
  })

  it('Cronometragem usa Identidade — Open Host, permitido pelo SDD §2', async () => {
    expect(
      await erros(`import '@/contexts/identidade'`, 'src/contexts/cronometragem/teste.ts'),
    ).toHaveLength(0)
  })

  it('Custódia é a única que cruza dado pessoal com resultado', async () => {
    const arquivo = 'src/contexts/custodia/teste.ts'

    expect(await erros(`import '@/contexts/inscricao/contrato'`, arquivo)).toHaveLength(0)
    expect(await erros(`import '@/contexts/cronometragem'`, arquivo)).toHaveLength(0)
    expect(await erros(`import '@/contexts/classificacao'`, arquivo)).toHaveLength(1)
  })

  it('a Exportação alcança os dois lados — é a autorização de BC-05', async () => {
    // A exportação de T14 é o único documento do sistema que reúne telefone e
    // dado de Responsável com resultado de corrida. Essa autorização precisa
    // ser um lugar nomeado, e este teste é o que a mantém nomeada: se ela
    // aparecer em outro contexto, o lint recusa lá e não recusa aqui.
    const arquivo = 'src/contexts/custodia/exportacao.ts'

    expect(await erros(`import '@/contexts/inscricao/idades'`, arquivo)).toHaveLength(0)
    expect(await erros(`import '@/db/schema'`, arquivo)).toHaveLength(0)
  })

  it('ninguém fora de Custódia consegue montar o mesmo cruzamento', async () => {
    // Não é uma regra escrita para Custódia: é consequência das outras. Nenhum
    // outro contexto alcança os dois lados, então o documento completo só pode
    // nascer ali.
    expect(
      await erros(`import '@/contexts/inscricao/idades'`, 'src/contexts/cronometragem/teste.ts'),
    ).toHaveLength(1)
    expect(
      await erros(`import '@/contexts/cronometragem'`, 'src/contexts/inscricao/teste.ts'),
    ).toHaveLength(1)
  })

  it('Inscrição é upstream: não importa ninguém', async () => {
    const arquivo = 'src/contexts/inscricao/teste.ts'

    expect(await erros(`import '@/contexts/cronometragem'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '@/contexts/custodia'`, arquivo)).toHaveLength(1)
  })

  it('`shared/` é folha da árvore de dependências', async () => {
    expect(await erros(`import '@/contexts/inscricao'`, 'src/shared/teste.ts')).toHaveLength(1)
    // Folha também quer dizer "não alcança o banco", nem direto nem pela
    // camada de infraestrutura que fala com ele.
    expect(await erros(`import '@/db'`, 'src/shared/teste.ts')).toHaveLength(1)
    expect(await erros(`import '@/infra/limiteDeTaxa'`, 'src/shared/teste.ts')).toHaveLength(1)
  })

  it('`infra/` fica abaixo dos contextos e não conhece nenhum deles', async () => {
    // O limite de taxa desceu para cá em T08, quando passou a servir Inscrição
    // e Identidade ao mesmo tempo. Se ele voltar a importar um contexto, deixa
    // de ser mecanismo comum e vira uma porta lateral entre os dois.
    const arquivo = 'src/infra/teste.ts'

    expect(await erros(`import '@/contexts/inscricao'`, arquivo)).toHaveLength(1)
    expect(await erros(`import '@/contexts/identidade'`, arquivo)).toHaveLength(1)
    // O banco, sim: é a razão de `infra/` existir em vez de `shared/`.
    expect(await erros(`import '@/db/schema'`, arquivo)).toHaveLength(0)
  })

  it('rotas não contornam o caso de uso pela camada de infraestrutura', async () => {
    expect(await erros(`import '@/infra/limiteDeTaxa'`, 'app/api/teste.ts')).toHaveLength(1)
  })

  it('rotas chamam casos de uso, nunca o banco (restrição 3 do anexo)', async () => {
    expect(await erros(`import '@/db'`, 'app/teste.ts')).toHaveLength(1)
    expect(await erros(`import '@/db/schema'`, 'app/api/teste.ts')).toHaveLength(1)
  })
})
