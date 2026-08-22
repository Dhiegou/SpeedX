import { describe, expect, it } from 'vitest'
import { montarRegistro, sanear } from './log'

/**
 * O log não pode virar um caminho de saída para dado pessoal (RNF-08, T05 §5).
 *
 * A forma fechada de `EntradaDeLog` já impede o caso comum. Estes testes cobrem
 * o caso que a forma não impede: alguém interpolar o dado dentro do texto livre
 * que sobrou — tipicamente a mensagem de um erro de banco, que traz o valor
 * recusado junto.
 */

describe('sanear', () => {
  it('apaga e-mail em qualquer lugar do texto', () => {
    const saneado = sanear('duplicate key value: marina.costa+corrida@exemplo.com.br')

    expect(saneado).not.toContain('marina.costa')
    expect(saneado).not.toContain('exemplo.com.br')
    expect(saneado).toContain('[removido]')
  })

  it('apaga telefone, com ou sem máscara', () => {
    expect(sanear('telefone 11987654321 recusado')).not.toMatch(/\d{10}/)
    expect(sanear('telefone (11) 98765-4321 recusado')).not.toContain('98765')
    expect(sanear('telefone +55 11 98765-4321')).not.toContain('98765')
  })

  it('preserva o que o suporte precisa ler', () => {
    // Saneamento amplo demais que apaga o identificador do registro deixa o log
    // inútil, e log inútil é o mesmo que log nenhum.
    const uuid = '0f2b7c14-6a8e-4f0d-9c3a-5b7e2d1a8c40'

    expect(sanear(`participante ${uuid} gravado`)).toContain(uuid)
    expect(sanear('validacao recusou idade_minima')).toBe('validacao recusou idade_minima')
    expect(sanear('pitch 1 e 2, 200 ms')).toBe('pitch 1 e 2, 200 ms')
  })

  it('preserva também o UUID cheio de dígitos', () => {
    // Regressão encontrada em T08, com um Operador de verdade: o teste acima
    // passava porque o UUID escolhido tinha letras cedo o bastante. Um UUID
    // sorteado com onze dígitos seguidos no começo tem a forma exata de um
    // telefone mascarado, e virava `cb[removido]c3-...` no log — o
    // identificador do Operador que assinou o Lançamento, corroído justamente
    // no registro que existe para dizer quem assinou (RF-23).
    for (const uuid of [
      '12345678-9012-4345-8901-234567890123',
      '00000000-0000-4000-8000-000000000000',
      'cb103307-9014-43c3-a46e-ed1c6efd4481',
    ]) {
      expect(sanear(`operador ${uuid} entrou`)).toContain(uuid)
    }
  })

  it('um UUID no meio de texto não protege o telefone ao lado', () => {
    const saneado = sanear('operador 12345678-9012-4345-8901-234567890123 viu 11987654321')

    expect(saneado).toContain('12345678-9012-4345-8901-234567890123')
    expect(saneado).not.toContain('11987654321')
  })
})

describe('montarRegistro', () => {
  it('saneia motivo, referência e nomes de campo', () => {
    const registro = montarRegistro({
      evento: 'inscricao.cadastro',
      resultado: 'erro',
      motivo: 'falha ao gravar marina@exemplo.com',
      referencia: '11987654321',
      campos: ['email', 'telefone'],
    })

    expect(registro.motivo).not.toContain('marina@exemplo.com')
    expect(registro.referencia).toBe('[removido]')
    // Nome de campo é vocabulário do sistema e atravessa intacto: é ele que
    // permite contar quais campos mais falham sem olhar valor nenhum.
    expect(registro.campos).toEqual(['email', 'telefone'])
  })

  it('carimba o instante pelo relógio do servidor', () => {
    const registro = montarRegistro({ evento: 'inscricao.cadastro', resultado: 'sucesso' })

    expect(Date.parse(registro.instante)).not.toBeNaN()
  })

  it('não inventa campos ausentes', () => {
    const registro = montarRegistro({ evento: 'inscricao.cadastro', resultado: 'sucesso' })

    expect(registro.motivo).toBeUndefined()
    expect(registro.referencia).toBeUndefined()
  })
})
