import { describe, expect, it } from 'vitest'
import { ConfiguracaoInvalidaError, validarAmbiente } from './env'

const valido = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/speedx',
  SESSION_SECRET: 'x'.repeat(32),
  APP_URL: 'http://localhost:3000',
}

describe('validarAmbiente', () => {
  it('aceita a configuração mínima e aplica os padrões opcionais', () => {
    const env = validarAmbiente(valido)

    expect(env.DATABASE_URL).toBe(valido.DATABASE_URL)
    expect(env.RATE_LIMIT_CADASTROS_POR_JANELA).toBe(30)
    expect(env.RATE_LIMIT_JANELA_SEGUNDOS).toBe(600)
    expect(env.RATE_LIMIT_CADASTROS_POR_HORA).toBe(100)
    expect(env.FORMULARIO_SEGUNDOS_MINIMOS).toBe(3)
    expect(env.TELEMETRY_URL).toBe('')
  })

  it('T01 — falha nomeando a variável ausente', () => {
    const { DATABASE_URL: _omitida, ...semBanco } = valido

    expect(() => validarAmbiente(semBanco)).toThrow(ConfiguracaoInvalidaError)
    expect(() => validarAmbiente(semBanco)).toThrow(/DATABASE_URL/)
  })

  it('RNF-17 — variável ausente explica o que fazer, não só que faltou', () => {
    // Sem mensagem própria, o Zod responde "expected string, received undefined":
    // diz qual variável falhou, mas não ajuda quem está subindo o sistema.
    for (const ausente of ['DATABASE_URL', 'SESSION_SECRET', 'APP_URL'] as const) {
      const { [ausente]: _omitida, ...parcial } = valido

      expect(() => validarAmbiente(parcial)).toThrow(/obrigatória/)
      expect(() => validarAmbiente(parcial)).not.toThrow(/expected string/)
    }
  })

  it('rejeita SESSION_SECRET curto demais para assinar sessão', () => {
    expect(() => validarAmbiente({ ...valido, SESSION_SECRET: 'curto' })).toThrow(/SESSION_SECRET/)
  })

  it('rejeita DATABASE_URL que não seja PostgreSQL', () => {
    expect(() => validarAmbiente({ ...valido, DATABASE_URL: 'mysql://x/y' })).toThrow(/PostgreSQL/)
  })

  it('rejeita APP_URL relativa — ela vira o destino do QR code', () => {
    expect(() => validarAmbiente({ ...valido, APP_URL: '/inscricao' })).toThrow(/APP_URL/)
  })

  it('converte os limites de taxa vindos como texto', () => {
    const env = validarAmbiente({ ...valido, RATE_LIMIT_CADASTROS_POR_JANELA: '12' })

    expect(env.RATE_LIMIT_CADASTROS_POR_JANELA).toBe(12)
  })

  it('T05 — o limite de taxa vem ligado e só desliga por valor explícito', () => {
    // O padrão importa: quem esquece a variável fica protegido, e desligar a
    // proteção exige alguém escrever "false" de propósito.
    expect(validarAmbiente(valido).RATE_LIMIT_ATIVO).toBe(true)
    expect(validarAmbiente({ ...valido, RATE_LIMIT_ATIVO: 'false' }).RATE_LIMIT_ATIVO).toBe(false)
    expect(validarAmbiente({ ...valido, RATE_LIMIT_ATIVO: 'true' }).RATE_LIMIT_ATIVO).toBe(true)
  })

  it('T05 — recusa valor ambíguo para o desligamento do limite', () => {
    // "0", "no", "off": cada um desses parece desligar e, num booleano frouxo,
    // metade liga. Aqui a variável é uma enumeração de duas palavras, e um erro
    // de digitação derruba o boot em vez de deixar o evento sem proteção.
    expect(() => validarAmbiente({ ...valido, RATE_LIMIT_ATIVO: '0' })).toThrow(
      ConfiguracaoInvalidaError,
    )
  })
})
