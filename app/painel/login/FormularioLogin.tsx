'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import estilos from './login.module.css'

/**
 * Formulário de login do Operador (T08, item 1 do escopo).
 *
 * O que este componente **não** faz: não decide se a credencial é válida, não
 * lê cookie, não sabe que sessão existe. Ele envia dois campos e mostra o que
 * voltou. A decisão inteira é do servidor — se este arquivo fosse reescrito por
 * completo por alguém no navegador, nada mudaria (restrição 2 do anexo do PRD).
 *
 * Também não valida a senha antes de enviar. Validar "senha muito curta" na
 * tela contaria a quem sonda qual é o tamanho mínimo das senhas do painel, e não
 * pouparia nenhuma ida à rede que importe: são meia dúzia de logins por dia.
 */

const ENDERECO = '/api/painel/sessao'

type Situacao = 'parado' | 'enviando' | 'recusado' | 'espere' | 'falhou'

const AVISOS: Record<Exclude<Situacao, 'parado' | 'enviando'>, string> = {
  recusado: 'Usuário ou senha incorretos.',
  espere: 'Tentativas demais. Aguarde alguns minutos antes de tentar de novo.',
  falhou: 'Não foi possível entrar agora. Verifique a conexão e tente de novo.',
}

export default function FormularioLogin({ destino }: { destino: string }) {
  const router = useRouter()
  const [situacao, setSituacao] = useState<Situacao>('parado')

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()

    const dados = new FormData(evento.currentTarget)
    setSituacao('enviando')

    let resposta: Response
    try {
      resposta = await fetch(ENDERECO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: String(dados.get('usuario') ?? ''),
          senha: String(dados.get('senha') ?? ''),
        }),
      })
    } catch {
      setSituacao('falhou')
      return
    }

    if (resposta.ok) {
      // `refresh` antes de `replace`: o layout do painel é Server Component e
      // decide o acesso no servidor. Sem invalidar o cache do roteador, a
      // navegação poderia reaproveitar a árvore renderizada quando não havia
      // sessão — a tela de login de novo, com a sessão já aberta.
      router.refresh()
      router.replace(destino)
      return
    }

    if (resposta.status === 429) {
      setSituacao('espere')
      return
    }

    setSituacao(resposta.status === 401 ? 'recusado' : 'falhou')
  }

  const enviando = situacao === 'enviando'
  const aviso = situacao === 'parado' || enviando ? null : AVISOS[situacao]

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate>
      {aviso !== null && (
        <p className={estilos.aviso} role="alert">
          {aviso}
        </p>
      )}

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="usuario">
          Usuário
        </label>
        <input
          className={estilos.entrada}
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          // O tablet do painel corrige e capitaliza por padrão, e um usuário
          // com a primeira letra maiúscula por conta do teclado é o motivo mais
          // provável de um login recusado no dia do evento.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="senha">
          Senha
        </label>
        <input
          className={estilos.entrada}
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button className={estilos.botao} type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
