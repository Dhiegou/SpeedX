import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

/**
 * Cabeçalhos de segurança, em toda resposta (T19 §2).
 *
 * A plataforma entrega TLS e redireciona HTTP para HTTPS sozinha (D-76); o que
 * ela não faz é dizer ao navegador para nunca mais tentar a porta 80. Isso é
 * HSTS, e é código — por isso mora aqui, onde o repositório o guarda, e não
 * numa caixa de texto do painel do provedor que ninguém revisa.
 */
const SEGURANCA = [
  // O painel do Operador não é para ser embutido em lugar nenhum. Os dois
  // cabeçalhos dizem a mesma coisa para gerações diferentes de navegador.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },

  // A Exportação devolve CSV com dado pessoal (T14). Sem isto, um navegador
  // que resolva adivinhar o tipo pode tratá-lo como algo executável.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // O QR leva a uma URL com dado nenhum, mas a página do painel tem
  // identificador de Tentativa no caminho. Não vaza para terceiro.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Este sistema é um formulário e uma tabela. Nada aqui precisa de câmera,
  // microfone ou localização, e negar é mais barato que auditar depois.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/**
 * HSTS: 180 dias, sem `preload`.
 *
 * A recomendação de manual é dois anos com `preload`, e ela pressupõe um site
 * que continua existindo. Este não continua: o termo de consentimento promete
 * que o site sai do ar dez dias depois do evento (D-22), o que dá 4 de novembro
 * de 2026. Entrar na lista de pré-carga é fácil e sair leva meses — deixaríamos
 * um domínio morto marcado nos navegadores do mundo, e quem o registrasse
 * depois herdaria a marca. Cento e oitenta dias cobrem com folga a vida do
 * site e vencem sozinhos.
 */
const HSTS = { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:caminho*',
        // Em desenvolvimento o servidor é HTTP e o navegador ignoraria o HSTS
        // de qualquer forma — mas gravar `localhost` como somente-HTTPS quebra
        // outros projetos na mesma máquina, e isso não é hipótese.
        headers: process.env.NODE_ENV === 'production' ? [...SEGURANCA, HSTS] : SEGURANCA,
      },
    ]
  },

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
