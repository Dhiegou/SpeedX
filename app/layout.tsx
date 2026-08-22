import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'SpeedX — Corrida',
  description: 'Inscrição e classificação da corrida.',
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
