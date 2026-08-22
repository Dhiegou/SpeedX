import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import config from '@/../next.config'
import { modulosDoSvg } from '@/shared/qr'

/**
 * A rota de entrada (T07, RF-01, FL-01).
 *
 * O critério é "zero redirecionamentos entre a URL do QR e o HTML do
 * formulário", e ele se verifica com `curl -I` — feito, registrado na task.
 * O que um teste acrescenta é o outro lado: impedir que alguém **introduza** um
 * redirecionamento depois, num commit que não tem nada a ver com o QR.
 *
 * Cada salto custa uma resolução de nome e um handshake, com o celular na
 * borda da célula, com centenas de pessoas na mesma antena. Não é
 * microtimização: é a diferença entre a fila andar e a fila parar.
 */

describe('FL-01 — zero redirecionamentos até o formulário', () => {
  it('a raiz é servida por uma página, e não por um redirecionamento', () => {
    const pagina = readFileSync('app/page.tsx', 'utf8')

    expect(pagina).toContain('export default')
    // `redirect()` e `permanentRedirect()` na raiz recriam exatamente o salto
    // que a T07 existe para eliminar.
    expect(pagina).not.toMatch(/\bredirect\s*\(/)
  })

  it('a configuração não declara redirecionamento nem reescrita', () => {
    expect(config.redirects).toBeUndefined()
    expect(config.rewrites).toBeUndefined()
  })

  it('não há barra final obrigatória', () => {
    // `trailingSlash: true` faz o servidor responder 308 para toda URL sem
    // barra. O QR aponta para a raiz, que não sofreria — mas a regra vale para
    // o dia em que alguém imprimir um cartaz apontando para outro caminho.
    expect(config.trailingSlash).not.toBe(true)
  })

  it('não existe uma segunda rota de inscrição para o QR errar', () => {
    // Duas portas de entrada é como nasce o redirecionamento: alguém cria
    // `/inscricao`, o cartaz antigo aponta para a raiz, e alguém "conserta"
    // ligando uma na outra.
    expect(() => readFileSync('app/inscricao/page.tsx', 'utf8')).toThrow()
  })
})

describe('RF-01 — o QR aponta para o formulário', () => {
  const svg = readFileSync('docs/qr/inscricao.svg', 'utf8')

  it('o arquivo é vetorial e declara para onde aponta', () => {
    // Dois QR impressos são indistinguíveis a olho nu. Sem o destino escrito
    // dentro do arquivo, conferir o cartaz da parede exigiria escanear.
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toMatch(/<title>Inscrição SpeedX — https?:\/\/[^<]+<\/title>/)
  })

  it('o símbolo tem área de silêncio e módulos suficientes para correção H', () => {
    const modulos = modulosDoSvg(svg)

    // Versão 1 tem 21 módulos e não comporta uma URL em nível H. Menos que
    // isso significa que o gerador foi trocado por algo com outra configuração.
    expect(modulos).toBeGreaterThanOrEqual(25)
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/)
  })

  it('a URL codificada não leva parâmetro de rastreamento', () => {
    const destino = /<title>Inscrição SpeedX — ([^<]+)<\/title>/.exec(svg)?.[1] ?? ''

    expect(destino).not.toContain('?')
    expect(destino).not.toContain('utm_')
  })
})
