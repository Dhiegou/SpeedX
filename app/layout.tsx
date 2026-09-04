import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { env } from '@/shared/env'

/**
 * O cartão de compartilhamento (PRD-front §5.7).
 *
 * A Classificação vai circular em aplicativo de mensagem durante o evento —
 * é o comportamento que o PRD chama de engajamento hoje desperdiçado. Sem
 * isto, o link chega como endereço cru, sem título, sem imagem e sem contexto.
 *
 * `metadataBase` sai de `APP_URL`, a mesma variável que vira o destino do QR:
 * as marcas de Open Graph exigem endereço absoluto, e um endereço escrito à
 * mão aqui seria uma segunda verdade sobre onde o site mora.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env().APP_URL),
  title: 'SpeedX — Corrida',
  description: 'Inscrição e classificação da corrida.',
  openGraph: {
    type: 'website',
    siteName: 'SpeedX',
    locale: 'pt_BR',
    title: 'SpeedX — Corrida',
    description: 'Inscreva-se e acompanhe a classificação, atualizada conforme as provas terminam.',
  },
  twitter: { card: 'summary_large_image' },
}

// RNF-18: a interface é operada em tela de celular. Sem zoom travado —
// participante que precisa aumentar a fonte deve conseguir.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      {/*
        `suppressHydrationWarning` cobre extensões de navegador que injetam
        atributos no <body> antes do React hidratar — ColorZilla escreve
        `cz-shortcut-listen`, gerenciadores de senha e tradutores fazem o mesmo.
        O participante chega com o navegador que tem; não dá para pedir que
        desinstale nada no dia do evento.

        A supressão vale para os atributos deste elemento e de mais nenhum:
        divergência dentro do formulário, do painel ou da classificação
        continua sendo reportada.
      */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
