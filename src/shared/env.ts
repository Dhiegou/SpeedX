import { z } from 'zod'

/**
 * Configuração de ambiente, validada uma única vez na inicialização.
 *
 * Falhar aqui é barato: acontece no boot, com a mensagem nomeando a variável.
 * Falhar mais tarde é caro — o PRD lembra que o evento dura um dia e não há
 * janela de manutenção (§2). Nenhum outro módulo lê `process.env` diretamente.
 *
 * A validação é preguiçosa e memoizada, não executada no import: assim o
 * módulo pode ser testado com entradas sintéticas e não explode se acabar
 * alcançado por um bundle onde `process.env` não existe.
 * Quem força a validação no boot é `instrumentation.ts`.
 */
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // O `error` cobre o caso da variável ausente. Sem ele, a mensagem que chega
  // ao operador é a genérica do Zod ("expected string, received undefined"),
  // que diz qual variável falhou mas não o que fazer a respeito.
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL é obrigatória: a conexão com o PostgreSQL. Ver .env.example.' })
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'DATABASE_URL deve ser uma URL PostgreSQL (postgres:// ou postgresql://).',
    }),

  SESSION_SECRET: z
    .string({
      error:
        'SESSION_SECRET é obrigatória: assina o cookie de sessão do Operador. Gere com `openssl rand -base64 48`.',
    })
    .min(32, 'SESSION_SECRET precisa de ao menos 32 caracteres para assinar a sessão do Operador.'),

  APP_URL: z.url({
    error: 'APP_URL é obrigatória e deve ser absoluta — ela vira o destino do QR code (RF-01).',
  }),

  // Limite de cadastros por IP (RNF-12). Os padrões são deliberadamente folgados:
  // no local do evento dezenas de celulares saem do mesmo IP por NAT, e em rede
  // móvel a operadora coloca milhares de assinantes atrás do mesmo endereço. Um
  // limite apertado não impede ataque nenhum e bloqueia participante legítimo,
  // que é o custo mais caro que este sistema pode pagar (RNF-15, PRD §7).
  // Calibrar em T18, decidir em T21 — ver D-27 no CONTEXT.md.
  RATE_LIMIT_CADASTROS_POR_JANELA: z.coerce.number().int().positive().default(30),
  // Teto de um dia: `infra/higiene.ts` apaga marcas de limite com mais de 48 h,
  // e uma janela configurada acima disso faria a faxina remover contagem que o
  // limite ainda usaria. Um dia já é folgado para conter cadastro; dois dias
  // seriam um limite que não protege e se apaga sozinho.
  RATE_LIMIT_JANELA_SEGUNDOS: z.coerce.number().int().positive().max(86_400).default(600),
  RATE_LIMIT_CADASTROS_POR_HORA: z.coerce.number().int().positive().default(100),

  // Desligamento de emergência. Se no dia o limite começar a recusar gente de
  // verdade, precisa existir uma alavanca que não seja publicar código novo com
  // o ponto de inscrição em fila.
  RATE_LIMIT_ATIVO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /** Tempo mínimo de preenchimento do formulário (RNF-12, anti-automação). */
  FORMULARIO_SEGUNDOS_MINIMOS: z.coerce.number().int().nonnegative().default(3),

  // --- Sessão do Operador (BC-04, T08) ---
  //
  // Dezesseis horas cobrem a jornada inteira do evento com folga. O número não
  // é conforto: um Operador deslogado no meio do dia para a fila do Pitch
  // enquanto redigita a senha em tablet, e RNF-16 dá quinze segundos para um
  // lançamento inteiro. A renovação silenciosa desloca o prazo enquanto o
  // painel é usado; este teto é o que vale para quem logou e ficou parado.
  SESSAO_HORAS: z.coerce.number().int().positive().default(16),

  // De quanto em quanto tempo a renovação chega a gravar. Renovar a cada
  // requisição seria um UPDATE por chamada do painel sem nada em troca: o que
  // interessa é que a sessão não morra com o Operador trabalhando, e para isso
  // basta empurrar o prazo algumas vezes por hora.
  SESSAO_RENOVACAO_MINUTOS: z.coerce.number().int().positive().default(30),

  // Limite de tentativas de login (RNF-14 na prática: sem auto-cadastro, a
  // única porta é a senha). Ao contrário do limite de cadastro, aqui conta a
  // tentativa **recusada**, e o desligamento de emergência RATE_LIMIT_ATIVO
  // não o alcança — destravar a fila de inscrição não pode destravar força
  // bruta contra o painel.
  LOGIN_TENTATIVAS_POR_JANELA: z.coerce.number().int().positive().default(10),
  LOGIN_JANELA_SEGUNDOS: z.coerce.number().int().positive().max(43_200).default(900),

  TELEMETRY_URL: z.union([z.url(), z.literal('')]).default(''),
})

export type Ambiente = z.infer<typeof esquema>

/** Erro de configuração. Distinto de erro de domínio: não é o usuário que erra aqui. */
export class ConfiguracaoInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ConfiguracaoInvalidaError'
  }
}

/** Valida uma fonte de variáveis. Exposta para teste; em produção, use `env()`. */
export function validarAmbiente(fonte: unknown): Ambiente {
  const resultado = esquema.safeParse(fonte)

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n')

    throw new ConfiguracaoInvalidaError(
      `Configuração de ambiente inválida. Corrija antes de subir a aplicação:\n${problemas}\n\n` +
        'Referência: .env.example',
    )
  }

  return resultado.data
}

let memo: Ambiente | undefined

/** Ambiente validado. Primeira chamada valida; as demais reaproveitam. */
export function env(): Ambiente {
  memo ??= validarAmbiente(process.env)
  return memo
}

/** Verdadeiro em produção. Usado para exigir TLS e esconder detalhe de erro. */
export function emProducao(): boolean {
  return env().NODE_ENV === 'production'
}
