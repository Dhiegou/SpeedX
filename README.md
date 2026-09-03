# SpeedX — Cadastro e Classificação de Corrida

Sistema de inscrição, cronometragem e classificação pública para um evento presencial de corrida de simulador de um dia — **24 de outubro de 2026, em São Paulo** —, com dois Cockpits e 2000+ participantes. Substitui a ficha em papel e a planilha de resultados por um fluxo digital ponta a ponta: o participante se inscreve pelo celular escaneando um QR code, o Operador lança o tempo assim que a corrida termina, e a classificação fica pública e atualizada durante todo o evento.

> **Estado:** trilha de Inscrição fechada (T01–T07) e acesso do Operador em pé (T08). Ver [Estado do projeto](#estado-do-projeto).

---

## Documentos

| Documento | Responde |
|---|---|
| [PRD.md](PRD.md) | O que o produto faz — personas, casos de uso, requisitos funcionais e não funcionais, métricas de sucesso |
| [SDD.md](SDD.md) | Por que a arquitetura é essa — bounded contexts, linguagem ubíqua, transporte por fluxo, modos de falha |
| [.claude/tasks/](.claude/tasks/README.md) | Como será construído — 21 tarefas com dependências, escopo e critérios de aceitação |
| [CONTEXT.md](CONTEXT.md) | O raciocínio por trás das decisões, premissas assumidas e pendências abertas |
| [.claude/skills/](.claude/skills/) | Regras de manutenção deste repositório (ver abaixo) |

### Skills

Instruções de processo que valem para qualquer pessoa ou agente trabalhando neste repositório:

- [`.claude/skills/documentar-contexto.md`](.claude/skills/documentar-contexto.md) — toda decisão, premissa ou mudança de rumo é registrada no `CONTEXT.md`.
- [`.claude/skills/manter-readme.md`](.claude/skills/manter-readme.md) — este README é atualizado na mesma mudança que o tornaria desatualizado.

---

## Stack

Definida em [T01](.claude/tasks/task-01-fundacao-do-projeto.md) como premissa — nem o PRD nem o SDD fixam tecnologia. As demais tasks descrevem comportamento, não framework.

| Peça | Versão | Por quê |
|---|---|---|
| Next.js (App Router) | 16.3 | Execução no servidor por padrão: nenhuma consulta a dados parte do navegador |
| React | 19.2 | — |
| TypeScript | 6.0, modo estrito | `noUncheckedIndexedAccess` incluído: as invariantes de T04 e T09 precisam ser verificáveis em tipo |
| Zod | 4.4 | Mesmo esquema no cliente e no servidor, sempre revalidado no servidor |
| ESLint | 9.39, flat config | Fronteiras entre contextos impostas por lint, não por convenção |
| Prettier | 3.9 | Formatação verificada no CI |
| Vitest | 4.1 | Unidade e integração |
| Drizzle ORM + drizzle-kit | 0.45 / 0.31 | Esquema em código, migração SQL versionada e revisável |
| node-postgres (`pg`) | 8.23 | Driver de produção |
| PGlite | 0.5 | PostgreSQL 18.3 em WebAssembly para os testes: constraints reais, sem serviço externo |
| PostgreSQL | **18** | Consistência forte para Inscrição e Cronometragem. A versão não é preferência: é a que o PGlite 0.5.5 executa nos testes (`select version()` → 18.3), e produção precisa casar com ela |
| Playwright | 1.62 | End-to-end, incluindo o fluxo só por teclado (T17) |
| Artillery | 2.x (T18) | 500 acessos concorrentes à classificação, pico de cadastro e escrita simultânea |
| Hospedagem com HTTP/3 | **Vercel**, plano gratuito, funções em `gru1` (D-76, D-79) | Exigido pelos fluxos FL-02 e FL-07 do SDD. A borda anuncia HTTP/3; falta o `curl --http3` contra um domínio que ainda não existe |
| Banco em produção | **Neon**, gratuito, `aws-sa-east-1` (D-79) | Mesma cidade das funções: a Classificação é `force-dynamic`, então cada primeira pintura atravessa essa distância |
| Monitor externo | **UptimeRobot**, gratuito (D-82) | Só algo de fora distingue "caiu" de "estava tranquilo". A configurar quando houver domínio |

---

## Estrutura de pastas

```
src/
  contexts/
    inscricao/        # BC-01 — regra jurídica: idade, consentimento, responsável
      contrato.ts     #   published language: o único que Cronometragem enxerga
      schema.ts       #   validação e união discriminada por idade (T04)
      idades.ts       #   as três idades, sem dependência: a UI lê sem carregar Zod
      erros.ts        #   erro estruturado { campo, codigo, mensagem } (RNF-17)
      registrarInscricao.ts # caso de uso: valida e grava em transação (T04)
      submeterInscricao.ts  # borda: idempotência, limite, honeypot, token (T05)
      limiteDeTaxa.ts #   a política do cadastro; o mecanismo mora em infra/
      tokenFormulario.ts #  carimbo de hora assinado contra envio automatizado
      servico.ts      #   composição: a única porta do contexto que abre o banco
      consentimento/  #   termo versionado (T03): um arquivo por versão publicada
        modelo.ts     #     forma do termo e seções exigidas por RF-09
        integridade.ts#     hash do conteúdo por versão; usa node:crypto, fora da fachada
    cronometragem/    # BC-02 — agregado Tentativa, máquina de estados, autoria
      modelo.ts       #   o vocabulário de BC-02 em tipos
      maquinaDeEstados.ts # as transições como tabela; `carimbaResolucao` é RF-31
      lancamento.ts   #   registrar, corrigir e ausentar: trava, auditoria, idempotência
      adicionarTentativa.ts # RF-24, com as recusas decididas pelo banco
      consultas.ts    #   a Fila (RF-14/15/16) e a trilha de auditoria (RF-23)
    classificacao/    # BC-03 — modelo SEM e-mail, telefone, idade ou dado de responsável
      modelo.ts       #   tipo fechado da linha pública
      nomePublico.ts  #   maior: "Dhiego Ferreira"; menor de 18: "Lucas M." (RNF-09)
      documento.ts    #   o que atravessa a rede: menos campos que o modelo (D-57)
      projecao.ts     #   único ponto do contexto autorizado a ler o banco —
                      #     e, por isso, também o que compõe: não há servico.ts aqui
    identidade/       # BC-04 — autenticação de Operador (T08)
      modelo.ts       #   `{ id, nome }`: tudo o que os outros contextos conhecem
      senha.ts        #   scrypt; recusa e acerto custam o mesmo tempo
      sessao.ts       #   sessão no banco; o cookie leva só um número aleatório
      autenticar.ts   #   caso de uso do login: limite, senha, sessão
      politicaDeLogin.ts # faixas por origem e por conta
      criarOperador.ts#   criação e desativação — sem rota, só CLI (RNF-14)
      servico.ts      #   composição: banco, cookie e as duas guardas de acesso
    custodia/         # BC-05 — único autorizado a cruzar dado pessoal com resultado
      csv.ts          #   separador, BOM e escape — inclusive contra fórmula (D-60)
      consultas.ts    #   o cruzamento autorizado, lido em lotes por cursor
      exportacao.ts   #   os três documentos: completa, repasse e pendências
      retencao.ts   #   o prazo de 10 dias, ancorado em 24/10/2026 (RNF-11)
      expurgo.ts    #   expurgo total, exclusão a pedido e o resumo que sobrevive
      metricas.ts   #   o painel do dia: contagens que atravessam BC-01 e BC-02
  infra/            # abaixo dos contextos: fala com o banco, não conhece domínio
    limiteDeTaxa.ts   # janela deslizante; Inscrição e Identidade passam a política
    idempotencia.ts   # chave + digestão do envio; Inscrição e Cronometragem usam
    higiene.ts        # apaga chave e marca de limite com mais de 48 h, sem agendador
    saude.ts          # sondagem do banco com prazo; distingue lento de pendurado
  shared/
    env.ts            # configuração validada; ninguém mais lê process.env
    ambienteCli.ts    # carrega o .env nos comandos de terminal (tsx não faz sozinho)
    argumentos.ts     # leitura de `--chave valor`; os dois CLIs usam o mesmo
    tempo.ts          # única conversão entre `mm:ss.cc` e milissegundos
    log.ts            # registro estruturado; forma fechada e texto livre saneado
    metricas.ts       # percentis, relatórios e alertas — a leitura do log (T16)
    texto.ts          # normalização de acento; o painel e a classificação usam a mesma
    requisicao.ts     # leitura de Content-Type e do endereço de origem
    vocabulario.ts    # "Cockpit" numa constante só, com gênero (D-75, D-31, T22)
    qr.ts             # tamanho mínimo de impressão do QR por distância de leitura
  db/
    schema.ts         # tabelas, constraints e índices
    migrations/       # SQL versionado pelo drizzle-kit (0000 inicial, 0001 repasse
                      #   opcional, 0002 limite de taxa, 0003 sessão do Operador)
    seed.ts           # massa determinística com homônimos, menores e empates
    index.ts          # pool e cliente Drizzle (só servidor)
app/                  # rotas
  page.tsx            #   formulário de inscrição — a raiz é o destino do QR
  _componentes/       #   componentes de cliente; `_` mantém fora do roteamento
  painel/
    login/            #   tela de login — fora do grupo protegido, senão dá laço
    (protegido)/      #   grupo invisível na URL cujo layout exige sessão (RF-11)
      fluxo.ts        #     a máquina de estados do lançamento; RF-18 é provada nela
      mascaraDeTempo.ts #   `12345` vira `01:23.45` sem tirar a mão do teclado
      api.ts          #     chamadas a T10; rede caída ≠ recusa do servidor
      Painel.tsx      #     a tela que o Operador usa por dez horas
  api/painel/sessao/  #   POST entra, DELETE sai, GET diz quem está logado
tests/                # testes que atravessam módulos (ex.: fronteiras de contexto)
  rastreabilidade.test.ts # lê o PRD e exige um teste, ou uma justificativa, por requisito
e2e/                  # ponta a ponta com Playwright: teclado, confirmação, 360 px (T17)
perf/                 # preparo, cenários de carga e medidor (T18)
scripts/
  gerar-qr.ts         # QR do ponto de inscrição, nível H, vetorial (T07)
  orcamento.mjs       # orçamento de peso do primeiro carregamento (T07)
  criar-operador.ts   # único caminho que cria conta de Operador (T08, RNF-14)
  operador-sql.ts     # o mesmo INSERT, sem banco, para rede que bloqueia a 5432
  expurgar.ts         # o único comando que apaga dados; ensaia por padrão (T15)
  metricas.ts         # lê o log e devolve métricas, metas e alertas (T16)
docs/
  sinalizacao.md      # especificação do material impresso: tamanhos, regras, URL (T07)
  qr/inscricao.svg    # o QR gerado; o destino fica escrito dentro do arquivo
  aprovacao-termo.md  # checklist de RF-09 e registro da aprovação do organizador (T03)
  retencao.md         # prazo, quem executa e o passo a passo do expurgo (T15)
  monitoramento.md    # o que observar no dia, limiares e canal de alerta (T16)
  testes.md           # o mapa da suíte e o que só se verifica com gente (T17)
  deploy.md           # onde roda, o que verificar e como desligar no fim (T19)
  plano-do-dia.md     # uma página, para imprimir: quem acionar e o que fazer (T19)
  relatorio-carga.md  # números medidos: leitura, escrita, cadastro, índices (T18)
  contingencia.md     # o que fazer quando a internet cai; para imprimir (T20)
  contingencia/       # ficha, termo e folha de tempos, prontos para impressão (T20)
  o-que-falta-para-voce.md # a lista prática do que depende de decisão e de gente
  checklist-pre-evento.md # a auditoria de privacidade, com evidência item a item (T21)
                      # contingência, relatórios e checklist chegam com suas tasks
.claude/
  tasks/              # plano de execução (21 tarefas + índice)
  skills/             # regras de manutenção do repositório
```

**Regra de fronteira, imposta por lint** (`eslint.config.mjs`): `classificacao/` não importa nenhum outro contexto e só alcança o banco em `projecao.ts`; `cronometragem/` só enxerga Inscrição por `inscricao/contrato`; `custodia/` é a única que cruza dado pessoal com resultado; rotas nunca importam `@/db` nem `@/infra`; `infra/` não conhece contexto nenhum. As fronteiras entre contextos **são** a barreira de privacidade — não é convenção, é estrutura, e `tests/fronteiras.test.ts` falha se deixar de ser.

---

## Como rodar

**Pré-requisitos:** Node.js ≥ 20.9 (o CI usa 22) e **PostgreSQL 18** acessível — a mesma versão que os testes executam via PGlite.

```bash
npm install
cp .env.example .env       # preencher as variáveis
npm run db:migrate         # cria o esquema
npm run db:seed            # massa de desenvolvimento: 2000 participantes
npm run criar-operador -- --usuario marina --nome "Marina Costa"
npm run dev
```

Os testes **não** precisam de PostgreSQL instalado: rodam contra PGlite, que é o próprio Postgres em WebAssembly. Só a aplicação precisa de um banco de verdade.

**Contas de Operador são criadas só por `npm run criar-operador`** (RNF-14). Não há tela de cadastro, convite nem endpoint: a autorização para criar conta é ter acesso ao ambiente. A senha é digitada no prompt, sem eco — nunca por argumento, que fica no histórico do shell e na lista de processos. Para tirar alguém do ar, `npm run criar-operador -- --desativar marina`: as sessões abertas caem na requisição seguinte.

**Quando a porta 5432 não é alcançável** — e ela é bloqueada em muitas redes institucionais, a da FIAP entre elas —, `npm run operador:sql -- --usuario marina --nome "Marina Costa"` deriva o hash localmente e imprime o `INSERT` pronto para colar no SQL Editor do provedor, que fala HTTPS. A senha continua sem sair da máquina: o que viaja é o hash. É saída de emergência, não substituto: o caminho normal confere duplicidade, desativa e destrava, e este não faz nada disso.

Se um Operador ficar preso pelo limite de tentativas de login — dez erros de senha travam por quinze minutos, e isso acontece com teclado de tablet capitalizando a primeira letra —, `npm run criar-operador -- --destravar marina` zera o contador. O limite volta a valer na tentativa seguinte; o do cadastro público não é tocado.
A aplicação recusa subir se a configuração estiver incompleta, listando cada variável e o motivo — a validação acontece em `instrumentation.ts`, antes de atender qualquer requisição.

**Variáveis de ambiente** (nomes e propósito; valores nunca vão para o repositório):

| Variável | Obrigatória | Propósito |
|---|---|---|
| `DATABASE_URL` | sim | Conexão com PostgreSQL, com TLS em produção |
| `SESSION_SECRET` | sim | Assinatura do cookie de sessão do Operador; mínimo 32 caracteres |
| `APP_URL` | sim | URL pública — é o destino codificado no QR code |
| `NODE_ENV` | não | `development` \| `test` \| `production` |
| `RATE_LIMIT_CADASTROS_POR_JANELA` | não | Cadastros concluídos por IP na janela curta (padrão 800, calibrado em T23 — D-90) |
| `RATE_LIMIT_JANELA_SEGUNDOS` | não | Duração da janela curta (padrão 600) |
| `RATE_LIMIT_CADASTROS_POR_HORA` | não | Teto por IP em uma hora (padrão 2400, calibrado em T23 — D-90) |
| `RATE_LIMIT_ATIVO` | não | `false` desliga o limite — alavanca de emergência do dia do evento |
| `FORMULARIO_SEGUNDOS_MINIMOS` | não | Tempo mínimo entre carregar e enviar o formulário (padrão 3) |
| `SESSAO_HORAS` | não | Validade da sessão do Operador sem uso (padrão 16) |
| `SESSAO_RENOVACAO_MINUTOS` | não | Intervalo mínimo entre renovações gravadas (padrão 30) |
| `LOGIN_TENTATIVAS_POR_JANELA` | não | Tentativas de login recusadas por IP e por conta (padrão 10) |
| `LOGIN_JANELA_SEGUNDOS` | não | Janela do limite de login (padrão 900) |
| `DB_POOL_MAX` | não | Conexões por instância (padrão 5). Quem protege o banco é o pooler, não este número |
| `APP_VERSION` | não | Versão publicada, devolvida por `/api/saude`. **Não preencher em produção**: o commit publicado vira a versão sozinho |

Definição e validação em `src/shared/env.ts`. Nenhum outro módulo lê `process.env`.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o ambiente local |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build |
| `npm run check` | Lint + typecheck + formatação, em uma passada. É o que o CI roda |
| `npm run lint` | Só o ESLint, incluindo as regras de fronteira |
| `npm run typecheck` | Só `tsc --noEmit` |
| `npm run format` | Aplica o Prettier |
| `npm run test` | Testes de unidade e integração |
| `npm run test:watch` | Mesmo, em modo contínuo |
| `npm run qr` | Gera o QR code do ponto de inscrição a partir da `APP_URL` |
| `npm run orcamento` | Mede o peso do primeiro carregamento e falha se passar do teto |
| `npm run db:generate` | Gera migração a partir do esquema em `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:seed [n]` | Popula a massa de desenvolvimento (padrão: 2000 participantes) |
| `npm run db:studio` | Abre o Drizzle Studio para inspecionar o banco |
| `npm run criar-operador` | Cria conta de Operador; `-- --desativar <usuario>` tira do ar; `-- --destravar <usuario>` zera o limite de login |
| `npm run operador:sql` | Só o `INSERT` de um Operador, sem tocar no banco — para rede que bloqueia a porta 5432 |
| `npm run test:e2e` | Testes de ponta a ponta com Playwright. Precisa de Postgres de pé: cria e recria o banco `speedx_e2e` sozinho, sem tocar no de desenvolvimento |
| `npm run test:e2e:ui` | O mesmo, com o inspetor do Playwright |
| `npm run metricas` | Relatório de métricas e alertas a partir do log; `-- --arquivo <caminho>` ou pelo cano. Sai com código 1 se algum alerta disparar |
| `npm run expurgar` | Retenção e exclusão. Sem argumento, mostra a ajuda; `-- --evento AAAA-MM-DD` ensaia o expurgo total; `-- --email <endereço>` acha um pedido de exclusão; `-- --higiene` faz a faxina das tabelas de mecanismo |

`npm run perf:preparar` cria `speedx_carga` com 2000 Participantes e 4000 Tentativas — banco próprio, descartável, porque a massa de carga é o pior caso e não a massa realista de desenvolvimento. Depois, com a aplicação de pé contra ele: `npm run test:carga` (leitura), `npm run test:carga:cadastro` (pico de inscrição) e `npm run perf:medir` (documento, consultas, índices, propagação). Números medidos em [docs/relatorio-carga.md](docs/relatorio-carga.md).

O `expurgar` é o único comando que apaga dados. Por padrão ele **ensaia**: conta e mostra, sem tocar em nada. O procedimento completo, com a ordem dos passos e o que fazer com o comprovante, está em [docs/retencao.md](docs/retencao.md).

---

## Rotas

Todas as rotas da tabela abaixo existem e estão cobertas por teste.

A raiz **serve o formulário diretamente**, sem redirecionamento: é o destino do QR code, e cada salto extra custa uma resolução de nome e um handshake com o celular na borda da célula (FL-01). `tests/entrada.test.ts` falha se alguém introduzir um redirecionamento, uma barra final obrigatória ou uma segunda rota de inscrição.

| Rota | Acesso | Função |
|---|---|---|
| `/` | Público | Formulário de inscrição — destino do QR code, sem redirecionamento |
| `/termo` | Público | Texto integral do consentimento — estático, aberto em aba nova pelo formulário |
| `/classificacao` | Público | Tabela com filtro por Cockpit, busca com destaque e atualização a cada 15 s — filtro e busca rodam no dispositivo |
| `/api/classificacao` | Público, em cache | Documento completo (62,7 KB / 10,9 KB gzip com 2.422 linhas); `s-maxage=15`, ETag |
| `/painel` | Autenticado | Fila, lançamento, correção, ausência e histórico — tudo por teclado |
| `/painel/login` | Público | Autenticação de Operador |
| `/api/painel/sessao` | Misto | `POST` login, `DELETE` logout, `GET` autenticado |
| `/api/inscricao` | Público, com limite de taxa | Recebe o cadastro |
| `/api/painel/fila` | Autenticado | `GET` — pendentes do Cockpit, com busca (RF-13, RF-14, RF-16) |
| `/api/painel/tempo` | Autenticado | `POST` registra, `PATCH` corrige (RF-17, RF-22) |
| `/api/painel/ausencia` | Autenticado | `POST` — marca ausente (RF-21) |
| `/api/painel/tentativa` | Autenticado | `POST` — inclui em Cockpit adicional (RF-24) |
| `/api/painel/participante` | Autenticado | `GET` — busca global, fora da Fila (RF-22, RF-24) |
| `/api/painel/tentativa/:id/historico` | Autenticado | `GET` — trilha de auditoria (RF-23) |
| `/api/exportacao?tipo=` | Autenticado | `completa` (base inteira), `repasse` (só quem autorizou) ou `pendencias` (métrica do PRD §7) |
| `/api/saude` | Público | Health check do monitor externo: 200 com o banco de pé, 503 sem — e nada sobre infraestrutura no corpo |
| `/api/metricas` | Autenticado | `GET` — painel do dia: inscritos por hora, situação de cada Cockpit, ritmo de Lançamentos e pendências. Só contagens |

Nenhuma resposta pública expõe e-mail, telefone, idade, dado de responsável, nem o sobrenome completo de participante menor de 18 anos.

### `POST /api/inscricao`

Aceita `application/json` e exige o cabeçalho `Idempotency-Key` com um UUID gerado **uma vez por tentativa de envio** e repetido nos reenvios. O corpo leva os campos da inscrição mais dois de controle: `token`, emitido pelo servidor ao renderizar o formulário, e `empresa`, o campo-armadilha que precisa chegar vazio.

| Status | Quando |
|---|---|
| 201 | Cadastro criado. Corpo: `{ nome, sobrenome, cockpits }` |
| 200 | Reenvio da mesma chave — devolve a resposta da primeira vez, sem gravar de novo |
| 400 | JSON quebrado, chave ausente, ou formulário aberto há horas demais |
| 409 | A mesma chave chegou com outro envio |
| 413 | Corpo acima de 16 KB |
| 415 | `Content-Type` não é `application/json` |
| 422 | Validação: lista de `{ campo, codigo, mensagem }` (RNF-17) |
| 429 | Envio rápido demais ou limite da origem excedido; traz `Retry-After` |
| 503 | O termo vigente voltou a ser rascunho — não há base legal para coletar |

Toda resposta sai com `Cache-Control: no-store`. Toda validação de interface é reaplicada aqui: um envio forjado por `curl` com idade 12 é recusado do mesmo jeito (RNF-13).

O limite de taxa conta **cadastro concluído**, não requisição — errar a validação cinco vezes não gasta cota. Os padrões foram calibrados em T23 sobre a medição de carga de T18, que mostrou os valores originais recusando 170 de 200 cadastros legítimos do mesmo IP (D-90); `tests/deploy.test.ts` recusa qualquer padrão abaixo do piso decidido. Ele depende de a borda da hospedagem sobrescrever `X-Forwarded-For`; sem endereço de origem não há limite, de propósito, porque um balde único para "origem desconhecida" travaria o evento. `RATE_LIMIT_ATIVO=false` desliga tudo, para o caso de o limite recusar gente de verdade no dia.

---

## Acesso ao painel

Toda rota sob `/painel` e `/api/painel` exige sessão válida, conferida **no servidor**:

- as páginas passam pelo layout de `app/painel/(protegido)/`, que resolve a sessão antes de renderizar — sem sessão, nenhum componente que consulta a fila chega a ser montado;
- cada rota de API chama a guarda por conta própria e responde **401**, não um redirecionamento para HTML.

Verificável sem abrir o navegador:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/painel
# 307 http://localhost:3000/painel/login
curl -s -i http://localhost:3000/api/painel/sessao | head -1
# HTTP/1.1 401 Unauthorized
```

**A sessão vive no banco**, e o cookie carrega apenas um número aleatório de 256 bits — sem identificador, sem prazo, sem nome. É o que faz `--desativar` e o botão *Sair* terem efeito imediato: um cookie assinado autocontido continuaria valendo até o prazo vencer, dezesseis horas depois. O cookie sai `HttpOnly`, `SameSite=Lax`, `Path=/` e, em produção, com o prefixo `__Host-`, que impede um subdomínio de sobrescrevê-lo.

A sessão dura `SESSAO_HORAS` sem uso e se renova enquanto o painel conversa com a API — ninguém é desconectado no meio do evento (RNF-16). Senhas usam **scrypt** da biblioteca padrão do Node, com 64 MiB por conferência; usuário inexistente e senha errada devolvem a mesma resposta e gastam o mesmo tempo. Tentativas recusadas consomem cota por origem **e** por conta, e o desligamento de emergência `RATE_LIMIT_ATIVO` **não** alcança esse limite.

---

## Peso do primeiro carregamento

**Orçamento: 150 KB comprimidos** para HTML, CSS e o JavaScript que um navegador
moderno baixa na raiz. `npm run orcamento` mede contra a aplicação de pé e
**falha** se o teto for ultrapassado — orçamento sem verificação vira frase.

Medição de 2026-08-20:

| | Bruto | gzip | brotli |
|---|---|---|---|
| Primeiro carregamento da raiz | 471,4 KB | **139,0 KB** | 119,0 KB |

Fora da conta, de propósito: o pacote `nomodule` de compatibilidade (110 KB),
que navegador moderno não chega a pedir, e o esquema de validação, que só desce
depois da primeira pintura, enquanto a pessoa digita (D-32).

O teto é medido em **gzip**, não em brotli: brotli é o melhor caso e depende da
borda estar configurada. Passar no pior caso é a garantia que sobrevive a uma
troca de hospedagem (PE-05). A folga hoje é de 11 KB.

Quase todo o peso é o próprio React com o Next — não é o formulário. Se a
medição em rede real de T18 não couber em RNF-04, a saída é o formulário
funcionar sem JavaScript, o que exige repensar a idempotência do lado do cliente.

---

## Testes

```bash
npm run test          # unidade + integração (Postgres real via PGlite, não mock)
```

`npm run test:carga` mede a leitura sob pico (T18); o preparo do banco de carga e os números estão descritos em [Comandos](#comandos) e em [docs/relatorio-carga.md](docs/relatorio-carga.md).

Dois testes cuidam de coisas que nenhuma revisão de código pega a olho nu, e ambos já pagaram o próprio custo:

- `tests/fronteiras.test.ts` roda o ESLint programaticamente e falha se a regra de fronteira entre contextos deixar de valer. Na T01 ela tinha uma fresta silenciosa: o import de fachada `@/contexts/x` passava, porque padrões estilo gitignore não casam sem subcaminho.
- `tests/esquema.test.ts` exercita cada constraint contra um Postgres real e confere o **nome** da constraint violada. Na T02 revelou que a regra de autoria aceitava uma Tentativa resolvida sem Operador, furando RF-23.

Cada teste é nomeado pelo requisito que verifica (ex.: `RF-07 — idade corrigida descarta responsável`). A suíte inclui um teste de vazamento que varre as respostas públicas procurando dado pessoal da massa de teste e falha se encontrar. Detalhes em [T17](.claude/tasks/task-17-testes-automatizados.md) e [T18](.claude/tasks/task-18-testes-de-carga.md).

---

## Deploy

**Vercel** (funções em `gru1`) + **Neon** (Postgres em `aws-sa-east-1`) + **UptimeRobot** no `/api/saude`. O desenho inteiro, as variáveis de produção e o checklist com os comandos de verificação estão em [docs/deploy.md](docs/deploy.md); a página para imprimir e levar no dia é [docs/plano-do-dia.md](docs/plano-do-dia.md).

**Duas coisas que quem publica precisa saber antes:**

- **`DATABASE_URL` de produção é a string do pooler** do provedor. Cada instância de função abre o próprio pool, e é o PgBouncer que impede que isso vire mais conexões do que o banco oferece (D-80). **`npm run db:migrate` é a exceção** e quer a string direta.
- **`APP_VERSION` não se preenche.** O commit publicado vira a versão sozinho e sai em `/api/saude` — é assim que se responde "qual código está no ar" sem entrar na máquina.

O que o repositório já garante por teste (`tests/deploy.test.ts`): nenhuma rota fora da Classificação é cacheável, nenhum esquema de entrada aceita instante do cliente, e a região da função continua colada à do banco. O que **ainda depende de um domínio publicado**: HTTP/3 anunciado, `HIT` de borda, sincronia de relógio conferida e restauração de backup testada.

No dia do evento: snapshot manual do banco antes de começar, deploys congelados exceto correção crítica, plano de reversão impresso e distribuído. Em 04/11/2026 o site sai do ar, junto com o expurgo.

---

## Estado do projeto

| Fase | Tasks | Situação |
|---|---|---|
| Planejamento | — | Concluído — PRD, SDD e 21 tasks |
| Fundação | T01 | **Concluído** — projeto, fronteiras por lint, ambiente validado, CI |
| Fundação | T02 | **Concluído** — esquema, migrações, formatação de Tempo, massa de teste |
| Inscrição | T03 | **Concluído** — termo `v1.0-2026-08-19` aprovado, versionado e publicado em `/termo` |
| Inscrição | T04 | **Concluído** — validação, união discriminada por idade e transação de cadastro |
| Inscrição | T05 | **Concluído** — endpoint com idempotência, limite de taxa, anti-automação e log sem dado pessoal |
| Inscrição | T06 | **Concluído** — formulário na raiz, validação local, aceites vindos do termo, reenvio idempotente. Falta o ensaio cronometrado com pessoas (RNF-15) |
| Inscrição | T07 | **Concluído** — raiz sem redirecionamento, QR nível H vetorial, orçamento de peso verificável. Falta testar com três leitores reais |
| Cronometragem | T08 | **Concluído** — login, sessão no banco, guardas de rota e criação de contas por CLI |
| Cronometragem | T09 | **Concluído** — máquina de estados, três transições com trava e auditoria, Fila e histórico |
| Cronometragem | T10 | **Concluído** — sete endpoints do painel, busca por trecho sem acento, 409 pronto para exibição |
| Cronometragem | T11 | **Concluído** — painel por teclado, confirmação obrigatória, robustez de rede. Falta cronometrar os 15 s com o supervisor (RNF-16) |
| Classificação | T12 | **Concluído** — projeção, documento compacto e endpoint público com cache de borda |
| Classificação | T13 | **Concluído** — tabela pública, filtro, busca com destaque e paginação. Falta conferir 360px em aparelho (RNF-18) |
| Custódia | T14 | **Concluído** — três exportações em CSV, com sessão obrigatória e rastro de quem exportou |
| Custódia | T15 | **Concluído** — expurgo total com três travas, exclusão individual a pedido e higiene automática das tabelas de mecanismo. A data do evento entrou em 2026-08-25 (24/10/2026, retenção vencendo em 04/11); o procedimento de tirar o site do ar está escrito em `docs/deploy.md` §6 |
| Qualidade e operação | T16 | **Concluído** — `/api/saude`, painel do dia em `/api/metricas` e relatório de métricas a partir do log, com os quatro alertas. O monitor externo foi escolhido em T19 (UptimeRobot); falta configurá-lo, o que depende do domínio |
| Qualidade e operação | T17 | **Concluído** — 594 testes de unidade e integração em 79 s, 19 de ponta a ponta em 42 s, e a rastreabilidade PRD → teste verificada por teste. RNF-18 deixou de depender de aparelho |
| Qualidade e operação | T18 | **Parcial** — 200 req/s com p95 de 7,9 ms e zero 5xx, documento de 14 KB gzip, propagação de ~20 s. Achou o que procurava: o limite de taxa, como configurado, recusaria a fila do evento — **calibrado em T23**. Faltam borda, 3G real e o ensaio longo |
| Qualidade e operação | T19 | **Parcial** — código, configuração e os dois documentos de operação prontos, com Vercel, Neon e UptimeRobot escolhidos. Faltam as contas criadas e um domínio: quatro dos sete critérios só se verificam contra um endereço publicado |
| Qualidade e operação | T20 | **Concluído, menos o ensaio** — ficha de papel, termo impresso e folha de tempos gerados do mesmo termo que a tela, com teste comparando papel e esquema nos dois sentidos. Falta imprimir e ensaiar com o time |
| Qualidade e operação | T21 | **Parcial** — auditoria de privacidade fechada com evidência (`npm run auditar` contra a base de 2000: corpo público com três campos, nove rotas em 401, 261 tentativas de menores abreviadas). Partes 2 e 3 levantadas com dono. Fecha quando houver domínio e a tarde de ensaios |

**Pendências que bloqueiam:** uma, e ela tem prazo. **O domínio não existe** — sem endereço publicado, quatro critérios de T19 não têm contra o que rodar e o QR de T07 continua provisório; material impresso precisa de folga antes de 24/10, e uma URL de comprimento diferente muda o número de módulos do código. Resolvidas em 2026-08-27: o Postgres é o **Neon em São Paulo** (D-79) e o monitor é o **UptimeRobot gratuito** (D-82). Resolvidas em 2026-08-25: o termo oficial é **Cockpit** — nem "Pitch" nem "Pista", porque o evento é de simulador (D-75) —, o evento é em **24/10/2026** e a aplicação vai para a **Vercel gratuita**. Definidos em 2026-08-19: retenção de **no máximo 10 dias após o evento**, com o site saindo do ar ao fim do prazo; pedido de exclusão por **e-mail** ou presencialmente durante o evento; e repasse do telefone à FIAP e à escolinha do Lélio Assumpção mediante **autorização opcional**, em caixa separada do aceite do termo. Lista completa em [CONTEXT.md §5](CONTEXT.md).

O termo está aprovado desde 2026-08-19 (`v1.0-2026-08-19`). Se a versão vigente voltar a ser rascunho, `assegurarTermoAprovado()` recusa registrar consentimento: cadastro real sob texto não aprovado é impossível por construção, não por disciplina. Checklist e registro da aprovação em [docs/aprovacao-termo.md](docs/aprovacao-termo.md).
