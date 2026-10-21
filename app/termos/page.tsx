import type { Metadata } from 'next'
import PaginaDeDocumento from '../_componentes/DocumentoLegal'
import { TERMOS_DE_USO } from '@/contexts/inscricao/documentos'

/**
 * `/termos` — termos de uso do site (D-109).
 *
 * O que o site faz, a vaga, as regras e, principalmente, como o resultado é
 * registrado e contestado. Texto constante, resolvido em build.
 */

export const metadata: Metadata = {
  title: 'Termos de uso — SpeedX',
  description: 'As regras da inscrição e como o resultado da corrida é registrado e contestado.',
}

export default function TermosPage() {
  return <PaginaDeDocumento documento={TERMOS_DE_USO} atual="termos" />
}
