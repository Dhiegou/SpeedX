import type { Metadata } from 'next'
import PaginaDeDocumento from '../_componentes/DocumentoLegal'
import { POLITICA_DE_PRIVACIDADE } from '@/contexts/inscricao/documentos'

/**
 * `/privacidade` — política de privacidade (D-109).
 *
 * Documento informativo, que complementa o termo e remete a ele onde os dois
 * se sobrepõem. Texto constante, resolvido em build: nenhuma consulta.
 */

export const metadata: Metadata = {
  title: 'Política de privacidade — SpeedX',
  description: 'Quem cuida dos dados da corrida, com base em quê, e como exercer os seus direitos.',
}

export default function PrivacidadePage() {
  return <PaginaDeDocumento documento={POLITICA_DE_PRIVACIDADE} atual="privacidade" />
}
