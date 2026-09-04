import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import FormularioLogin from './FormularioLogin'
import estilos from './login.module.css'
import { getOperadorAtual, horasDeSessao } from '@/contexts/identidade/servico'

/**
 * `/painel/login` — entrada do Operador (T08, FL-04).
 *
 * Mora **fora** do grupo `(protegido)`, e é por isso que a guarda do layout não
 * a alcança. Se estivesse dentro, quem chega sem sessão seria mandado para o
 * login, que exigiria sessão, que mandaria para o login: o laço de
 * redirecionamento clássico.
 *
 * Server Component. Emite a página e nada mais — a decisão de acesso é do
 * servidor, e esta rota é justamente a que ainda não tem acesso a decidir.
 */

export const metadata: Metadata = {
  title: 'Entrar — Painel SpeedX',
  description: 'Acesso do Operador ao painel de cronometragem.',
  // O painel não é conteúdo público. Não há link para ele em lugar nenhum, mas
  // um buscador que descubra a URL por outro caminho não deve indexá-la.
  robots: { index: false, follow: false },
}

const DESTINO_PADRAO = '/painel'

export default async function Login() {
  // Quem já tem sessão viva não precisa ver esta tela. Vale como conveniência,
  // não como segurança: quem decide o acesso ao painel é a guarda do layout.
  if ((await getOperadorAtual()) !== null) redirect(DESTINO_PADRAO)

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>Painel do Operador</h1>
      <p className={estilos.subtitulo}>Acesso restrito à equipe da corrida.</p>

      <FormularioLogin destino={DESTINO_PADRAO} />

      <p className={estilos.rodape}>
        A sessão dura {horasDeSessao()} horas e se renova enquanto o painel está em uso — ninguém é
        desconectado no meio do evento. Contas são criadas pela organização; não há cadastro.
      </p>

      {/*
        O caminho de volta.

        Esta era a única tela do produto sem saída que não fosse o botão do
        navegador — e ela é justamente onde chega quem digitou o endereço
        errado, ou um participante que descobriu a URL do painel. Mandá-lo de
        volta ao site é mais útil do que deixá-lo numa parede.

        Âncora comum, e não `Link`: o painel não carrega o roteador de cliente,
        e trazê-lo por causa de um link seria pagar quilobytes por conveniência
        (a mesma conta do `Cabecalho`).
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className={estilos.voltar} href="/">
        ← Ir para o site da corrida
      </a>
    </main>
  )
}
