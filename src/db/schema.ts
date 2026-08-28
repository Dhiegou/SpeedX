import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Esquema de dados.
 *
 * Princípio que guia este arquivo: **as invariantes caras moram no banco.**
 *
 * RF-12 permite Operadores simultâneos. Sob concorrência, verificar em
 * aplicação é insuficiente por construção — entre o SELECT que confere e o
 * INSERT que grava existe uma janela, e três lançamentos por minuto durante dez
 * horas é tempo de sobra para alguém cair nela. O banco recusar é a única
 * garantia que não depende de ordem de execução.
 */

export const estadoTentativa = pgEnum('estado_tentativa', ['pendente', 'valida', 'ausente'])

export const tipoLancamento = pgEnum('tipo_lancamento', ['registro', 'correcao', 'ausencia'])

// ---------------------------------------------------------------------------
// BC-01 Inscrição
// ---------------------------------------------------------------------------

export const participante = pgTable(
  'participante',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    sobrenome: text('sobrenome').notNull(),
    email: text('email').notNull(),
    /** Somente dígitos. Os últimos quatro são derivados na leitura (RF-15). */
    telefone: text('telefone').notNull(),
    idade: smallint('idade').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // RF-04: idade inferior a 13 não produz Participante. No banco, porque é
    // requisito legal — não pode depender de qual caminho de código gravou.
    check('participante_idade_minima', sql`${t.idade} >= 13`),
    check('participante_idade_plausivel', sql`${t.idade} <= 120`),
    check('participante_telefone_digitos', sql`${t.telefone} ~ '^[0-9]{10,11}$'`),
    // Busca do painel (RF-16). Índice por prefixo, sem distinção de caixa.
    //
    // `text_pattern_ops` é obrigatório: um btree comum sobre lower(nome) não
    // serve para `LIKE 'jo%'` fora da collation C, e o planejador cai em
    // varredura sequencial. Sem isso o índice existe e não é usado.
    //
    // Limitação conhecida: cobre prefixo, não busca no meio do nome. Operador
    // digitando as primeiras letras — o uso real do painel — está atendido.
    // Busca por trecho no meio exigiria a extensão pg_trgm, decisão adiada para
    // T10, quando o provedor de banco estiver escolhido (PE-05).
    index('participante_nome_idx').on(sql`lower(${t.nome}) text_pattern_ops`),
    index('participante_sobrenome_idx').on(sql`lower(${t.sobrenome}) text_pattern_ops`),
  ],
)

/**
 * Responsável pelo Participante menor de 18 (RF-05, RNF-07).
 *
 * Relação 1:1 imposta pela unicidade da chave estrangeira. A regra "existe se e
 * somente se idade < 18" atravessa duas tabelas e não cabe em um CHECK de
 * coluna; ela é garantida pela transação de `registrarInscricao` (T04) e
 * verificada por teste.
 */
export const responsavel = pgTable(
  'responsavel',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participanteId: uuid('participante_id')
      .notNull()
      .unique()
      .references(() => participante.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    sobrenome: text('sobrenome').notNull(),
    telefone: text('telefone').notNull(),
  },
  (t) => [check('responsavel_telefone_digitos', sql`${t.telefone} ~ '^[0-9]{10,11}$'`)],
)

/**
 * Consentimento registrado (RF-08, RF-09).
 *
 * `versaoTermo` referencia a versão publicada em T03: o texto exato que a
 * pessoa aceitou precisa ser reconstituível anos depois, e não adianta guardar
 * "aceitou" sem guardar "aceitou o quê".
 */
