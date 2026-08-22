import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { exigirOperador } from '@/contexts/identidade/servico'

/**
 * Guarda de todo o painel (RF-11, T08 item 6).
 *
 * O grupo `(protegido)` não aparece na URL: as páginas dentro dele continuam em
 * `/painel`, `/painel/fila` e o que T11 acrescentar. O que o grupo faz é
 * garantir que **toda** página do painel passe por este layout, e que
 * `/painel/login` — que está fora dele — não passe.
 *
 * A conferência acontece **no servidor, antes de renderizar**. Sem sessão
 * válida, `exigirOperador` redireciona e nenhum componente abaixo chega a ser
 * montado: nada consulta a fila, nada lê um telefone, nada é enviado ao
 * navegador para depois ser escondido por CSS.
 *
 * Não é a única barreira, e não deveria ser. Cada rota sob `/api/painel` chama
 * `exigirOperadorNaApi` por conta própria, porque uma guarda de layout não
 * protege endpoint nenhum — e `tests/painelGuarda.test.ts` falha se alguma rota
 * nova esquecer disso.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * O painel nunca é pré-renderizado nem servido de cache.
 *
 * Uma página que depende de quem está logado e que pudesse ser guardada por uma
 * borda entregaria a fila de um Operador ao próximo visitante. `force-dynamic` é
 * o que impede isso mesmo que alguém acrescente cache adiante.
 */
export const dynamic = 'force-dynamic'

export default async function LayoutDoPainel({ children }: { children: ReactNode }) {
  await exigirOperador()

  return children
}
