import type { Metadata } from 'next'
import { connection } from 'next/server'
import FormularioInscricao from './_componentes/FormularioInscricao'
import { LINK_TERMO, TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'
import { emitirTokenFormulario } from '@/contexts/inscricao/tokenFormulario'
import { registrarOperacao } from '@/shared/log'

/**
 * `/` — formulário de inscrição, destino direto do QR code (RF-01, T06, T07).
 *
 * O formulário mora na raiz, e não em `/inscricao` como o cabeçalho da T06
 * dizia: T07 resolveu isso a favor de zero redirecionamento. Cada salto extra
 * custa uma resolução de nome e um handshake, e vira fila no ponto do QR.
 *
 * Server Component. Faz três coisas que o navegador não pode fazer:
 *
 *  - **emite o token** que prova quando a página foi carregada. Assinado aqui,
 *    o tempo de preenchimento deixa de ser um número que o cliente escolhe
 *    (RNF-12, D-29);
 *  - **resolve o termo vigente**, para que as caixas de aceite venham do dado
 *    e não de uma cópia escrita à mão na interface (D-23);
 *  - **conta a abertura do formulário**, que é o denominador da taxa de
 *    conclusão do PRD §7. O numerador é o 201 registrado por T05.
 */

export const metadata: Metadata = {
  title: 'Inscrição — SpeedX',
  description: 'Inscreva-se na corrida. Leva menos de dois minutos.',
}

export default async function Home() {
  // Sem isto o Next prerenderiza a página no build e todo participante receberia
  // o mesmo token, emitido no dia do deploy — expirado antes do evento começar.
  await connection()

  registrarOperacao({ evento: 'inscricao.formulario_aberto', resultado: 'sucesso' })

  return (
    <FormularioInscricao
      token={emitirTokenFormulario()}
      aceites={TERMO_VIGENTE.aceites}
      versaoTermo={TERMO_VIGENTE.versao}
      linkTermo={LINK_TERMO}
    />
  )
}
