import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Cada arquivo de banco sobe um Postgres em WebAssembly dentro do seu
    // processo, e o de escala popula 2000 participantes. Com a paralelização
    // padrão — um processo por núcleo — são doze cópias do motor ao mesmo tempo,
    // e a máquina fica sem memória no meio da suíte, derrubando um worker com
    // "Fatal process out of memory".
    //
    // Dois, e não três. O limite era três desde T02, mas escrito como
    // `poolOptions.forks`, que o Vitest 4 **removeu** — ele avisava a cada
    // execução e rodava com a paralelização padrão. O teto de memória que a
    // suíte pensava ter não existia; a T08 descobriu isso ao acrescentar dois
    // arquivos de banco e uma derivação de senha que reserva 64 MiB por
    // conferência, e ver um worker morrer de forma intermitente.
    maxWorkers: 2,

    // Os testes de banco sobem um Postgres em WebAssembly e populam milhares de
    // linhas; o de fronteiras carrega a configuração do ESLint. Os 5 s padrão
    // bastam isolados e estouram quando os arquivos rodam em paralelo.
    testTimeout: 30_000,
    hookTimeout: 300_000,
    // Ambiente sintético da suíte. Nada aqui é segredo e nada aqui é usado:
    // o banco dos testes é o PGlite de `tests/apoio/bancoDeTeste.ts`, e a
    // `DATABASE_URL` existe só porque `env()` valida a configuração inteira de
    // uma vez — sem ela, qualquer teste que assine um token de formulário
    // falharia reclamando de conexão que ninguém vai abrir.
    //
    // O `SESSION_SECRET` fixo é o que torna os testes de HMAC determinísticos.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://teste:teste@localhost:5432/teste',
      SESSION_SECRET: 'segredo-sintetico-de-teste-com-mais-de-32-caracteres',
      APP_URL: 'http://localhost:3000',
    },
  },
})
