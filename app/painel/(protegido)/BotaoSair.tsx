'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import estilos from './painel.module.css'

/**
 * Logout explícito (T08, item 7 do escopo).
 *
 * Botão e não link: sair é um efeito, e um `GET` que encerra sessão é encerrado
 * por qualquer coisa que resolva pré-buscar a URL — inclusive o próprio
 * roteador do Next.
 */
export default function BotaoSair() {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)

  async function sair(): Promise<void> {
    setSaindo(true)

    try {
      await fetch('/api/painel/sessao', { method: 'DELETE' })
    } catch {
      // Sem rede, o cookie continua no aparelho e a sessão viva no banco. Ir
      // para o login mesmo assim é o comportamento honesto: a tela sai, e a
      // próxima requisição autenticada resolve o resto.
    }

    router.refresh()
    router.replace('/painel/login')
  }

  return (
    // Secundário de propósito: sair é a ação que menos se quer acertar por
    // engano num tablet, com a fila andando. O botão cheio é o do lançamento.
    <button
      type="button"
      className={`${estilos.botao} ${estilos.botaoSecundario}`}
      onClick={sair}
      disabled={saindo}
    >
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  )
}
