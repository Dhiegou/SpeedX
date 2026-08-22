import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,

  // O projeto vive sob OneDrive, e sem isto o Next infere a raiz como o
  // diretório do usuário, ignora o package-lock e rastreia arquivos de fora
  // do projeto. Fixar a raiz mantém o pacote de deploy previsível.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),

  // O cabeçalho revela a versão do framework sem entregar nada em troca.
  poweredByHeader: false,

  // RNF-04: a página de cadastro precisa carregar em rede móvel ruim.
  compress: true,

  typescript: {
    // Build quebra se o tipo quebrar. Não existe "ignorar por enquanto".
    ignoreBuildErrors: false,
  },

  // Next 16 não roda mais ESLint durante o build; quem barra o lint é o
  // script `check` e o CI (.github/workflows/ci.yml).
}

export default config
