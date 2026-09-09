import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { TEMA_PADRAO, alternar, ehTema } from '@/shared/tema'

const { POST } = await import('@/../app/api/tema/route')

const URL_BASE = 'http://localhost:3000/api/tema'

/**
 * A troca de tema (PRD-front §5.1).
 *
 * **O que estes testes protegem não é a aparência, é a decisão.** O tema abre no
 * claro porque o evento é ao ar livre, a escolha vive num cookie porque as
 * páginas navegam por recarga completa, e o retorno é validado porque um campo
 * de formulário que vira `Location` é a receita clássica do redirecionamento
 * aberto. Nenhuma dessas três sobrevive sozinha a um refactor.
 */

function pedido(campos: Record<string, string>, cookie?: string): NextRequest {
  const corpo = new URLSearchParams(campos)

  return new NextRequest(URL_BASE, {
    method: 'POST',
    body: corpo,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie === undefined ? {} : { cookie: `speedx_tema=${cookie}` }),
    },
  })
}

describe('o tema como valor', () => {
  it('o padrão é o claro', () => {
    // Não é `prefers-color-scheme`, e a diferença importa: a maioria deixa o
    // aparelho no escuro, mas essa preferência foi formada em ambiente fechado.
    // Seguir o sistema entregaria o tema pior por padrão, no pátio, ao sol.
    expect(TEMA_PADRAO).toBe('claro')
  })

  it('a alternância é uma volta completa', () => {
    expect(alternar('claro')).toBe('escuro')
    expect(alternar(alternar('claro'))).toBe('claro')
  })

  it('só reconhece os dois temas que existem', () => {
    expect(ehTema('claro')).toBe(true)
    expect(ehTema('escuro')).toBe(true)
    expect(ehTema('sepia')).toBe(false)
    expect(ehTema(undefined)).toBe(false)
  })
})

describe('POST /api/tema', () => {
  it('grava o tema pedido e devolve para a página de onde veio', async () => {
    const resposta = await POST(pedido({ tema: 'escuro', de: '/classificacao' }))

    // 303, e não 307: depois de um POST o navegador precisa buscar o destino
    // com GET. Com 307 ele repetiria o POST na página de volta.
    expect(resposta.status).toBe(303)
    expect(resposta.headers.get('location')).toContain('/classificacao')
    expect(resposta.headers.get('set-cookie')).toContain('speedx_tema=escuro')
  })

  it('o cookie sobrevive à navegação: um ano, caminho inteiro, fechado ao script', async () => {
    // Sem persistência o botão não funciona na prática — as páginas públicas
    // navegam por âncora comum, então toda navegação é recarga completa e
    // estado em memória morreria entre a inscrição e a classificação.
    const cabecalho = (await POST(pedido({ tema: 'escuro', de: '/' }))).headers.get('set-cookie')

    expect(cabecalho).toContain('Path=/')
    expect(cabecalho).toContain('Max-Age=31536000')
    expect(cabecalho).toContain('HttpOnly')
    expect(cabecalho).toMatch(/SameSite=lax/i)
  })

  it('sem tema no formulário, alterna a partir do que o navegador tem', async () => {
    const resposta = await POST(pedido({ de: '/' }, 'escuro'))

    expect(resposta.headers.get('set-cookie')).toContain('speedx_tema=claro')
  })

  it('um tema inventado não vira cookie', async () => {
    // Cookie editado à mão, truncado por proxy, ou campo forjado: cai na
    // alternância a partir do padrão em vez de gravar lixo que o CSS ignora e
    // ninguém consegue desfazer pelo botão.
    const resposta = await POST(pedido({ tema: 'sepia', de: '/' }))

    expect(resposta.headers.get('set-cookie')).toContain('speedx_tema=escuro')
  })

  it('não redireciona para fora do site', async () => {
    // `//outro-site.com` é caminho válido para o `Location` e leva para fora
    // daqui. É a forma clássica de transformar um retorno inocente em
    // redirecionamento aberto — e o campo vem de um formulário, que qualquer
    // página pode montar e enviar.
    for (const hostil of ['//outro-site.com', 'https://outro-site.com', 'javascript:alert(1)']) {
      const destino = (await POST(pedido({ tema: 'escuro', de: hostil }))).headers.get('location')

      expect(destino).toBe('http://localhost:3000/')
    }
  })
})
