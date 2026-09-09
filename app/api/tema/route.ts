import { NextResponse, type NextRequest } from 'next/server'
import { emProducao } from '@/shared/env'
import { NOME_DO_COOKIE_DE_TEMA, TEMA_PADRAO, alternar, ehTema, type Tema } from '@/shared/tema'

/**
 * `/api/tema` — a troca de tema, sem uma linha de JavaScript (PRD-front §5.1).
 *
 * **Por que rota e não Server Action nem botão de cliente.** Server Component
 * não escreve cookie, então a troca precisa de um lugar que escreva. Das três
 * saídas possíveis, esta é a única que custa zero byte: um `<form method="post">`
 * é HTML puro, e o navegador já sabe enviá-lo. Um componente de cliente traria
 * React para páginas que hoje não têm nenhum, e uma Server Action traria o
 * runtime de ações — os dois cobrados no primeiro carregamento de 2000 pessoas
 * em rede congestionada (RNF-04), por uma preferência que a pessoa muda uma
 * vez no dia, se muito.
 *
 * O preço é uma ida ao servidor por troca. É o preço certo: a página já
 * recarrega a cada navegação por causa da âncora comum, e voltar com o tema já
 * aplicado no HTML é justamente o que elimina a piscada.
 */

/**
 * Para onde voltar depois de trocar.
 *
 * Só caminho interno, e a conferência é dupla: precisa começar com uma barra e
 * **não** com duas. `//outro-site.com` é um caminho válido para o `Location` e
 * leva para fora daqui — é a forma clássica de transformar um retorno inocente
 * em redirecionamento aberto. Qualquer coisa fora do formato cai na raiz, que é
 * sempre um destino seguro.
 */
function destino(bruto: FormDataEntryValue | null): string {
  const caminho = typeof bruto === 'string' ? bruto : ''

  return caminho.startsWith('/') && !caminho.startsWith('//') ? caminho : '/'
}

/**
 * O formulário manda o tema de destino já calculado no servidor. Se vier
 * qualquer outra coisa, alterna a partir do que o navegador tem: a pessoa
 * clicou num botão de troca, e não trocar nada seria o pior desfecho.
 */
function proximoTema(bruto: FormDataEntryValue | null, atual: Tema): Tema {
  return typeof bruto === 'string' && ehTema(bruto) ? bruto : alternar(atual)
}

export async function POST(requisicao: NextRequest): Promise<Response> {
  const formulario = await requisicao.formData()

  const atual = requisicao.cookies.get(NOME_DO_COOKIE_DE_TEMA)?.value
  const escolhido = proximoTema(formulario.get('tema'), ehTema(atual) ? atual : TEMA_PADRAO)

  // 303 e não 307: depois de um POST o navegador precisa buscar o destino com
  // GET. Com 307 ele repetiria o POST na página de volta.
  const resposta = NextResponse.redirect(
    new URL(destino(formulario.get('de')), requisicao.url),
    303,
  )

  // RNF-10: nada aqui é cacheável. Uma borda que guardasse este 303 devolveria a
  // alguém o `Set-Cookie` de outra pessoa — e "é só uma preferência" não atenua
  // nada, porque o mecanismo é o mesmo de qualquer cabeçalho de resposta.
  resposta.headers.set('Cache-Control', 'no-store')

  resposta.cookies.set(NOME_DO_COOKIE_DE_TEMA, escolhido, {
    path: '/',
    // Um ano. O site sai do ar dez dias depois do evento (D-22), então o prazo
    // é folgado de propósito: nunca expira durante o uso real.
    maxAge: 31_536_000,
    // Nada no cliente lê este cookie — quem o aplica é o servidor, no layout
    // raiz. Então fica fechado ao script, que é o padrão mais barato de manter.
    httpOnly: true,
    // `Lax`, e não `Strict`: a preferência precisa sobreviver a chegar pelo QR
    // ou por link colado num grupo de mensagens.
    sameSite: 'lax',
    secure: emProducao(),
  })

  return resposta
}
