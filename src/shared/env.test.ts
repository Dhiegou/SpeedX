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
    // Calibrados em T23; o piso e o porquê estão em tests/deploy.test.ts.
    expect(env.RATE_LIMIT_CADASTROS_POR_JANELA).toBe(800)
    expect(env.RATE_LIMIT_JANELA_SEGUNDOS).toBe(600)
    expect(env.RATE_LIMIT_CADASTROS_POR_HORA).toBe(2400)
    expect(env.FORMULARIO_SEGUNDOS_MINIMOS).toBe(3)
    expect(env.DB_POOL_MAX).toBe(5)
    expect(env.APP_VERSION).toBe('desconhecida')
  })

  it('T19 — a versão publicada sai do commit sem ninguém preencher nada', () => {
    // A pergunta que isto responde é a das onze da manhã do evento: qual código
    // está no ar agora. Depender de alguém editar uma variável a cada deploy é
    // depender de alguém lembrar, e a resposta errada é pior que nenhuma.
    const env = validarAmbiente({
      ...valido,
      VERCEL_GIT_COMMIT_SHA: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    })

    expect(env.APP_VERSION).toBe('1a2b3c4')
  })

  it('T19 — uma APP_VERSION escrita à mão vence o commit', () => {
    // Existe para o ambiente sem plataforma de deploy, e para o caso de alguém
    // precisar rotular uma publicação com outra coisa.
    const env = validarAmbiente({
      ...valido,
      APP_VERSION: 'ensaio-do-dia',
      VERCEL_GIT_COMMIT_SHA: '1a2b3c4d5e6f',
    })

    expect(env.APP_VERSION).toBe('ensaio-do-dia')
  })

  it('T19 — o pool por instância tem teto, porque o do banco também tem', () => {
    expect(validarAmbiente({ ...valido, DB_POOL_MAX: '12' }).DB_POOL_MAX).toBe(12)
    expect(() => validarAmbiente({ ...valido, DB_POOL_MAX: '500' })).toThrow(/DB_POOL_MAX/)
    expect(() => validarAmbiente({ ...valido, DB_POOL_MAX: '0' })).toThrow(/DB_POOL_MAX/)
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

  it('D-80 — a conexão direta é opcional, e validada como URL PostgreSQL', () => {
    // Opcional porque contra um Postgres local ela não existe nem faz falta:
    // não há pooler no laço local, e as duas conexões seriam a mesma string.
    expect(validarAmbiente(valido).DATABASE_URL_UNPOOLED).toBeUndefined()

    const direta = 'postgresql://u:s@ep-abc-123.sa-east-1.aws.neon.tech/speedx'
    expect(
      validarAmbiente({ ...valido, DATABASE_URL_UNPOOLED: direta }).DATABASE_URL_UNPOOLED,
    ).toBe(direta)

    // Preenchida com lixo, falha no boot em vez de falhar na migração.
    expect(() => validarAmbiente({ ...valido, DATABASE_URL_UNPOOLED: 'mysql://x/y' })).toThrow(
      /DATABASE_URL_UNPOOLED/,
    )
  })

  it('rejeita DATABASE_URL que não seja PostgreSQL', () => {
    expect(() => validarAmbiente({ ...valido, DATABASE_URL: 'mysql://x/y' })).toThrow(/PostgreSQL/)
  })

  it('separa APP_URL ausente de APP_URL inválida, porque a correção é outra', () => {
    // A primeira publicação caiu duas vezes aqui e o log dizia a mesma frase
    // nas duas. Ausente manda republicar e conferir o ambiente da variável;
    // inválida manda olhar o valor. Trocar uma pela outra custa um ciclo de
    // deploy inteiro procurando no lugar errado.
    const { APP_URL: _omitida, ...semUrl } = valido

    expect(() => validarAmbiente(semUrl)).toThrow(/não chegou ao processo/)
    expect(() => validarAmbiente({ ...valido, APP_URL: 'fiapspeedx.vercel.app' })).toThrow(
      /inválida: recebi «fiapspeedx.vercel.app»/,
    )
  })

  it('a mensagem de APP_URL inválida devolve o valor recebido, não só a regra', () => {
    // Aspas coladas junto com a URL é o acidente mais comum de painel de
    // provedor, e é invisível na tela do painel. Ver o valor entre « » no log
    // é o que encerra a dúvida.
    expect(() => validarAmbiente({ ...valido, APP_URL: '"https://x.com"' })).toThrow(
      'recebi «"https://x.com"»',
    )
  })

  it('apara espaço em volta de APP_URL — a URL global os toleraria calada', () => {
    expect(validarAmbiente({ ...valido, APP_URL: '  https://x.com  ' }).APP_URL).toBe(
      'https://x.com',
    )
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
