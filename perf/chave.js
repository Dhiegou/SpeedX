import { randomUUID } from 'node:crypto'

/**
 * Uma chave de idempotência nova por lançamento (T18 §3).
 *
 * **Existe por causa de um defeito da bancada, não do sistema.** O `{{ $uuid }}`
 * do gerador de carga é resolvido **uma vez por usuário virtual**, e não por
 * requisição. Um Operador em laço reenviava a mesma chave com uma Tentativa
 * diferente a cada volta, e o servidor respondia `409 chave_em_conflito` —
 * corretamente, porque é exatamente isso que a chave promete impedir (FL-06).
 *
 * O resultado da primeira execução foram 2 lançamentos aceitos e 46 recusados,
 * e a leitura preguiçosa disso seria "o sistema não aguenta escrita
 * concorrente". A leitura certa é que o teste estava reenviando comando
 * diferente sob a mesma chave, que é o caso de uso que a idempotência recusa de
 * propósito.
 */
export function novaChave(contexto, _eventos, seguir) {
  contexto.vars.chave = randomUUID()
  contexto.vars.idempotencia = randomUUID()
  return seguir()
}

/**
 * Um Operador por Cockpit, alternando (T18 §3).
 *
 * Sem isto os dois usuários virtuais liam a mesma fila e disputavam a **mesma**
 * Tentativa: um gravava, o outro levava `409`. O conflito é tratado
 * corretamente — é a constraint de RF-25 fazendo o trabalho dela —, mas não é o
 * que acontece no evento. Lá são dois Cockpits, duas filas e dois Operadores
 * que nunca se cruzam; a concorrência real é entre a escrita e a leitura
 * massiva, não entre os dois Operadores.
 */
let proximo = 0

export function escolherCockpit(contexto, _eventos, seguir) {
  proximo += 1
  contexto.vars.cockpit = (proximo % 2) + 1
  return seguir()
}
