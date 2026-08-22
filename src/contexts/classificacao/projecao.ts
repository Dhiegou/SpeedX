import { asc, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { compactar, etiquetaDe, type DocumentoTransmitido } from './documento'
import type { DocumentoClassificacao, LinhaClassificacao, Pitch } from './modelo'
import { deveAbreviarSobrenome, paraNomePublico } from './nomePublico'

/**
 * Projeção da Classificação — a fronteira onde o dado transacional vira modelo
 * público (T12).
 *
 * É o **único** arquivo de Classificação autorizado a alcançar o banco: o lint
 * bloqueia `@/db/**` em todo o resto do contexto, e `tests/fronteiras.test.ts`
 * falha se essa regra deixar de valer. A tradução acontece num lugar nomeado,
 * não espalhada por consultas ad hoc.
 *
 * **A privacidade aqui é estrutural, não disciplinar.** Três camadas, cada uma
 * suficiente sozinha e nenhuma dependendo de alguém lembrar:
 *
 *  1. o `select` nomeia as colunas que traz — e-mail, telefone e dados de
 *     Responsável não são lidos, e o que não é lido não pode vazar (RNF-08);
 *  2. a **idade é lida e morre nesta função**: serve só para decidir o formato
 *     do nome, e não existe campo para ela no modelo de saída;
 *  3. o sobrenome completo entra em `paraNomePublico` e sai transformado — é o
 *     único ponto do caminho público que o toca (RNF-09).
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Constrói o documento inteiro.
 *
 * Uma consulta só, ordenada pelo banco. A alternativa — ler e ordenar em
 * memória — daria o mesmo resultado com 4000 linhas, e daria um resultado
 * diferente do índice `tentativa_classificacao_idx` que T02 criou justamente
 * para esta leitura.
 *
 * `geradoEm` vem do relógio do servidor, como todo instante deste sistema.
 */
export async function projetarClassificacao(
  db: Db,
  agora: Date = new Date(),
): Promise<DocumentoClassificacao> {
  const linhas = await db
    .select({
      id: schema.tentativa.id,
      pitch: schema.tentativa.pitch,
      tempoMs: schema.tentativa.tempoMs,
      resolvidoEm: schema.tentativa.resolvidoEm,
      nome: schema.participante.nome,
      sobrenome: schema.participante.sobrenome,
      // Lida para decidir o formato do nome, e só. Não há campo para ela no
      // modelo de saída — ver o cabeçalho deste arquivo.
      idade: schema.participante.idade,
    })
    .from(schema.tentativa)
    .innerJoin(schema.participante, eq(schema.participante.id, schema.tentativa.participanteId))
    // Ausentes e Pendentes nunca entram (RF-21). A constraint de T02 garante
    // que `valida` implica `tempo_ms` preenchido, então o `!` abaixo é uma
    // consequência do esquema, não uma suposição.
    .where(eq(schema.tentativa.estado, 'valida'))
    .orderBy(
      asc(schema.tentativa.tempoMs),
      // RF-31: empate resolve pelo Lançamento mais antigo.
      asc(schema.tentativa.resolvidoEm),
      // Terceiro critério, para que a ordem seja total. Sem ele, duas
      // Tentativas com o mesmo tempo e o mesmo instante poderiam trocar de
      // lugar entre duas leituras — e a página pública mudaria de ordem sem
      // que nada tivesse mudado.
      asc(schema.tentativa.id),
    )

  return {
    geradoEm: agora.toISOString(),
    linhas: linhas.map((l): LinhaClassificacao => ({
      id: l.id,
      nomePublico: paraNomePublico(l.nome, l.sobrenome, {
        abreviarSobrenome: deveAbreviarSobrenome(l.idade),
      }),
      pitch: (l.pitch === 2 ? 2 : 1) satisfies Pitch,
      tempoMs: l.tempoMs ?? 0,
      registradoEm: (l.resolvidoEm ?? agora).toISOString(),
    })),
  }
}

/**
 * O documento pronto para a rede, a partir da conexão real.
 *
 * **Este contexto não tem `servico.ts`, e é de propósito.** Os outros três têm
 * um arquivo de composição separado porque seus casos de uso não tocam o banco.
 * Aqui a regra é mais apertada: o lint autoriza `@/db` em `projecao.ts` e em
 * mais nenhum arquivo de Classificação, e um `servico.ts` exigiria abrir uma
 * segunda exceção — enfraquecendo exatamente a invariante que
 * `tests/fronteiras.test.ts` guarda. A composição mora aqui dentro, e a
 * exceção continua sendo de um arquivo só.
 *
 * A rota chama isto; `projetarClassificacao` continua recebendo o banco por
 * parâmetro, que é o que permite testá-la contra Postgres de verdade.
 */
export async function documentoDaClassificacao(): Promise<{
  documento: DocumentoTransmitido
  etiqueta: string
}> {
  const documento = compactar(await projetarClassificacao(db()))

  return { documento, etiqueta: etiquetaDe(documento) }
}
