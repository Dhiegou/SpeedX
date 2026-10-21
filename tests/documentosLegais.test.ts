import { describe, expect, it } from 'vitest'
import { TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'
import {
  POLITICA_DE_PRIVACIDADE,
  TERMOS_DE_USO,
  type DocumentoLegal,
} from '@/contexts/inscricao/documentos'

/**
 * Política de privacidade e termos de uso (D-109).
 *
 * O risco que este arquivo vigia é o segundo do PRD de conformidade: **a página
 * nova contradizer o termo.** O termo é aprovado e protegido por hash; se a
 * política disser outra coisa sobre canal, prazo ou repasse, cria ambiguidade
 * justamente onde não se quer. Os testes leem o termo vigente e comparam.
 */

const textoDe = (documento: DocumentoLegal): string =>
  documento.secoes
    .flatMap((secao) => [
      secao.titulo,
      ...secao.blocos.flatMap((bloco) =>
        bloco.tipo === 'lista'
          ? bloco.itens
          : bloco.tipo === 'remissao'
            ? [bloco.texto, bloco.rotulo]
            : [bloco.texto],
      ),
    ])
    .join('\n')

const textoDoTermo = TERMO_VIGENTE.secoes
  .flatMap((secao) =>
    secao.blocos.flatMap((bloco) => (bloco.tipo === 'lista' ? bloco.itens : [bloco.texto])),
  )
  .join('\n')

const POLITICA = textoDe(POLITICA_DE_PRIVACIDADE)
const TERMOS = textoDe(TERMOS_DE_USO)

describe('os documentos não contradizem o termo', () => {
  it('o canal de contato é o mesmo e-mail que o termo publica', () => {
    // Termina em letra, e não em ponto: o e-mail costuma fechar a frase.
    const emails = (texto: string) => new Set(texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])

    const doTermo = emails(textoDoTermo)
    expect(doTermo.size).toBe(1)

    for (const documento of [POLITICA, TERMOS]) {
      expect([...emails(documento)]).toEqual([...doTermo])
    }
  })

  it('o prazo de guarda é o do termo: 10 dias, e o site sai do ar em 4 de novembro', () => {
    expect(textoDoTermo).toContain('10 dias')
    expect(POLITICA).toContain('10 dias')
    expect(POLITICA).toContain('4 de novembro de 2026')
    expect(TERMOS).toContain('4 de novembro de 2026')
  })

  it('o repasse é o do termo: só o telefone, só com autorização, FIAP e o curso', () => {
    expect(textoDoTermo).toContain('a FIAP;')
    expect(POLITICA).toContain('Só o telefone pode ser repassado')
    expect(POLITICA).toContain('FIAP')
    expect(POLITICA).toContain('Lélio Assumpção')
  })

  it('toda remissão ao termo aponta para uma seção que existe nele', () => {
    const secoesDoTermo = new Set(TERMO_VIGENTE.secoes.map((secao) => secao.id))

    const remissoes = [POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO].flatMap((documento) =>
      documento.secoes.flatMap((secao) =>
        secao.blocos.flatMap((bloco) => (bloco.tipo === 'remissao' ? [bloco.href] : [])),
      ),
    )

    const quebradas = remissoes
      .filter((href) => href.startsWith('/termo#'))
      .filter((href) => !secoesDoTermo.has(href.slice('/termo#'.length) as never))

    expect(remissoes.length).toBeGreaterThan(0)
    expect(quebradas).toEqual([])
  })
})

describe('a política tem o que o PRD de conformidade exige (§5.1)', () => {
  it('nomeia o controlador', () => {
    expect(POLITICA).toContain('Dhiego Ferreira, pessoa física')
  })

  it('cita a LGPD, a base legal e a ANPD', () => {
    expect(POLITICA).toContain('Lei nº 13.709/2018')
    expect(POLITICA).toContain('art. 7º, inciso I')
    expect(POLITICA).toContain('art. 14')
    expect(POLITICA).toContain('ANPD')
  })

  it('lista os direitos do art. 18', () => {
    for (const direito of [
      'confirmar',
      'acessar',
      'corrigir',
      'anonimização',
      'portabilidade',
      'compartilhados',
      'pode não dar o consentimento',
      'revogar',
    ]) {
      expect(POLITICA).toContain(direito)
    }
  })

  it('declara o envio do resultado por e-mail ou WhatsApp, decidido pelo organizador', () => {
    expect(POLITICA).toContain('por e-mail ou por WhatsApp')
  })

  it('declara os dois cookies, e por que não há aviso de cookies', () => {
    expect(POLITICA).toContain('dois cookies')
    expect(POLITICA).toContain('Tema:')
    expect(POLITICA).toContain('Sessão do painel:')
    expect(POLITICA).toContain('nem mostramos aviso de cookies')
  })
})

describe('os termos de uso têm o que o PRD de conformidade exige (§5.2)', () => {
  it('dizem como o resultado é registrado e como contestar', () => {
    expect(TERMOS).toContain('digita esse tempo')
    expect(TERMOS).toContain('Se você achar que o seu tempo está errado')
  })

  it('carregam as decisões do organizador: vaga garantida e foro de São Paulo', () => {
    expect(TERMOS).toContain('tem a vez garantida')
    expect(TERMOS).toContain('comarca de São Paulo/SP')
  })
})

describe('a mesma linguagem do termo', () => {
  it('nenhum dos dois usa travessão (D-24)', () => {
    expect(POLITICA).not.toMatch(/[—–]/)
    expect(TERMOS).not.toMatch(/[—–]/)
  })
})
