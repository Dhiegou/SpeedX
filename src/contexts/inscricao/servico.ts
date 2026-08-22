import { db } from '@/db'
import {
  submeterInscricao,
  type ComandoInscricao,
  type ResultadoSubmissao,
} from './submeterInscricao'

/**
 * Composição do contexto: liga o caso de uso à conexão real.
 *
 * O lint proíbe `app/**` de importar `@/db` (T01), e a proibição é o que sustenta
 * a restrição 3 do anexo do PRD — nenhuma consulta parte de rota ou componente.
 * A rota precisa de *alguma* porta de entrada, e esta é ela: um arquivo nomeado,
 * dentro do contexto, cuja única responsabilidade é escolher o banco.
 *
 * Deixar `submeterInscricao` receber o banco por parâmetro é o que permite ao
 * teste rodar contra Postgres em WebAssembly sem simular nada do que importa.
 */
export function submeter(comando: ComandoInscricao): Promise<ResultadoSubmissao> {
  return submeterInscricao(db(), comando)
}
