import type { Metadata } from 'next'
import BotaoSair from './BotaoSair'
import { exigirOperador } from '@/contexts/identidade/servico'

/**
 * `/painel` — provisório.
 *
 * A T08 entrega identidade e acesso, não o painel: fila, lançamento e correção
 * são T10 e T11. Esta página existe porque uma guarda sem nada atrás dela não
 * pode ser verificada de ponta a ponta — é ela que dá o que o `curl` sem cookie
 * tem de **não** conseguir ler.
 *
 * Chama `exigirOperador` mesmo estando sob o layout que já chamou: a chamada é
 * memoizada por requisição, então não custa consulta nova, e uma página que
 * depende do Operador deve dizer isso no próprio arquivo em vez de confiar em
 * um layout que alguém pode reorganizar.
 */

export const metadata: Metadata = {
  title: 'Painel — SpeedX',
  robots: { index: false, follow: false },
}

export default async function Painel() {
  const operador = await exigirOperador()

  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Painel do Operador</h1>
      <p>
        Sessão aberta como <strong>{operador.nome}</strong>.
      </p>
      <p>A fila, o lançamento de tempos e a correção chegam em T10 e T11.</p>
      <BotaoSair />
    </main>
  )
}
