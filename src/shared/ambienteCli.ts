import { loadEnvConfig } from '@next/env'

/**
 * Carrega o `.env` para os comandos de terminal.
 *
 * O `next dev` e o `next start` fazem isso sozinhos; `tsx` não. Sem esta
 * chamada, `npm run db:migrate`, `npm run db:seed` e `npm run criar-operador`
 * morrem na validação de ambiente reclamando de `DATABASE_URL` — mesmo com o
 * arquivo ali, ao lado, cheio.
 *
 * Descoberto em T08, ao rodar o CLI de criação de Operador pela primeira vez. A
 * falha atingia igualmente os comandos de T02; quem os usou até aqui exportou
 * as variáveis à mão, o que funciona e esconde o problema de quem chegar depois.
 *
 * `@next/env` em vez de `dotenv`: é a mesma implementação que a aplicação usa,
 * já vem instalada com o Next, e respeita a mesma ordem de arquivos
 * (`.env.local`, `.env.{ambiente}`, `.env`). Um segundo carregador com regras
 * próprias faria o comando enxergar uma configuração e a aplicação, outra.
 *
 * Só para comandos de terminal. A aplicação não importa este módulo.
 */
export function carregarAmbienteDoTerminal(): void {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', {
    // O carregador do Next fala no console a cada arquivo lido. Num comando de
    // uma linha isso é ruído; o que interessa é o resultado.
    info: () => undefined,
    error: (...args: unknown[]) => {
      console.error(...args)
    },
  })
}
