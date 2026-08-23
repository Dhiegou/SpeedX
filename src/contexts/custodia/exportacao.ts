import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { IDADE_MAIORIDADE } from '@/contexts/inscricao/idades'
import * as schema from '@/db/schema'
import { formatTempo } from '@/shared/tempo'
import { BOM, linha, nomeDoArquivo } from './csv'
import {
  lerExportacaoCompleta,
  lerListaDeRepasse,
  lerPendencias,
  type LinhaDaExportacao,
} from './consultas'

/**
 * Os três documentos que a Custódia produz (T14 — RF-34, RF-35, RNF-10).
 *
 * | documento | para quê | quem pode ver |
 * |---|---|---|
 * | `completa` | prestação de contas do organizador | Operador autenticado |
 * | `repasse` | a lista que vai para a FIAP e a escolinha | Operador autenticado |
 * | `pendencias` | a métrica primária do PRD §7, durante o evento | Operador autenticado |
 *
 * **São três saídas separadas, e isso é a regra e não a organização.** A lista
 * de repasse podia ser uma coluna da exportação completa, filtrada na planilha
 * do outro lado — e aí o telefone de quem **recusou** o repasse já teria saído
 * daqui. O termo promete que o telefone só vai para quem autorizou (D-23); a
 * promessa só se cumpre se o filtro estiver na consulta.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Fechado: a rota traduz cada um, e um tipo novo sem tradução não compila. */
export type TipoDeExportacao = 'completa' | 'repasse' | 'pendencias'

export const TIPOS: readonly TipoDeExportacao[] = ['completa', 'repasse', 'pendencias']

export function ehTipoValido(valor: unknown): valor is TipoDeExportacao {
  return typeof valor === 'string' && (TIPOS as readonly string[]).includes(valor)
}

const CABECALHO_COMPLETO = [
  'participante_id',
  'nome',
  'sobrenome',
  'email',
  'telefone',
  'idade',
  'menor_de_idade',
  'responsavel_nome',
  'responsavel_sobrenome',
  'responsavel_telefone',
  'consentimento_versao',
  'consentimento_registrado_em',
  'aceite_compartilhamento',
  'inscrito_em',
  'pitch',
  'estado',
  'tempo',
  'tempo_ms',
  'resolvido_em',
  'operador',
  'qtd_correcoes',
] as const

const iso = (d: Date | null): string => d?.toISOString() ?? ''
const sn = (b: boolean | null): string => (b === null ? '' : b ? 'sim' : 'nao')

function linhaCompleta(l: LinhaDaExportacao): string {
  return linha([
    l.participanteId,
    l.nome,
    l.sobrenome,
    l.email,
    l.telefone,
    l.idade,
    // Derivado, não lido: a idade é o dado, a menoridade é a leitura dela. O
    // organizador precisa das duas — uma para conferir, outra para agrupar.
    sn(l.idade < IDADE_MAIORIDADE),
    l.responsavelNome,
    l.responsavelSobrenome,
    l.responsavelTelefone,
    l.consentimentoVersao,
    iso(l.consentimentoRegistradoEm),
    sn(l.aceiteCompartilhamento),
    iso(l.inscritoEm),
    l.pitch,
    l.estado,
    // Formatado e bruto: um para ler, outro para reprocessar sem ambiguidade.
    l.tempoMs === null ? '' : formatTempo(l.tempoMs),
    l.tempoMs,
    iso(l.resolvidoEm),
    l.operador,
    l.qtdCorrecoes,
  ])
}

/**
 * A exportação completa, em fluxo.
 *
 * Cada lote lido do banco vira texto e sai imediatamente; nada acumula. É o
 * único ponto do sistema que carrega a base inteira, e ele roda no fim do
 * evento, quando o servidor já passou dez horas trabalhando.
 *
 * **Inclui Ausentes e Pendentes** (RF-21): a exportação é a base completa, não
 * a classificação. Quem não compareceu continua nos dados exportados — foi essa
 * a promessa feita a quem se inscreveu.
 */
export function fluxoDaExportacaoCompleta(db: Db): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder()
  const linhas = lerExportacaoCompleta(db)

  return new ReadableStream<Uint8Array>({
    start(controlador) {
      controlador.enqueue(codificador.encode(BOM + linha([...CABECALHO_COMPLETO])))
    },
    async pull(controlador) {
      const proxima = await linhas.next()

      if (proxima.done === true) {
        controlador.close()
        return
      }

      controlador.enqueue(codificador.encode(linhaCompleta(proxima.value)))
    },
    async cancel() {
      // A pessoa fechou a aba no meio do download. Encerrar o gerador libera a
      // conexão do banco em vez de deixá-la presa até o fim de um arquivo que
      // ninguém vai receber.
      await linhas.return(undefined)
    },
  })
}

/** A lista de repasse — só quem autorizou, e só nome e telefone (D-23). */
export async function gerarListaDeRepasse(db: Db): Promise<string> {
  const linhas = await lerListaDeRepasse(db)

  return (
    BOM +
    linha(['nome', 'sobrenome', 'telefone']) +
    linhas.map((l) => linha([l.nome, l.sobrenome, l.telefone])).join('')
  )
}

/** O relatório de pendências — a métrica cuja meta é zero (PRD §7). */
export async function gerarPendencias(db: Db): Promise<string> {
  const linhas = await lerPendencias(db)

  return (
    BOM +
    linha(['tentativa_id', 'nome', 'sobrenome', 'ultimos4_telefone', 'pitch', 'inscrito_em']) +
    linhas
      .map((l) =>
        linha([
          l.tentativaId,
          l.nome,
          l.sobrenome,
          l.ultimos4Telefone,
          l.pitch,
          l.inscritoEm.toISOString(),
        ]),
      )
      .join('')
  )
}

/** O nome que o navegador vai dar ao arquivo salvo. */
export function nomeDe(tipo: TipoDeExportacao, agora?: Date): string {
  const prefixo = {
    completa: 'speedx-exportacao',
    repasse: 'speedx-repasse-autorizado',
    pendencias: 'speedx-pendencias',
  }[tipo]

  return nomeDoArquivo(prefixo, agora)
}
