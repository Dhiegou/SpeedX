import type { Metadata } from 'next'
import BotaoSair from './BotaoSair'
import Painel from './Painel'
import { exigirOperador } from '@/contexts/identidade/servico'

/**
 * `/painel` — a tela de trabalho do Operador (T11).
 *
 * Server Component. Faz duas coisas que o navegador não pode fazer: conferir a
 * sessão antes de montar qualquer coisa (RF-11) e passar o nome do Operador
 * para a interface sem que ela precise perguntar quem é.
 *
 * A Fila **não** é carregada aqui. Ela vem da API a cada dez segundos e muda o
 * tempo todo durante o evento; renderizá-la no servidor só produziria uma lista
 * obsoleta no primeiro quadro, que é exatamente o que a T10 proíbe com
 * `no-store`.
 */

export const metadata: Metadata = {
  title: 'Painel — SpeedX',
  robots: { index: false, follow: false },
}

export default async function PainelDoOperador() {
  const operador = await exigirOperador()

  return (
    <>
      <Painel operador={operador.nome} cockpitInicial={1} />
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '0 1rem 2rem' }}>
        <BotaoSair />
      </div>
    </>
  )
}