export const consentimento = pgTable(
  'consentimento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participanteId: uuid('participante_id')
      .notNull()
      .unique()
      .references(() => participante.id, { onDelete: 'cascade' }),
    versaoTermo: text('versao_termo').notNull(),
    aceiteParticipante: boolean('aceite_participante').notNull(),
    /** Nulo para maiores de idade; obrigatoriamente verdadeiro para menores (RNF-07). */
    aceiteResponsavel: boolean('aceite_responsavel'),
    /**
     * Autorização **opcional** para repassar o telefone à FIAP e à escolinha
     * (D-22, D-23). Diferente dos dois acima, `false` é um valor legítimo: quem
     * recusa se inscreve normalmente, e é justamente esse "não" que precisa
     * ficar registrado. Por isso não há `check` obrigando `true` aqui.
     *
     * Padrão `false` porque ausência de autorização é recusa, nunca permissão.
     */
    aceiteCompartilhamento: boolean('aceite_compartilhamento').notNull().default(false),
    registradoEm: timestamp('registrado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Uma linha de consentimento com aceite falso não é consentimento; é ruído
    // capaz de fazer um cadastro inválido parecer válido em auditoria.
    check('consentimento_aceite_verdadeiro', sql`${t.aceiteParticipante} = true`),
    check(
      'consentimento_responsavel_nunca_falso',
      sql`${t.aceiteResponsavel} is null or ${t.aceiteResponsavel} = true`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// BC-04 Identidade e Acesso
// ---------------------------------------------------------------------------

export const operador = pgTable(
  'operador',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuario: text('usuario').notNull().unique(),
    nome: text('nome').notNull(),
    senhaHash: text('senha_hash').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // O login compara sem distinção de caixa — um Operador com pressa não pode
    // ser recusado por uma maiúscula. Sem esta unicidade funcional, `Marina` e
    // `marina` conviveriam como contas distintas e a busca do login casaria
    // com as duas, escolhendo uma por acaso. A regra vive no banco porque é a
    // única forma de ela não depender de qual caminho de código criou a conta.
    uniqueIndex('operador_usuario_minusculo_idx').on(sql`lower(${t.usuario})`),
  ],
)

/**
 * Sessão do Operador (RF-11, RF-12, T08).
 *
 * Sessão no banco, e não um cookie autocontido assinado. Um token assinado é
 * mais barato — nenhuma consulta por requisição — e paga isso com a única coisa
 * que este sistema não pode abrir mão: **revogação**. Um cookie assinado
 * continua valendo até expirar, e a expiração aqui é de dezesseis horas, o
 * evento inteiro. Desativar um Operador (`operador.ativo`) ou clicar em sair
 * não teria efeito nenhum, e quem assina Lançamentos com autoria registrada
 * (RF-23) precisa poder deixar de assinar no instante em que a organização
 * decide isso.
 *
 * O custo é uma consulta indexada por requisição autenticada. O painel é
 * operado por um punhado de pessoas a poucos lançamentos por minuto — a conta é
 * irrelevante, e as duas mil pessoas do cadastro público nunca passam por aqui.
 *
 * **O token não é gravado.** O que fica é o HMAC dele. Um vazamento da tabela
 * não entrega sessão viva a ninguém, do mesmo jeito que `senha_hash` não
 * entrega senha.
 */
export const sessao = pgTable(
  'sessao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operadorId: uuid('operador_id')
      .notNull()
      .references(() => operador.id, { onDelete: 'cascade' }),
    /** HMAC do token que viaja no cookie. Ver `identidade/sessao.ts`. */
    tokenHash: text('token_hash').notNull().unique(),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    /** Move com a renovação silenciosa. É o que diz se a sessão está em uso. */
    ultimoUsoEm: timestamp('ultimo_uso_em', { withTimezone: true }).notNull().defaultNow(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    /**
     * Preenchido no logout explícito. A linha permanece: saber que a sessão foi
     * encerrada, e quando, vale mais do que economizar a linha — e apagar
     * histórico de acesso é o oposto do que RF-23 pede do painel.
     */
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
  },
  (t) => [
    // A consulta de toda requisição autenticada é por `token_hash`, já coberta
    // pelo índice único. Este serve ao expurgo por idade (T15).
    index('sessao_expira_em_idx').on(t.expiraEm),
    // RF-12: sessões simultâneas do mesmo Operador são legítimas — este índice
    // existe para listá-las e encerrá-las em conjunto, não para restringi-las.
    index('sessao_operador_idx').on(t.operadorId),
  ],
)

// ---------------------------------------------------------------------------
// BC-02 Cronometragem
// ---------------------------------------------------------------------------

/**
 * Tentativa — agregado raiz da Cronometragem.
 *
 * Carrega o Cockpit, e não o Participante, porque a mesma pessoa pode disputar
 * os dois (RF-03, RF-24). Nasce Pendente na Inscrição.
 */
export const tentativa = pgTable(
  'tentativa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participanteId: uuid('participante_id')
      .notNull()
      .references(() => participante.id, { onDelete: 'cascade' }),
    cockpit: smallint('cockpit').notNull(),
    estado: estadoTentativa('estado').notNull().default('pendente'),
    /** Milissegundos. Presente se e somente se o estado for `valida`. */
    tempoMs: integer('tempo_ms'),
    inscritoEm: timestamp('inscrito_em', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Instante do Lançamento original — do relógio do **servidor**, nunca do
     * dispositivo do Operador (SDD FL-10). É o critério de desempate (RF-31), e
     * por isso **não** é alterado por correção de tempo (RF-22): senão uma
     * correção administrativa mudaria a posição de terceiros.
     */
    resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
    operadorId: uuid('operador_id').references(() => operador.id, { onDelete: 'restrict' }),
  },
  (t) => [
    // RF-25: no máximo um tempo por Participante por Cockpit. Esta linha é a
    // única forma de a regra sobreviver a dois operadores lançando juntos.
    unique('tentativa_participante_cockpit_unica').on(t.participanteId, t.cockpit),

    check('tentativa_cockpit_valido', sql`${t.cockpit} in (1, 2)`),

    // Válida sempre possui Tempo; Pendente e Ausente nunca possuem (SDD BC-02).
    check(
      'tentativa_tempo_coerente_com_estado',
      sql`(${t.estado} = 'valida') = (${t.tempoMs} is not null)`,
    ),
    check('tentativa_tempo_positivo', sql`${t.tempoMs} is null or ${t.tempoMs} > 0`),

    // RF-23: toda transição registra Operador e instante. Pendente é o único
    // estado sem autoria, porque ninguém agiu sobre ela ainda.
    //
    // São duas condições independentes, e não uma conjunção. A primeira versão
    // deste esquema usava `= (operador_id is null and resolvido_em is null)`, o
    // que aceitava uma Tentativa Válida com instante preenchido e operador nulo:
    // os dois lados davam `false` e a comparação passava. Uma tentativa resolvida
    // sem autoria é exatamente o que RF-23 existe para impedir.
    check(
      'tentativa_autoria_coerente_com_estado',
      sql`(${t.estado} = 'pendente') = (${t.operadorId} is null)`,
    ),
    check(
      'tentativa_resolucao_coerente_com_estado',
      sql`(${t.estado} = 'pendente') = (${t.resolvidoEm} is null)`,
    ),

    // Fila do painel: pendentes de um Cockpit, da inscrição mais antiga para a
    // mais recente (RF-14).
    index('tentativa_fila_idx').on(t.cockpit, t.estado, t.inscritoEm),

    // Classificação: tempo crescente, desempate pelo lançamento mais antigo
    // (RF-31). Cobre a leitura da projeção sem tocar na tabela.
    index('tentativa_classificacao_idx').on(t.tempoMs, t.resolvidoEm),
  ],
)

/**
 * Trilha de auditoria de Lançamentos (RF-23) — **append-only**.
 *
 * Nunca sofre UPDATE nem DELETE: correção gera linha nova, não altera a
 * anterior. O PRD lista "contestação de resultado que o sistema não consiga
 * esclarecer" como contraindicador; esta tabela é a resposta a isso.
 *
 * Distinção de vocabulário (SDD §3): Lançamento é o ato, Tempo é o valor.
 * RF-23 rastreia Lançamentos.
 */
export const lancamento = pgTable(
  'lancamento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tentativaId: uuid('tentativa_id')
      .notNull()
      .references(() => tentativa.id, { onDelete: 'cascade' }),
    tipo: tipoLancamento('tipo').notNull(),
    tempoMsAnterior: integer('tempo_ms_anterior'),
    tempoMsNovo: integer('tempo_ms_novo'),
    operadorId: uuid('operador_id')
      .notNull()
      .references(() => operador.id, { onDelete: 'restrict' }),
    /** Relógio do servidor, sempre. Ver SDD FL-10. */
    ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cada tipo de lançamento tem uma forma própria; um registro sem valor novo
    // ou uma correção sem valor anterior é auditoria que não explica nada.
    check(
      'lancamento_valores_coerentes_com_tipo',
      sql`
        (${t.tipo} = 'registro'  and ${t.tempoMsNovo} is not null and ${t.tempoMsAnterior} is null) or
        (${t.tipo} = 'correcao'  and ${t.tempoMsNovo} is not null and ${t.tempoMsAnterior} is not null) or
        (${t.tipo} = 'ausencia'  and ${t.tempoMsNovo} is null     and ${t.tempoMsAnterior} is null)
      `,
    ),
    index('lancamento_tentativa_idx').on(t.tentativaId, t.ocorridoEm),
  ],
)

// ---------------------------------------------------------------------------
// Infraestrutura de aplicação
// ---------------------------------------------------------------------------

/**
 * Idempotência de escrita (SDD §4.3, fluxos FL-03 e FL-06).
 *
 * Confiabilidade de transporte garante entrega, não unicidade de efeito: se a
 * confirmação se perde no retorno, o Operador reenvia e a operação executa duas
 * vezes. A chave e o efeito são gravados na **mesma transação** da escrita.
 */
export const chaveIdempotencia = pgTable(
  'chave_idempotencia',
  {
    chave: text('chave').primaryKey(),
    escopo: text('escopo').notNull(),
    resposta: jsonb('resposta').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Expurgo periódico por idade (T15).
    index('chave_idempotencia_criado_em_idx').on(t.criadoEm),
    uniqueIndex('chave_idempotencia_escopo_idx').on(t.chave, t.escopo),
  ],
)

/**
 * Consumo de limite de taxa (RNF-12, T05).
 *
 * Uma linha por operação **efetivada**, nunca por tentativa recusada: quem erra
 * a validação cinco vezes seguidas está preenchendo o formulário, não atacando
 * o sistema, e trancar essa pessoa fora contraria RNF-15 e a meta de conclusão
 * de 95% do PRD §7.
 *
 * Fica no banco, e não em memória do processo, por dois motivos: o provedor de
 * hospedagem ainda não está escolhido (PE-05) e pode executar mais de uma
 * instância, e um contador em memória zera a cada reinício — que é exatamente
 * quando um ataque mais compensa.
 *
 * `identificador` **nunca** guarda o IP em claro: entra o HMAC do endereço, com
 * chave derivada do segredo da aplicação. O limite continua funcionando, e o
 * que fica gravado não reidentifica ninguém (RNF-08).
 */
export const limiteTaxa = pgTable(
  'limite_taxa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Qual operação foi consumida: `cadastro` em T05, login em T08. */
    escopo: text('escopo').notNull(),
    /** HMAC do IP de origem. Ver `limiteDeTaxa.ts`. */
    identificador: text('identificador').notNull(),
    ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A consulta da janela deslizante: escopo + identificador, recortado por
    // instante. A ordem das colunas é a da igualdade primeiro, faixa por
    // último — invertida, o índice deixa de servir ao recorte.
    index('limite_taxa_janela_idx').on(t.escopo, t.identificador, t.ocorridoEm),
    // Expurgo por idade (T15): nada aqui sobrevive ao evento.
    index('limite_taxa_ocorrido_em_idx').on(t.ocorridoEm),
  ],
)
