import { loadEnvConfig } from '@next/env'
import { defineConfig, devices } from '@playwright/test'
import { urlDoBancoE2E } from './e2e/apoio/preparar'

/**
 * Testes de ponta a ponta (T17).
 *
 * Existem para os requisitos que **só** se verificam com um navegador de
 * verdade: RF-18 (nenhuma gravação sem confirmação), RF-19 (cinco lançamentos
 * só com teclado) e RNF-18 (360 px sem rolagem horizontal). O resto da suíte
 * cobre domínio, endpoint e banco muito mais rápido, e por isso o e2e é curto
 * de propósito — cada caso aqui custa segundos, e uma suíte de e2e que demora
 * é uma suíte que se aprende a pular.
 *
 * Roda contra `next dev` numa porta própria, apontando para um banco próprio.
 * Nenhum dos dois toca o ambiente de desenvolvimento de quem está trabalhando.
 */

loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined })

const PORTA = 3100
const BASE = `http://localhost:${String(PORTA)}`

const desenvolvimento = process.env.DATABASE_URL ?? ''

export default defineConfig({
  testDir: './e2e',
  // O preparo do banco é caro e comum a todos; os testes leem a mesma massa e
  // só o do painel escreve. Serial evita que dois lançamentos concorrentes
  // disputem a mesma Tentativa e transformem RF-25 em teste instável.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/apoio/global.ts',

  use: {
    baseURL: BASE,
    // Rastro só do que falhou: guardar o de tudo enche o disco e ninguém abre.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'desktop',
      // A tela pequena tem projeto próprio, com a largura de RNF-18. Sem esta
      // exclusão ela rodaria duas vezes: uma em 360 px e outra em 1280, onde a
      // asserção é verdadeira por acidente e não prova nada.
      testIgnore: /telaPequena[.]spec[.]ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // RNF-18 diz "operável em tela de celular", e a verificação do PRD diz
      // 360 px sem rolagem horizontal. É a largura de um Galaxy A-alguma-coisa,
      // que é o aparelho que vai aparecer no evento.
      name: 'celular-360',
      testMatch: /telaPequena\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
    },
  ],

  webServer: {
    command: `npx next dev --port ${String(PORTA)}`,
    // **Prontidão medida numa página que não toca o banco.** A tentação é usar
    // `/api/saude`, e ela custou uma hora: o Playwright sobe o `webServer` e
    // espera por ele **antes** de rodar o `globalSetup` — que é justamente
    // quem cria o banco do e2e. Com a sondagem como alvo, o servidor
    // respondia 503 por não existir ainda o banco que ele só teria depois, e a
    // suíte morria no tempo limite sem nunca ter começado.
    //
    // `/termo` é estática e não abre conexão: responde assim que o processo
    // serve, que é exatamente o que "pronto" quer dizer aqui.
    url: `${BASE}/termo`,
    reuseExistingServer: process.env.CI === undefined,
    // O primeiro acesso compila a rota; num computador frio isso passa de um
    // minuto, e um tempo limite curto faz a suíte falhar por partida lenta.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: desenvolvimento === '' ? '' : urlDoBancoE2E(desenvolvimento),
      // O limite de taxa existe para conter abuso, não para conter uma suíte
      // que faz seis cadastros em dez segundos do mesmo endereço (D-27 deu a
      // alavanca justamente para isso).
      RATE_LIMIT_ATIVO: 'false',
      // O formulário recusa envio em menos de três segundos como sinal de robô
      // (RNF-12). Um navegador dirigido por teclado preenche em menos que isso.
      FORMULARIO_SEGUNDOS_MINIMOS: '0',
    },
  },
})
