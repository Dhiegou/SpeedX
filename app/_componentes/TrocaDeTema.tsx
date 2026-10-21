'use client'

import type { FormEvent } from 'react'
import estilos from './cabecalho.module.css'
import { CABECALHO_SEM_RECARGA } from '@/shared/temaSemRecarga'

/**
 * O botão de tema do cabeçalho (D-110).
 *
 * **Continua sendo um formulário comum.** Sem JavaScript — script que não
 * baixou na rede do evento, navegador antigo — ele faz o que sempre fez: POST,
 * 303 e a página de volta já no tema novo.
 *
 * **Com JavaScript, a troca é imediata.** Era a demora que se notava: a viagem
 * completa ao servidor e a página inteira renderizada de novo, só para mudar de
 * cor. Aqui o atributo do `<html>` muda no clique, o CSS repinta na hora, e o
 * mesmo formulário vai em segundo plano só para gravar o cookie — a rota
 * responde 204, sem página para buscar.
 *
 * **São dois botões, e o CSS esconde um.** Sem escolha feita, o servidor não
 * sabe se o celular está no escuro ou no claro; o CSS sabe. Cada botão carrega o
 * tema para onde leva, e o que está à mostra é sempre o que troca.
 */
export default function TrocaDeTema({ de }: { de: string }) {
  function trocar(evento: FormEvent<HTMLFormElement>): void {
    const botao = (evento.nativeEvent as SubmitEvent).submitter
    // Sem `submitter` (navegador antigo), o formulário segue o caminho comum.
    if (!(botao instanceof HTMLButtonElement)) return
    evento.preventDefault()

    const tema = botao.value
    document.documentElement.dataset.tema = tema

    // O botão clicado acabou de sumir; sem isto, o foco cairia no `<body>` e
    // quem navega por teclado perderia o lugar.
    evento.currentTarget.querySelector<HTMLButtonElement>(`button:not([value="${tema}"])`)?.focus()

    // Se a rede falhar, a tela já trocou e só a lembrança se perde: na próxima
    // página volta o tema anterior, e o botão continua ali.
    fetch('/api/tema', {
      method: 'POST',
      body: new URLSearchParams({ tema }),
      headers: { [CABECALHO_SEM_RECARGA]: '1' },
    }).catch(() => undefined)
  }

  return (
    <form className={estilos.tema} method="post" action="/api/tema" onSubmit={trocar}>
      <input type="hidden" name="de" value={de} />
      <button
        type="submit"
        name="tema"
        value="escuro"
        className={`${estilos.botaoTema} ${estilos.paraEscuro}`}
        aria-label="Trocar para o tema escuro"
      >
        <span className={estilos.glifo} aria-hidden="true" />
        Escuro
      </button>
      <button
        type="submit"
        name="tema"
        value="claro"
        className={`${estilos.botaoTema} ${estilos.paraClaro}`}
        aria-label="Trocar para o tema claro"
      >
        <span className={estilos.glifo} aria-hidden="true" />
        Claro
      </button>
    </form>
  )
}
