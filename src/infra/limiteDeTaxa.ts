import { createHmac } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { env } from '@/shared/env'
import * as schema from '@/db/schema'

/**
 * Limite de taxa por janela deslizante — infraestrutura, não domínio.
 *
 * Nasceu dentro de Inscrição em T05, com um bilhete: "no dia em que houver o
 * segundo uso, este arquivo sai daqui para um lugar comum". T08 é esse dia — o
 * login do Operador precisa do mesmo mecanismo, e Identidade não pode importar
 * Inscrição (o lint recusa, e o SDD §2 é o motivo).
 *
 * Não foi para `shared/`: `shared/` é folha da árvore de dependências e não
 * alcança o banco. `infra/` é a camada abaixo dos contextos — conhece o banco,
 * não conhece regra de negócio nenhuma.
 *
 * **O que mudou na mudança de casa:** a política deixou de ser lida aqui de
 * dentro. Antes, `verificarLimite` consultava as faixas de cadastro no ambiente
 * e obedecia ao desligamento de emergência `RATE_LIMIT_ATIVO`. Isso não pode
 * valer para o login: a alavanca existe para destravar a fila de inscrição no
 * dia do evento (D-27), e desligar junto o limite de tentativas de senha
 * transformaria uma decisão operacional em porta aberta para força bruta.
 * Agora quem passa a política é o contexto que a define.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Uma faixa de contenção: quantas ocorrências cabem em quanto tempo. */
export type Faixa = { readonly limite: number; readonly janelaMs: number }

/**
 * Política de um escopo.
 *
 * `faixas` vazio significa "sem limite" — é assim que o desligamento de
 * emergência do cadastro se expressa, sem que este módulo precise saber que ele
 * existe.
 */
export type Politica = { readonly escopo: string; readonly faixas: readonly Faixa[] }

export type VereditoLimite =
  { readonly permitido: true } | { readonly permitido: false; readonly esperarSegundos: number }

/**
 * Identificador de um sujeito do limite: HMAC do valor, nunca o valor.
 *
 * O IP é dado pessoal, e este sistema coleta dado de adolescente. O nome de
 * usuário do Operador também não precisa ficar escrito numa tabela de
 * contagem. Guardar o HMAC mantém o limite funcionando — o mesmo valor produz
 * sempre a mesma cadeia — e o que fica no banco não reidentifica ninguém
 * (RNF-08). A chave sai do segredo da aplicação, então nem quem lê a tabela
 * reverte por força bruta sobre o espaço de endereços IPv4.
 *
 * O `rotulo` separa espaços: um IP e um nome de usuário que por acaso fossem a
 * mesma cadeia de caracteres não podem cair no mesmo balde.
 *
 * Devolve `null` quando não há valor — ver `verificarLimite`.
 */
export function identificar(valor: string | null | undefined, rotulo: string): string | null {
  if (valor === null || valor === undefined || valor.trim() === '') return null

  return createHmac('sha256', env().SESSION_SECRET)
    .update(`limite-taxa/v1|${rotulo}|${valor.trim()}`)
    .digest('base64url')
}

/**
 * Consulta todas as faixas em uma ida ao banco e devolve o veredito.
 *
 * `agora` vem de fora para o teste poder mover o relógio. Em produção é o
 * relógio do servidor — o mesmo que grava `ocorrido_em`. A premissa de que os
 * dois estão sincronizados é a de RF-23, e T19 a verifica.
 */
export async function verificarLimite(
  db: Db,
  politica: Politica,
  identificador: string | null,
  agora: number = Date.now(),
): Promise<VereditoLimite> {
  if (politica.faixas.length === 0) return { permitido: true }

  // Sem identificador não há limite a aplicar. A tentação seria jogar todo
  // mundo num balde "desconhecido", e o resultado disso é que a primeira dúzia
  // de participantes tranca o evento inteiro. Se o cabeçalho de origem não
  // chega, o defeito é de configuração da hospedagem e T21 tem de pegá-lo.
  if (identificador === null) return { permitido: true }

  const maiorJanela = Math.max(...politica.faixas.map((f) => f.janelaMs))

  const linhas = await db
    .select({ ocorridoEm: schema.limiteTaxa.ocorridoEm })
    .from(schema.limiteTaxa)
    .where(
      and(
        eq(schema.limiteTaxa.escopo, politica.escopo),
        eq(schema.limiteTaxa.identificador, identificador),
        gt(schema.limiteTaxa.ocorridoEm, new Date(agora - maiorJanela)),
      ),
    )

  // Do mais antigo para o mais recente: é a ordem em que as marcas saem da
  // janela, e por isso a que responde "faltam quantos segundos".
  const instantes = linhas.map((l) => l.ocorridoEm.getTime()).sort((a, b) => a - b)

  let esperar = 0

  for (const faixa of politica.faixas) {
    const naJanela = instantes.filter((t) => t > agora - faixa.janelaMs)

    if (naJanela.length < faixa.limite) continue

    // A cota volta quando a marca mais antiga que ainda ocupa a faixa expira.
    const liberando = naJanela[naJanela.length - faixa.limite]
    if (liberando === undefined) continue

    esperar = Math.max(esperar, Math.ceil((liberando + faixa.janelaMs - agora) / 1000))
  }

  return esperar > 0
    ? { permitido: false, esperarSegundos: Math.max(1, esperar) }
    : { permitido: true }
}

/**
 * Marca uma ocorrência que consome cota.
 *
 * **O que conta é decisão de quem chama, e os dois usos são opostos de
 * propósito.** No cadastro conta o sucesso: errar a validação cinco vezes é
 * gente preenchendo formulário, não ataque (D-27). No login conta a falha: é
 * exatamente a tentativa recusada que precisa ficar cara.
 *
 * Aceita a transação de quem chama, para que a marca e o efeito entrem juntos
 * ou não entrem.
 *
 * `ocorridoEm` existe para o teste montar histórico; omitido, o instante vem do
 * `default now()` da tabela — do relógio do servidor, como todo instante
 * gravado neste sistema.
 */
export async function consumirLimite(
  db: Db,
  escopo: string,
  identificador: string | null,
  ocorridoEm?: Date,
): Promise<void> {
  if (identificador === null) return

  await db.insert(schema.limiteTaxa).values({
    escopo,
    identificador,
    ...(ocorridoEm === undefined ? {} : { ocorridoEm }),
  })
}
