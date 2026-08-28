import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { ESCOPO_LOGIN_ORIGEM, ESCOPO_LOGIN_USUARIO, identificarUsuario } from './politicaDeLogin'

/**
 * Destrava um Operador barrado pelo limite de tentativas de login.
 *
 * **Por que isto existe.** D-39 tirou o login do alcance de `RATE_LIMIT_ATIVO`,
 * e com razão: aquela alavanca serve para destravar a fila de inscrição no dia
 * do evento, e destravar junto a força bruta contra o painel seria um efeito
 * colateral que ninguém decidiu. Só que a decisão deixou um buraco do outro
 * lado — sem nenhuma alavanca, um Operador que errasse a senha dez vezes ficava
 * fora por quinze minutos, com a fila do Cockpit parada. RNF-16 dá quinze
 * **segundos** para um lançamento inteiro; quinze minutos é o evento inteiro
 * travado num Cockpit.
 *
 * Errar dez vezes não é hipótese remota: senha de doze caracteres, digitada em
 * tablet, de pé, sob sol, com o teclado capitalizando a primeira letra.
 *
 * **Por que isto não é um buraco de segurança.** Só roda no terminal de quem já
 * tem a `DATABASE_URL` em mãos — a mesma autorização que cria contas (RNF-14).
 * Quem chega aqui já podia apagar a tabela inteira. E o limite volta a valer na
 * tentativa seguinte: isto zera o contador, não o desliga.
 */

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export type Destravamento = {
  /** Marcas apagadas da contagem por conta. */
  readonly porConta: number
  /** Marcas apagadas da contagem por origem. */
  readonly porOrigem: number
}

export async function destravarLogin(db: Db, usuario: string): Promise<Destravamento> {
  const identificador = identificarUsuario(usuario)

  const porConta =
    identificador === null
      ? []
      : await db
          .delete(schema.limiteTaxa)
          .where(
            and(
              eq(schema.limiteTaxa.escopo, ESCOPO_LOGIN_USUARIO),
              eq(schema.limiteTaxa.identificador, identificador),
            ),
          )
          .returning({ id: schema.limiteTaxa.id })

  // A contagem por origem também precisa cair, e não dá para mirar só a dela:
  // o que fica gravado é o HMAC do endereço, e ninguém digita um HMAC no
  // terminal. Se as dez tentativas saíram do mesmo tablet — o caso comum —,
  // limpar apenas a conta não destravaria nada.
  //
  // O alcance disso é o escopo de login e mais nada: o limite do cadastro
  // público, que é o que protege as duas mil inscrições, não é tocado. E a
  // proteção por conta das **outras** contas continua de pé, porque cada uma
  // tem seu próprio identificador.
  const porOrigem = await db
    .delete(schema.limiteTaxa)
    .where(eq(schema.limiteTaxa.escopo, ESCOPO_LOGIN_ORIGEM))
    .returning({ id: schema.limiteTaxa.id })

  return { porConta: porConta.length, porOrigem: porOrigem.length }
}
