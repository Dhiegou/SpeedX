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
const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // O `error` cobre o caso da variável ausente. Sem ele, a mensagem que chega
    // ao operador é a genérica do Zod ("expected string, received undefined"),
    // que diz qual variável falhou mas não o que fazer a respeito.
    DATABASE_URL: z
      .string({
        error: 'DATABASE_URL é obrigatória: a conexão com o PostgreSQL. Ver .env.example.',
      })
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message: 'DATABASE_URL deve ser uma URL PostgreSQL (postgres:// ou postgresql://).',
      }),

    /**
     * Conexão **direta**, sem o pooler. Opcional, e nenhuma requisição a usa.
     *
     * Existe para as migrações. O PgBouncer em modo transação — que é quem
     * responde no host `-pooler` do provedor — não repassa
     * `CREATE INDEX CONCURRENTLY` nem bloqueio de sessão, e uma migração que
     * precise de um dos dois falha no meio, com metade do esquema aplicado.
     *
     * `docs/deploy.md` §3 e o `.env.example` já mandavam migrar pela direta.
     * Até aqui isso dependia de alguém lembrar de trocar a variável na hora, e
     * `src/db/migrate.ts` lia `DATABASE_URL` — a do pooler. Agora a escolha é
     * do código (D-80).
     *
     * A aplicação continua falando com o pooler, de propósito: o que impede
     * trinta instâncias efêmeras de pedirem trezentas conexões a um Postgres
     * que oferece cem é ele.
     */
    DATABASE_URL_UNPOOLED: z
      .string()
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message:
          'DATABASE_URL_UNPOOLED deve ser uma URL PostgreSQL (postgres:// ou postgresql://).',
      })
      .optional(),

    SESSION_SECRET: z
      .string({
        error:
          'SESSION_SECRET é obrigatória: assina o cookie de sessão do Operador. Gere com `openssl rand -base64 48`.',
      })
      .min(
        32,
        'SESSION_SECRET precisa de ao menos 32 caracteres para assinar a sessão do Operador.',
      ),

    APP_URL: z.url({
      error: 'APP_URL é obrigatória e deve ser absoluta — ela vira o destino do QR code (RF-01).',
    }),

    // Limite de cadastros por IP (RNF-12), calibrado em T23 sobre a medição de
    // T18. Os padrões são deliberadamente folgados: no local do evento dezenas de
    // celulares saem do mesmo IP por NAT, e em rede móvel a operadora coloca
    // milhares de assinantes atrás do mesmo endereço. Um limite apertado não
    // impede ataque nenhum e bloqueia participante legítimo, que é o custo mais
    // caro que este sistema pode pagar (RNF-15, PRD §7).
    //
    // **O padrão antigo de 30 recusava a fila do evento.** T18 rodou 200 cadastros
    // legítimos de um mesmo IP e o mecanismo aceitou exatamente 30: o 31º
    // participante levava 429 sem ter feito nada (`docs/relatorio-carga.md` §4).
    //
    // O número vale para o pior caso plausível, e não para a média: conectividade
    // mista (Wi-Fi do local, se houver, e dados móveis), com a concentração de
    // chegada **não confirmada** por quem organiza. Os dois caminhos convergem no
    // mesmo aperto — o Wi-Fi é um endereço só, e sem ele o CGNAT da operadora
    // também é. Ver D-90 no CONTEXT.md.
    RATE_LIMIT_CADASTROS_POR_JANELA: z.coerce.number().int().positive().default(800),
    // Teto de um dia: `infra/higiene.ts` apaga marcas de limite com mais de 48 h,
    // e uma janela configurada acima disso faria a faxina remover contagem que o
    // limite ainda usaria. Um dia já é folgado para conter cadastro; dois dias
    // seriam um limite que não protege e se apaga sozinho.
    RATE_LIMIT_JANELA_SEGUNDOS: z.coerce.number().int().positive().max(86_400).default(600),
    RATE_LIMIT_CADASTROS_POR_HORA: z.coerce.number().int().positive().default(2_400),

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
    // é conforto: um Operador deslogado no meio do dia para a fila do Cockpit
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

    /**
     * Tamanho do pool de conexões, por instância (T19 §5).
     *
     * O número que importa não é este: é ele multiplicado pelo número de
     * instâncias que a plataforma resolver acordar no pico. A aplicação roda em
     * funções efêmeras (D-76) e cada uma abre o próprio pool — trinta instâncias
     * a dez conexões pedem trezentas conexões a um Postgres gratuito que oferece
     * cem. O que evita esse limite é o **pooler** do provedor (D-80): a função
     * fala com o PgBouncer, não com o Postgres, e é ele que multiplexa.
     *
     * Cinco, e não um: a página da Classificação é `force-dynamic` e uma
     * instância pode atender mais de uma requisição ao mesmo tempo. Um pool de
     * um transformaria concorrência em fila dentro do processo.
     */
    DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(5),

    /**
     * Versão publicada, devolvida por `/api/saude` (T16 §1).
     *
     * Existe para responder "qual código está no ar agora" sem entrar na
     * máquina — a pergunta que se faz às onze da manhã do evento, quando o
     * comportamento não bate com o que se acabou de testar.
     *
     * Substituiu `TELEMETRY_URL`, declarada em T01 e nunca usada (D-66): o
     * transporte da telemetria deste sistema é a saída padrão, não um coletor
     * por HTTP.
     */
    APP_VERSION: z.string().optional(),

    /**
     * Identificador do commit publicado, injetado pela plataforma de deploy.
     *
     * Ninguém preenche esta variável à mão: quem a define é a Vercel, no build e
     * no runtime. Ela está declarada aqui só para virar `APP_VERSION` logo abaixo
     * — uma variável que o deploy já sabe responder é melhor do que uma que
     * alguém precisa lembrar de atualizar a cada publicação.
     */
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  })
  /**
   * `APP_VERSION` explícita vence; na falta dela, o commit publicado; na falta
   * dos dois, a resposta honesta.
   *
   * Sete caracteres porque é o que se lê em voz alta ao telefone no dia do
   * evento, e é o que o `git log --oneline` mostra do outro lado.
   */
  .transform((v) => ({
    ...v,
    APP_VERSION: v.APP_VERSION ?? v.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'desconhecida',
  }))

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
