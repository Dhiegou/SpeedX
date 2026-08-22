# CONTEXT.md — Contexto, decisões e raciocínio

Registro vivo do projeto. Documenta o **porquê**; o **o quê** está no [PRD.md](PRD.md), no [SDD.md](SDD.md), em [.claude/tasks/](.claude/tasks/README.md) e no código.

Mantido segundo a skill [`.claude/skills/documentar-contexto.md`](.claude/skills/documentar-contexto.md).

---

## 1. Estado atual

**2026-08-23.** Dez tarefas entregues (T01–T10), rodando contra um PostgreSQL 18.6 local com massa de 2000 participantes. **430 testes passam**; `npm run check` e o build de produção também.

**O projeto está publicado**: https://github.com/Dhiegou/SpeedX — commit inicial `2bb071d`, 156 arquivos. Até aqui não havia commit nenhum; daqui em diante o histórico é real e commitado por task.

**T10 entregue:** sete endpoints sob `/api/painel` — fila, lançamento, correção, ausência, inclusão em Pitch adicional, busca global e histórico. Todos exigem sessão, todos respondem `no-store`, e o 409 de conflito chega pronto para exibição ("Tempo 01:23.45 já registrado por Marina Costa às 14:32").

A decisão que a T02 tinha adiado para a T10 — busca no meio do nome — foi resolvida por medição (D-50): trecho acento-insensível custa **menos** que prefixo com índice nesta escala, e 34% dos nomes têm acento.

Próximo passo: T11 (UI do painel). Restam duas pendências abertas (seção 5).

---

## 2. Linha do tempo das sessões

### 2026-08-23 — Sessão 13: T10 e a publicação do repositório

**Pedido:** iniciar a T10; no meio do caminho, revisar o `.gitignore` e publicar no repositório recém-criado.

**Entregue:** os sete endpoints do painel, 28 testes de borda, e o primeiro commit da história do projeto — 156 arquivos, 31.890 linhas, em https://github.com/Dhiegou/SpeedX.

**Duas confirmações do usuário:** o evento é em **São Paulo**, o que valida o fuso fixo de `formatHoraDoEvento`; e o repositório foi criado por ele, vazio.

**Sobre a divisão dos commits, uma correção do que eu tinha oferecido:** propus dividir por task e voltei atrás. Todos os arquivos estão no estado final de hoje — um "commit da T01" conteria o README que já descreve a T10. Seria um histórico fabricado. Um commit único corresponde ao que de fato existe; daqui pra frente a divisão por task é honesta porque o histórico passa a ser real.

**Dois problemas achados ao preparar a publicação, nenhum deles da T10:**

1. **O `.gitignore` deixava passar `.env.production`.** O padrão era uma lista de nomes conhecidos (`.env`, `.env.local`, `.env.*.local`), e `.env.production` — onde a credencial de produção vai morar quando T19 escolher a hospedagem — não estava nela. Trocado por `.env*` com `!.env.example`. Aproveitei para acrescentar o bloco que **não é higiene, é RNF-08**: a Exportação CSV de T14, o snapshot de banco que T19 manda tirar e qualquer dump de depuração carregam a base de 2000 pessoas em claro, e um `git add .` distraído publicaria tudo.

2. **Um clone novo no Windows quebraria o `npm run check`.** O Prettier deste projeto exige `endOfLine: "lf"`, o git local está com `core.autocrlf=true` e não havia `.gitattributes` — os arquivos viriam com CRLF e o `format:check` reprovaria, com o CI rodando exatamente esse comando. Criado o `.gitattributes` antes do commit.

**Um erro meu, registrado porque a lição é geral:** o teste de RF-15 assertava que a string `34` — a idade — não aparecia no corpo da resposta. Dois dígitos colidem por acaso com UUIDs e ISO 8601: passou rodando o arquivo sozinho, reprovou na suíte completa. Teste que reprova conforme o identificador sorteado é pior que teste nenhum. Trocado pela asserção de chaves, que já era exaustiva.

**Aberto:** T11 em diante. PE-05 segue pela metade — falta onde hospedar.

### 2026-08-23 — Sessão 12: execução da T09

**Pedido:** iniciar a T09 (domínio de Cronometragem).

**Entregue:** o contexto inteiro — modelo, máquina de estados, as três transições de Tempo, inclusão de Tentativa, Fila e histórico, mais a composição que a T10 vai consumir. 35 testes novos, 390 no total.

**A decisão que mais mudou o desenho** foi escrever a máquina de estados como **tabela de dados** em vez de ramos espalhados pelos casos de uso (D-47). O atributo que justifica sozinho essa escolha é `carimbaResolucao`: registrar e ausentar carimbam `resolvido_em`, corrigir **não** carimba, porque esse instante é o desempate de RF-31 e mexer nele faria um acerto de digitação mudar a posição de terceiros no pódio. Como ramo perdido no meio de uma função, essa regra some na primeira refatoração; como coluna de uma tabela, um teste a lê.

**Um desvio deliberado do que a task sugeria** (D-48): ela oferecia `UPDATE ... WHERE estado = ?` ou `SELECT ... FOR UPDATE`. Fui de `FOR UPDATE` porque a correção precisa do valor anterior para a trilha de RF-23, e ler esse valor antes sem travar reabriria exatamente a janela que o compare-and-set fecha.

**E uma escolha entre duas saídas que o PRD admite** (D-49): RF-25 aceita "bloqueada **ou** tratada como correção". Escolhi bloquear, devolvendo o Tempo que já está gravado. Converter em silêncio apagaria um resultado medido sem ninguém confirmar; devolver o valor permite ao painel perguntar "já existe 01:23.45 lançado por Marina — deseja corrigir?", que é RF-18 no mesmo movimento.

**Duas coisas provadas fora da suíte, porque ela não alcança:**

1. **Concorrência de verdade.** O teste da suíte roda sobre PGlite, que tem uma conexão só: o `Promise.all` serializa e o lock nunca é disputado. Refeito com dois pools separados contra o PG 18.6 — uma conexão aplicou, a outra recebeu a recusa legível, uma linha de auditoria só, o Tempo certo preservado.
2. **O plano da busca da Fila.** O alerta que a sessão anterior deixou no cabeçalho da T10 mandava conferir o `EXPLAIN`. Feito: `BitmapOr` sobre `participante_nome_idx` e `participante_sobrenome_idx`, os dois com `text_pattern_ops`, mais `tentativa_fila_idx` para o recorte de Pitch e estado. 77 buffers.

**Uma lacuna assumida e anotada em T21:** não fica registrado **quem** incluiu uma Tentativa por RF-24. A constraint de T02 exige `operador_id` nulo enquanto o estado é Pendente, e o enum `tipo_lancamento` não tem valor para "inclusão". RF-23 cobre gravação e alteração de Tempo, então a ausência está dentro do requisito — mas se alguém for incluído no Pitch errado, não há como saber quem incluiu.

**Aberto:** nada novo. PE-05 segue pela metade. Nenhum commit.

### 2026-08-23 — Sessão 11: primeiro contato com Postgres real

**Pedido:** o usuário instalou o PostgreSQL 18, criou role e banco, aplicou migrações, populou a massa e criou a própria conta de Operador — tudo fora do repositório. O campo "próximo passo" da mensagem veio com o texto de exemplo do modelo, não preenchido; segui o exemplo, que era o item pendente óbvio: fechar o login de ponta a ponta.

**Entregue:** os 21 passos de verificação por `curl` contra PG 18.6 nativo, com 2000 participantes e 2973 tentativas no banco. Tudo passou. A massa de teste foi removida ao final e o banco ficou como estava.

**O que só apareceu por haver um servidor real:**

1. **Collation divergente** (D-45). PGlite é `C`; o Postgres de um Windows pt-BR nasce `Portuguese_Brazil.1252`. O que mais importa — `lower()` e `upper()` sobre acentos — é idêntico. O que diverge é `LIKE` por prefixo, e diverge para pior: fora de `C`, btree comum não serve, e a suíte jamais notaria a remoção de `text_pattern_ops`.
2. **O CLI não aceita ser alimentado por pipe.** Um `printf` encanado para `scripts/criar-operador.ts` trava: o `readline` com eco suprimido espera terminal. Funciona digitado — foi assim que o usuário criou a conta `dhiego`. Importa para T19, se o provisionamento for automatizado.
3. **O Next 16 recusa um segundo `next dev` no mesmo diretório.** A verificação acabou rodando contra o servidor que o usuário já tinha de pé, o que não mudou nada — mesmo código, mesmo `.env`, mesmo banco.

**Um erro meu no meio do caminho, registrado porque a lição vale:** a primeira tentativa de provar que `text_pattern_ops` é necessário criou um índice comum **ao lado** do que já existia, e o planejador simplesmente escolheu o índice certo. O teste não provava nada. Refeito numa tabela temporária isolada, com `enable_seqscan = off`, aí sim ficou demonstrado: o planejador preferiu um Seq Scan desabilitado a usar o btree comum.

**Aberto:** PE-05 continua pela metade — o banco é PostgreSQL 18, falta onde hospedar. A credencial de desenvolvimento não serve para produção, que precisa de TLS (SDD FL-09), e isso segue em T19. Nenhum commit.

### 2026-08-23 — Sessão 10: banco definido e fechamento das decisões da T08

**Pedido:** fechar as cinco decisões levantadas na entrega da T08 e definir qual PostgreSQL instalar.

**O banco.** O usuário havia criado um **Autonomous Database** na Oracle. Levantamento do acoplamento antes de responder qualquer coisa: o Drizzle não tem dialeto Oracle (só `pg`, `mysql`, `sqlite` e `singlestore` existem em `node_modules`); `src/db/schema.ts` tem 35 construções exclusivas do Postgres; as migrações usam `gen_random_uuid()`, `CREATE TYPE ... AS ENUM` e o operador de regex `~`; `criarOperador.ts` e `submeterInscricao.ts` dependem do SQLSTATE `23505`; e a suíte roda sobre PGlite, que é o próprio Postgres compilado para WebAssembly. Portar significaria sair do Drizzle, reescrever esquema, migrações e tratamento de erro, e **perder a estratégia de teste** que já pegou dois defeitos reais (a constraint de autoria furada em T02 e o saneamento de log em T08). Decisão do usuário: fica PostgreSQL.

**A versão saiu de um dado, não de preferência:** `select version()` no PGlite 0.5.5 devolve **PostgreSQL 18.3**. É a versão contra a qual os 352 testes rodam, e portanto a que produção deve ter.

**As cinco decisões.** D-36 (sessão no banco), D-37 (scrypt), D-38 (`infra/`) e D-40 (renovação na API) confirmadas sem mudança — ver o fechamento de cada uma na seção 3. D-39 precisou de trabalho: ela tirou o login do alcance de `RATE_LIMIT_ATIVO` com razão, mas não pôs nada no lugar, e sem alavanca nenhuma um Operador que errasse a senha dez vezes ficava fora por quinze minutos com a fila do Pitch parada. Virou D-44.

**Aberto:** onde hospedar o Postgres de produção (PE-05, metade restante) e o login de ponta a ponta contra banco de verdade, que continua sem rodar até o usuário instalar o PostgreSQL 18. Nenhum commit.

### 2026-08-22 — Sessão 9: execução da T08

**Pedido:** verificar em que task o projeto parou e iniciar a seguinte.

**Entregue:** T08 inteira — contexto de Identidade (`senha`, `sessao`, `autenticar`, `politicaDeLogin`, `criarOperador`, `servico`), tabela `sessao` com migração `0003`, tela de login, guarda de páginas e de API, CLI de criação de contas, e a camada nova `src/infra/`. 50 testes novos, 349 no total. Nenhuma dependência nova.

**A decisão que mais pesou foi a de sessão.** Cookie assinado autocontido é mais barato e teria sido a escolha natural — até a pergunta "o que acontece quando a organização precisa tirar um Operador do ar às três da tarde?". Com dezesseis horas de validade, a resposta seria "nada, até as onze da noite". Sessão no banco custa uma consulta indexada por requisição de um punhado de pessoas e devolve revogação imediata, que é o que um sistema com autoria de Lançamento registrada (RF-23) precisa ter.

**Um desvio consciente do escopo:** a task pedia Argon2id ou bcrypt; foi usado scrypt. Os dois pedidos exigem compilação nativa, e a hospedagem ainda não existe (PE-05) — dependência com toolchain C é o que falha no primeiro deploy de um sistema que roda um dia só. scrypt é memory-hard igual, mora na biblioteca padrão do Node, e o formato gravado carrega o algoritmo, então trocar depois é decidir em `conferirSenha` e não migrar hash.

**Três defeitos anteriores encontrados pelos testes desta sessão**, todos fora do escopo da T08 e todos corrigidos: UUIDs corroídos pelo saneamento do log, o limite de processos do Vitest que havia deixado de existir na atualização para a versão 4, e os comandos `tsx` que não liam o `.env`. Nenhum deles era visível por leitura; o primeiro só aparecia quando o UUID sorteado calhava de ter onze dígitos seguidos.

**Aberto:** o login de ponta a ponta contra Postgres de verdade não rodou — não há banco local de pé nesta máquina (`ECONNREFUSED`). O caminho está coberto contra Postgres real na suíte, via PGlite, e a guarda foi verificada com `curl` contra o build de produção. Refazer com banco de pé é item de T19. Nenhum commit.

### 2026-08-20 — Sessão 8: execução da T07

**Pedido:** iniciar a T07 (rota de entrada e QR code).

**Entregue:** `scripts/gerar-qr.ts`, `scripts/orcamento.mjs`, `src/shared/qr.ts`, `docs/sinalizacao.md` e o SVG. 16 testes novos, 295 no total. Dependência nova de desenvolvimento: `qrcode`.

**Duas verificações que davam para fazer agora, e foram feitas:**

- `curl` na raiz: `redirects=0`, `status=200`. Os cabeçalhos de cache já eram os certos por padrão do Next — HTML `no-store`, estático `immutable` por um ano —, então o item 5 do escopo virou verificação em vez de configuração.
- Peso do primeiro carregamento: **139,0 KB gzip**, contra o teto de 150 KB da própria task. Cabe, com 11 KB de folga.

**Um critério que não fecha, e a conta que mostra por quê:** a carga em "3G lento" não cabe em 3 s. Com 400 kbit/s e 2 s de latência, só a transferência dos 139 KB leva 2,8 s, e a latência sozinha já estoura o alvo antes do primeiro byte útil — página vazia também não passaria. Em "3G rápido" a conta dá cerca de 2,4 s e fecha. O critério precisa ser reescrito contra um perfil nomeado e medido em aparelho real (T18), e o HTTP/3 do SDD deixa de ser preferência: em rede ruim quem domina é o estabelecimento de conexão, não os bytes.

**Aberto:** três critérios das últimas tarefas dependem do mundo físico — os três leitores de QR (T07), o ensaio cronometrado de preenchimento (T06, RNF-15) e a medição de carga em rede real (T07/T18). Todos reunidos no checklist de `docs/sinalizacao.md` e no de T21. Nenhum commit.

### 2026-08-20 — Sessão 7: execução da T06

**Pedido:** iniciar a T06 (formulário público de cadastro).

**Entregue:** `/` serve o formulário. Validação local com o esquema de T04, bloco de responsável regido pela idade, aceites renderizados a partir do termo, chave de idempotência preservada na falha de rede. 25 testes novos, 279 no total. Entraram `@testing-library/react`, `@testing-library/user-event` e `happy-dom` — metade dos critérios da tarefa é comportamento de tela e não existe como verificar sem renderizar.

**Três coisas que a task não previa:**

1. **Cumprir "validar no cliente com o mesmo Zod" ao pé da letra custava 286 KB no caminho crítico.** A regra continua sendo a de T04, importada — mas carregada depois da montagem, enquanto a pessoa digita. Ver D-32.

2. **A raiz precisou virar dinâmica.** O token de T05 carrega o instante da carga da página; prerenderizada, ela entregaria a todo mundo o mesmo token, emitido no dia do deploy.

3. **A instrumentação do PRD §7 não precisava do navegador.** A abertura do formulário é uma renderização, e o tempo de preenchimento já está assinado dentro do token. Ver D-33.

**A PE-01 deixou de bloquear:** a palavra "Pitch" saiu da copy e virou constante (D-31).

**Aberto:** T07. Um critério de T06 fica pendente por depender de pessoas — o ensaio cronometrado de RNF-15. Nenhum commit.

### 2026-08-20 — Sessão 6: execução da T05

**Pedido:** verificar o que já estava feito nas tasks, validar, e iniciar a T05.

**Validação prévia:** T01 a T04 conferidas por execução — `npm run check`, 197 testes e o build de produção. Todas confirmadas.

**Entregue:** endpoint de cadastro com idempotência, limite de taxa, honeypot, token de formulário e log saneado. 57 testes novos, 254 no total. Migração `0002_limite_de_taxa`.

**Três coisas que a leitura da task não antecipava:**

1. **A nota que a T04 deixou para a T05 não passava no lint.** Ela dizia que o endpoint chamaria `registrarInscricao(db(), ...)`, mas `app/**` está proibido de importar `@/db` desde a T01 — e é essa proibição que sustenta a restrição 3 do anexo do PRD. A regra funcionou como devia: recusou o atalho antes de ele existir. Entrou `servico.ts` como porta nomeada do contexto.

2. **A idempotência, sozinha, é um vazamento esperando acontecer.** Guardar a resposta sob a chave e devolvê-la em qualquer reenvio significa que quem apresentar a chave recebe a confirmação — inclusive o nome de outra pessoa, se duas chaves coincidirem. Ver D-28.

3. **O limite por IP é a peça mais perigosa desta tarefa**, e o perigo é o oposto do que a task supunha: não é o atacante que passa, é o participante legítimo que é barrado por CGNAT. Ver D-27.

**Aberto:** T06, bloqueada pela PE-01 para congelar copy. Nenhum commit.

### 2026-08-19 — Sessão 5: execução da T04

**Pedido:** aprovar o termo e iniciar a T04 (domínio de Inscrição).

**Entregue:** `schema.ts` com a validação e a união discriminada por idade, `erros.ts` com o erro estruturado por campo, `registrarInscricao.ts` com validação e transação. 61 testes novos, 197 no total.

**Dois defeitos que os testes pegaram, e que a leitura não pegaria:**

1. **Quem digitava 12 anos recebia "precisa de responsável" junto com "idade mínima é 13".** O `superRefine` do menor rodava mesmo quando a idade já tinha sido recusada. A segunda mensagem sugeria que preencher o responsável resolveria o problema, e não resolve: RF-04 é absoluto. Corrigido pulando as exigências de Responsável fora da faixa que produz Participante.

2. **A distinção entre "campo ausente" e "campo com tipo errado" estava errada.** A implementação usava `issue.input === undefined`, mas o Zod v4 não popula `input` nesta configuração: todo tipo errado era reportado como campo obrigatório, e a pessoa recebia "preencha o campo" para um campo que ela tinha preenchido. Passou a percorrer o caminho do erro na entrada crua, que é a fonte confiável.

**Aberto:** T05 (endpoint). Nenhum commit.

### 2026-08-19 — Sessão 4: execução da T03

**Pedido:** executar a T03 (termo de consentimento e textos legais).

**Decisão do usuário na abertura da sessão:** prazo de retenção definido em **máximo de 10 dias após o evento** (resolve PE-02).

**Entregue:** termo em linguagem simples com sete seções, bloco de aceite do participante e bloco do responsável em primeira pessoa; versão com hash de conteúdo declarado; rota pública `/termo` (estática); `docs/aprovacao-termo.md` com o checklist de RF-09 item a item e o campo de aprovação em branco; 28 testes novos (107 no total).

**O ponto que decidiu o desenho da tarefa.** A T03 tinha duas pendências que a bloqueavam formalmente, e havia duas saídas ruins: parar a tarefa inteira à espera do organizador, ou escrever o texto com um canal inventado e seguir. A terceira saída é a que foi implementada: o rascunho existe, é versionado e é legível, e a falta de aprovação vira uma **recusa em código** (`assegurarTermoAprovado`, chamado por T05 antes de aceitar cadastro). O risco que isso remove é concreto — sem ele, o caminho natural é alguém aprovar o texto de boca no dia do evento, e o sistema coletar dado de menor de idade sob um termo que ninguém leu inteiro.

**Uma escolha de UI virou constante de domínio.** O critério de aceitação "abrir `/termo` e voltar não apaga o preenchimento" costuma virar um detalhe de JSX em T06, onde ninguém testa. Virou `LINK_TERMO`, com `target="_blank"` e `rel="noopener noreferrer"`, e um teste que falha se o alvo mudar. Ver D-19.

**Ainda na mesma sessão, PE-03 foi resolvida.** O usuário propôs não ter canal de exclusão; a objeção e o desfecho estão em D-20. Resultado: canal presencial, `v0.2-rascunho-2026-08-19` publicada com o texto completo, e a `v0.1` — que nunca coletou nada, porque o guard impediu — retirada do registro de versões. Rascunho que ninguém aceitou não é prova de nada; guardá-lo em `TERMOS_PUBLICADOS` sugeriria o contrário.

**Ainda na mesma sessão, RNF-09 foi revisado.** Ao ler o checklist de aprovação, o usuário questionou a abreviação do sobrenome. A objeção sobre menores de idade foi levantada, e o desfecho separou os dois casos em vez de escolher um: maior por extenso, menor com inicial (D-21). Alcance da mudança: `nomePublico.ts` e seu teste, o modelo e a fachada de BC-03, a projeção, o RNF-09 do PRD, o glossário e a BC-03 do SDD, e o texto do termo — `v0.3-rascunho-2026-08-19`. Feita antes de T12 e T13 existirem, que é quando custa pouco.

**Terceira rodada de revisão do texto, mesma sessão.** O usuário pediu quatro mudanças de conteúdo: finalidade do telefone (contato com ganhadores), repasse do telefone à FIAP e à futura escolinha do Lélio Assumpção, site fora do ar ao fim dos 10 dias, e o e-mail `dhiegodev@hotmail.com` como canal de exclusão. Resultado em D-22 e na versão `v0.4-rascunho-2026-08-19`, com seção nova `compartilhamento`. O repasse obrigou a resolver uma contradição com o prazo de retenção — está descrita em D-22.

**Quarta rodada, mesma sessão: o repasse virou opcional.** O usuário esclareceu que o repasse à FIAP e à escolinha é opcional, mantido o termo como obrigatório. Isso reabriu a opção que ele tinha descartado horas antes e custou o que estava previsto: coluna nova, migração `0001`, e o modelo de aceites reescrito como lista com `obrigatorio`. Resultado em D-23 e na `v0.5-rascunho-2026-08-19`.

**Quinta rodada: revisão de estilo.** O usuário apontou excesso de travessão no texto, pontuação pouco usual em português brasileiro. Corrigido na `v0.6-rascunho-2026-08-19` e travado por teste (D-24). É a primeira mudança da sessão vinda da leitura do item 10 do checklist, e não de uma decisão de produto.

**Fechamento: o termo foi aprovado.** O usuário aprovou o texto e a `v1.0-2026-08-19` foi publicada: `situacao: 'aprovado'`, `pendencias: []`, registro preenchido em `docs/aprovacao-termo.md` com versão, hash, responsável e data. O hash não mudou na promoção, porque aprovação é metadado e fica fora do conteúdo canônico de propósito: confirmar uma assinatura não pode custar reescrever o termo. Os testes que exigiam rascunho foram invertidos, como o procedimento previa. Fica anotado que a aprovação é do usuário; se o organizador formal do NEXT for outra pessoa, a contra-assinatura entra na mesma tabela sem gerar versão nova.

**T03 concluída, sem ressalva.** Nenhum commit.

### 2026-08-18 — Sessão 3: execução da T02

**Pedido:** iniciar a T02 (esquema de dados e migrações).

**Entregue:** esquema completo em Drizzle com as invariantes gravadas em constraints, migração SQL versionada, `src/shared/tempo.ts`, massa de desenvolvimento determinística e comandos `db:generate`, `db:migrate`, `db:seed`, `db:studio`. 79 testes passando.

**O achado que justifica a tarefa inteira.** A constraint de autoria da Tentativa estava escrita como uma conjunção — `(estado = 'pendente') = (operador_id is null and resolvido_em is null)` — e aceitava uma Tentativa **Válida com operador nulo**, desde que `resolvido_em` estivesse preenchido: os dois lados davam `false` e a igualdade passava. Uma tentativa resolvida sem autoria é precisamente o que RF-23 existe para impedir, e o erro é invisível na leitura. Foi o teste que pegou. Corrigido em duas condições independentes (ver D-15).

**Dois ajustes de desempenho, ambos descobertos medindo:**
- índice de busca precisou de `text_pattern_ops`, senão `LIKE 'jo%'` cai em varredura sequencial e o índice nunca é usado;
- seed passou a inserir em lotes de 500 com UUID gerado no cliente: linha a linha eram ~100 ms por participante, mais de três minutos para montar a base de T18.

**Aberto:** nada foi executado contra um Postgres gerenciado real (PE-05). Nenhum commit.

### 2026-08-18 — Sessão 2: execução da T01

**Pedido:** dar início à T01.

**Entregue:** projeto inicializado e verificado de ponta a ponta — `npm run check` (lint + tipos + formatação), 23 testes e `npm run build` passando. Detalhes de estrutura no `README.md`; o que segue é só o que não se lê no código.

**Três coisas que a execução ensinou, e que mudaram o plano:**

1. **A regra de fronteira tinha uma fresta silenciosa.** A primeira versão usava só `no-restricted-imports` com padrões `@/contexts/x/**`. Ao testar deliberadamente uma violação, descobriu-se que o import de fachada `@/contexts/x` (sem subcaminho) **passava limpo** — padrões estilo gitignore não casam com o diretório nu. A barreira de privacidade do sistema estaria valendo pela metade, e nenhuma revisão de código pegaria isso a olho nu. Ver D-11.

2. **Next 16 removeu a chave `eslint` do `next.config`.** O build não roda mais ESLint. Quem barra o lint é o script `check` e o CI — se alguém confiar em "o build reprova", vai passar código com violação de fronteira.

3. **O projeto vive sob OneDrive**, e o Next inferia a raiz de rastreamento como `C:\Users\dhieg`, ignorando o `package-lock.json` e varrendo o diretório do usuário. Corrigido com `outputFileTracingRoot` fixado no diretório do projeto — sem isso, o pacote de deploy sairia imprevisível.

**Verificações executadas** (não presumidas):
- import proibido entre contextos → ESLint falha com a mensagem esperada;
- import permitido (`cronometragem` → `inscricao/contrato`, `custodia` → ambos) → passa;
- servidor iniciado sem as variáveis obrigatórias → **recusa subir**, listando `DATABASE_URL`, `SESSION_SECRET` e `APP_URL` com o motivo de cada uma;
- `.gitignore` confere: `node_modules`, `.next`, `.env` e `.claude/settings.local.json` fora; `.claude/tasks/` e `.claude/skills/` versionados de propósito.

**Ajuste posterior, na mesma data.** Ao tentar rodar `npm run dev`, o servidor recusou subir por falta de `.env` — o comportamento projetado, funcionando. Mas a mensagem revelou um defeito: para variável **ausente**, o Zod respondia com o texto genérico em inglês (`expected string, received undefined`), e não com a explicação em português. Dizia qual variável faltava, não o que fazer. Corrigido com `z.string({ error: ... })` em cada variável obrigatória, e coberto por teste que falha se a mensagem genérica voltar. Criado `.env` local com valores de desenvolvimento (ignorado pelo git); `DATABASE_URL` é placeholder, já que nada conecta ao banco antes de T02.

**Erro de hidratação no `<body>`, mesma data.** O overlay do Next acusou divergência entre servidor e cliente causada pelo atributo `cz-shortcut-listen`, injetado pela extensão ColorZilla no navegador do usuário — não pelo nosso código. Adotado `suppressHydrationWarning` no `<body>` do layout raiz: a supressão vale apenas para os atributos daquele elemento, então divergências reais dentro do formulário, do painel ou da classificação continuam sendo reportadas. **Descartado** pedir que se desative a extensão: o participante chega com o navegador que tem, e gerenciadores de senha e tradutores injetam atributos do mesmo jeito.

**Aberto:** T02 não começou. Nenhum commit foi feito.

### 2026-08-18 — Sessão 1: planejamento

**Pedido do usuário, em três partes ao longo da sessão:**
1. Ler `PRD.md` e `SDD.md` e criar uma pasta `tasks` com um arquivo por tarefa a ser executada no desenvolvimento do site.
2. Criar um `CONTEXT.md` com todo o contexto das conversas, e uma skill cuja função é determinar que a conversa e o raciocínio sejam documentados nesse arquivo.
3. Criar também uma skill que mantenha o `README.md` sempre atualizado.

**Entregue:**
- `.claude/tasks/` com 21 arquivos de tarefa mais um `README.md` de índice, contendo ordem de execução, grafo de dependências e matriz de cobertura de requisitos.
- `.claude/skills/documentar-contexto.md` e `.claude/skills/manter-readme.md`.
- Este `CONTEXT.md` e o `README.md` da raiz.

**Correções de estrutura durante a sessão, na ordem em que ocorreram:**
1. As skills foram criadas primeiro em `.claude/skills/<nome>/SKILL.md`, a convenção padrão do Claude Code. O usuário interrompeu e definiu outro formato: um arquivo `.md` por skill, nomeado pela função, sem subpasta.
2. O usuário pediu a pasta `.skills/` na raiz; adotado.
3. Em seguida, pediu para renomear `.skills` para `skills` e mover essa pasta e `tasks/` para dentro de `.claude/`. **Estrutura final: `.claude/skills/*.md` e `.claude/tasks/*.md`**, com PRD, SDD, README e CONTEXT permanecendo na raiz.

Consequência prática: PRD, SDD, README e CONTEXT são os documentos que uma pessoa lê ao abrir o repositório; o plano de execução e as regras de processo vivem em `.claude/`, junto do resto da configuração do agente.

**Aberto:** nenhuma linha de código escrita. As quatro pendências com o organizador (seção 5) continuam bloqueando T03, T06, T11, T13 e T15.

---

## 3. Decisões e raciocínio

### D-01 — Uma tarefa por bounded context, não por camada técnica

**Decidido:** as 21 tasks seguem as fronteiras de contexto do SDD (Inscrição, Cronometragem, Classificação, Identidade, Custódia), e dentro de cada contexto separam domínio, API e UI.

**Por quê:** o SDD afirma que as fronteiras entre contextos **são** a barreira de privacidade. Uma decomposição por camada ("todos os modelos", "todas as telas") destruiria essa propriedade logo no plano de trabalho — o desenvolvedor que implementa "todos os modelos" naturalmente coloca e-mail no mesmo lugar que tempo.

**Descartado:** decomposição por camada e decomposição por tela.

**Reversível:** sim, mas a um custo alto — remontar as tasks depois que o código já seguiu outra estrutura significa refatorar as fronteiras.

### D-02 — Toda *Verificação* do PRD vira critério de aceitação de alguma task

**Decidido:** cada `RF-xx`/`RNF-xx` aparece em ao menos uma task, e a linha de *Verificação* do PRD foi transcrita como critério de aceitação. A cobertura está na matriz de `.claude/tasks/README.md`.

**Por quê:** o PRD já escreveu a suíte de testes ao definir uma verificação por requisito. Reinventar critérios seria trabalho duplicado com risco de divergir do contratado.

**Descartado:** critérios de aceitação redigidos do zero.

### D-03 — Stack assumida como premissa isolada em T01

**Decidido:** Next.js (App Router) + TypeScript estrito, PostgreSQL, Drizzle, Zod, Vitest + Playwright, hospedagem com HTTP/3 e cache de borda.

**Por quê:** nem o PRD nem o SDD fixam tecnologia, mas as três restrições do anexo (verificação por leitura de código, revalidação no servidor, nenhuma consulta partindo do navegador) exigem um framework com execução no servidor por padrão. As demais tasks descrevem **comportamento**, não framework — se a stack mudar, só T01 muda.

**Descartado:** SPA com acesso direto a banco (viola a restrição 3); backend separado do frontend (peça a mais sem ganho para um evento de um dia).

**Reversível:** sim, por construção — foi isolada de propósito.

### D-04 — Classificação como projeção em cache, não como consulta

**Decidido:** T12 constrói um modelo de leitura próprio, cujo tipo **não possui** campos de e-mail, telefone, idade ou sobrenome completo, servido como documento único com revalidação de 15 s; filtro e busca rodam no dispositivo.

**Por quê:** três razões do SDD, nesta ordem — privacidade estrutural (não existe caminho de código para vazar o que o modelo não tem), perfil de carga oposto ao transacional, e tolerância a 30 s de defasagem que os outros contextos não têm.

**Descartado:** busca por nome no servidor. Com 2000 pessoas buscando, uma requisição por tecla digitada é o cenário capaz de derrubar o sistema.

### D-05 — Invariantes críticas impostas pelo banco, não só pela aplicação

**Decidido:** `UNIQUE (participante_id, pitch)`, `CHECK` de idade mínima e `CHECK` que amarra estado `valida` à presença de tempo vivem no esquema (T02).

**Por quê:** RF-12 permite Operadores simultâneos. Verificação em aplicação, sob concorrência, é sujeita a corrida entre leitura e escrita. RF-25 ("no máximo um tempo por participante por pitch") só é garantia real se o banco recusar.

### D-06 — Correção de tempo não altera o instante de desempate

**Decidido:** `corrigirTempo` atualiza o valor e grava novo lançamento na trilha de auditoria, mas **não** mexe em `resolvido_em` (T09).

**Por quê:** RF-31 desempata pelo lançamento mais antigo. Se corrigir um tempo reposicionasse a tentativa na ordem de desempate, uma correção administrativa mudaria a classificação de terceiros. É um detalhe pequeno com consequência de credibilidade — exatamente o que o PRD lista como contraindicador.

**Anotação:** este é o tipo de decisão que não está escrita explicitamente no PRD nem no SDD; foi derivada da leitura conjunta de RF-22 e RF-31.

### D-07 — Idempotência como requisito de aplicação, não de transporte

**Decidido:** cadastro (FL-03) e lançamento (FL-06) exigem chave de idempotência, com a chave e o efeito gravados na mesma transação.

**Por quê:** o próprio SDD alerta que confiabilidade de transporte garante entrega, não unicidade de efeito — se a confirmação se perde no retorno, o operador reenvia e a operação executa duas vezes. É o ponto onde depender só do TCP produz defeito real.

### D-08 — Sem CAPTCHA no início

**Decidido:** RNF-12 será atendido por honeypot, limite de taxa por IP e tempo mínimo de preenchimento. Desafio interativo só entra se o teste pré-evento indicar necessidade (T05).

**Por quê:** CAPTCHA custa segundos e frustração num fluxo que tem meta de ≤ 90 s e ≥ 95% de conclusão. E o limite por IP precisa de calibração cuidadosa: 100 celulares no Wi-Fi do evento saem do mesmo IP — daí o cenário específico em T18.

### D-09 — Contingência em papel precisa carregar o consentimento

**Decidido:** a ficha impressa de T20 traz o texto de consentimento e o bloco de responsável com assinatura.

**Por quê:** RNF-07 não distingue meio de coleta. Uma ficha de papel sem consentimento do responsável produz exatamente o problema que o sistema foi desenhado para evitar: dado de adolescente coletado sem base legal.

### D-10 — Terminologia: "Pitch"

**Adotado:** o termo oficial é **Pitch**, conforme SDD §3, com "Pista" tratado como sinônimo obsoleto.

**Ressalva:** o próprio SDD marca isso como decisão a confirmar com o organizador. Está na seção 5 como pendência, porque divergência entre o termo do código e o termo falado no corredor é origem clássica de erro de operação.

### D-11 — Fronteira de contexto por `no-restricted-imports`, com teste que a vigia

**Decidido:** as fronteiras do SDD §2 são impostas pelo `no-restricted-imports` nativo do ESLint, configurado por diretório em `eslint.config.mjs`, e verificadas por `tests/fronteiras.test.ts`, que roda o ESLint programaticamente sobre trechos sintéticos.

**Por quê o teste, e não só a regra:** ao validar a regra manualmente, ela deixava passar o import de fachada — `@/contexts/x/**` não casa com `@/contexts/x`, porque `patterns` usa semântica gitignore. Uma regra de lint que silenciosamente para de valer é pior que regra nenhuma: dá a sensação de proteção sem a proteção. Como esta regra específica **é** a barreira que sustenta RNF-08 e RNF-09, ela precisa de teste próprio.

**Detalhe de implementação que não é óbvio:** a exceção de Cronometragem para `inscricao/contrato` não pode ser expressa por negação (`!`) dentro de `patterns`, porque a semântica gitignore impede re-incluir um arquivo sob diretório já excluído. Solução: a fachada é bloqueada por `paths` (correspondência exata) e os subcaminhos por `patterns` — só assim a exceção continua expressável.

**Descartado:** `eslint-plugin-boundaries`. Uma dependência a mais para o que o ESLint nativo resolve, e com sintaxe própria a manter.

### D-12 — Validação de ambiente preguiçosa, forçada no boot

**Decidido:** `src/shared/env.ts` expõe `validarAmbiente(fonte)` (pura, testável) e `env()` (memoizada). Quem força a validação no start é `instrumentation.ts`.

**Por quê:** validar no import do módulo tornaria o arquivo impossível de testar com entradas sintéticas e explodiria em qualquer bundle onde `process.env` não existe. Validar tarde demais transformaria configuração errada em erro 500 no meio do evento. O `instrumentation.ts` do Next resolve os dois: roda uma vez, antes da primeira requisição.

**Verificado:** com as variáveis ausentes, o servidor recusa iniciar e nomeia cada uma.

### D-13 — `paraNomePublico` implementado em T01, antes da T12

**Decidido:** a função que converte "Dhiego Ferreira" em "Dhiego F." e o tipo `LinhaClassificacao` foram escritos já na fundação, embora pertençam formalmente a T12.

**Por quê:** a regra de lint que isola Classificação precisa de um contexto com conteúdo real para ser demonstrável, e a função é a materialização de RNF-09. Escrevê-la agora, com teste, é mais barato que descrever em prosa o que ela fará.

**Consequência:** T12 começa com a fronteira de privacidade pronta e testada; sobra a projeção e o cache.

**Atualizado em 2026-08-19:** a decisão de escrever a função cedo se pagou aqui. Quando RNF-09 foi revisado (D-21), a mudança teve um endereço único — `nomePublico.ts` e seu teste —, em vez de estar espalhada pela projeção e pela UI que ainda nem existem. A conversão em si deixou de ser "Dhiego Ferreira" → "Dhiego F." para todos: agora depende da idade.

### D-14 — PGlite como banco de teste, Postgres gerenciado em produção

**Decidido:** os testes de integração rodam contra PGlite (Postgres compilado para WebAssembly, no processo); a aplicação usa `pg` contra um Postgres gerenciado.

**Por quê:** as invariantes mais caras do sistema vivem em constraints do banco (D-05). Testá-las contra mock verificaria a existência do mock, não da regra. PGlite dá o mesmo motor de constraints sem exigir Docker nem serviço externo, o que mantém a suíte rodando em qualquer máquina e no CI — e resolve, de quebra, o requisito de T17 de usar "banco de teste real, não mock".

**Descartado:** Docker com Postgres (não há Docker na máquina de desenvolvimento e adiciona pré-requisito ao time); banco compartilhado de teste (testes concorrentes disputando estado).

**Limite conhecido:** PGlite é single-process e sem disco próprio, então **não serve para medir desempenho**. Os números de T18 têm de vir do banco real.

### D-15 — Invariante de autoria em duas constraints, não em uma

**Decidido:** `(estado = 'pendente') = (operador_id is null)` e `(estado = 'pendente') = (resolvido_em is null)`, separadas.

**Por quê:** a versão original combinava as duas colunas com `and` do lado direito. Isso cria um caso em que ambos os lados são falsos por motivos diferentes e a igualdade passa: Válida, com instante preenchido e **sem operador**. A regra parecia correta lendo, e não era.

**Lição que vale além deste caso:** invariantes com `and` dentro de uma comparação de igualdade escondem combinações. Quando a regra é "A implica B e A implica C", escreva duas constraints.

### D-16 — Busca por nome cobre prefixo, não infixo

**Decidido:** índice btree sobre `lower(nome)` com `text_pattern_ops`, que atende `LIKE 'jo%'`.

**Por quê:** é o uso real do painel — o Operador digita as primeiras letras do nome que ouviu. Busca por trecho no meio exigiria a extensão `pg_trgm`, que nem todo provedor gerenciado habilita por padrão.

**Pendente:** confirmar em T10, com o provedor escolhido, se `pg_trgm` está disponível e se a busca por infixo é necessária na prática. Registrado como limitação no esquema.

### D-17 — Termo como dado estruturado, um arquivo por versão

**Decidido:** o termo é um objeto com seções identificadas (`dados-coletados`, `retencao`, `exposicao-publica`, …), num arquivo por versão publicada, nunca editado depois de aprovado.

**Por quê:** o mesmo texto sai em três superfícies — `/termo`, o formulário de T06 e a ficha de papel de T20 (D-09). Como string de HTML, cada uma reinterpretaria a marcação, e a exigência de RF-09 de declarar a exposição pública **em destaque** dependeria de alguém lembrar de estilizar a seção certa. Estruturado, o destaque é um campo do dado e a cobertura de RF-09 vira teste.

**Descartado:** guardar o texto em tabela editável no banco. Editar um termo é mudar a base legal de quem já aceitou; um campo de texto em banco convida exatamente a isso, e sem histórico. Descartado também mantê-lo dentro do componente — some da auditoria e volta a ser rodapé.

**Reversível?** Sim, mas com custo: qualquer mudança de formato exige recalcular os hashes declarados, e por isso a decisão sobre a serialização canônica precede a primeira versão aprovada.

### D-18 — Rascunho de termo é recusa em código, não aviso em documento

**Decidido:** enquanto a versão vigente estiver como `rascunho` ou tiver pendências abertas, `assegurarTermoAprovado()` lança — e T05 a chama antes de aceitar cadastro.

**Por quê:** RF-08 diz que nenhum cadastro se conclui sem consentimento, e um consentimento contra texto não aprovado não é consentimento. A alternativa era um aviso no `docs/` e confiança em que alguém confira antes do evento; num dia de pressa, essa conferência é a primeira coisa que cai. A falha que se quer impedir é silenciosa e irreversível: dado de adolescente já coletado sob termo que ninguém validou.

**Efeito colateral aceito:** o teste "a versão vigente ainda é rascunho" **falha de propósito** quando o organizador aprovar. Atualizá-lo faz parte do procedimento de aprovação, descrito em `docs/aprovacao-termo.md` — o incômodo é o mecanismo, não um defeito dele.

**Descartado:** condicionar o guard a `NODE_ENV === 'production'`. Faria a suíte passar sem nunca exercitar a recusa, que é o caminho que importa.

### D-19 — O termo abre em aba nova, e isso é regra de domínio

**Decidido:** `LINK_TERMO` (`target="_blank"`, `rel="noopener noreferrer"`) mora no módulo de consentimento, não no JSX de T06, e tem teste.

**Por quê:** o critério de aceitação é "abrir o termo e voltar não apaga os campos". Navegação na mesma aba desmonta o formulário, e quem está na fila do evento reescreve nome, e-mail, telefone e os dados do responsável. Como atributo solto num link de T06, isso se perde na primeira refatoração e ninguém percebe até o dia.

**Descartado:** salvar rascunho do formulário em `localStorage` para sobreviver à navegação. Resolveria o mesmo problema deixando e-mail, telefone e idade de menor gravados no aparelho — que pode ser emprestado — sem prazo de expurgo. Contraria o espírito de RNF-11 e cria dado pessoal fora do alcance do procedimento de exclusão.

### D-20 — Canal de exclusão presencial, sem canal remoto

**Decidido (2026-08-19, com o usuário):** o pedido de exclusão é feito **presencialmente, no ponto de inscrição durante o evento**. Não existe e-mail nem telefone de contato para isso.

**Por quê:** a proposta inicial do usuário era não ter canal nenhum, com o argumento de que só quem vai participar preenche os dados. O argumento cobre a voluntariedade da coleta, não o caso que de fato ocorre: a classificação é página pública com nome e inicial do sobrenome, e quem se incomoda ao se ver ali — ou o responsável por um menor — precisa de uma resposta. Sem canal, RF-09 ficaria com um item descoberto e a auditoria de T21 acharia o buraco tarde demais.

**Por que presencial resolve:** o evento é de um dia, todo mundo passa fisicamente pelo ponto de inscrição, e a retenção é de 10 dias com expurgo automático (PE-02). O canal remoto existiria para uma janela de 10 dias em que o dado já vai desaparecer sozinho. Presencial custa zero infraestrutura, zero caixa de entrada para alguém monitorar depois do evento, e ainda é o canal mais rápido no único momento em que o pedido é urgente — enquanto o nome está na tela.

**Consequência para T15:** o procedimento de exclusão precisa ser executável por um Operador no dia, não por um script rodado depois. Quem desenhar T15 lê isto antes.

**Superado em parte, na mesma data.** O usuário definiu depois um canal remoto: o e-mail `dhiegodev@hotmail.com` (ver D-22). O presencial permanece como opção durante o evento — mais de um caminho para pedir exclusão nunca é pior para o participante —, mas deixou de ser o único, e T15 passa a precisar atender pedido que chega fora do dia do evento.

### D-21 — RNF-09 revisado: sobrenome completo para maiores, inicial para menores

**Decidido (2026-08-19, com o usuário):** a página pública de classificação mostra nome e sobrenome completos de quem tem 18 anos ou mais, e nome + inicial do sobrenome de quem tem entre 13 e 17. **Isto altera o RNF-09 do PRD**, que antes exigia a inicial para todos.

**Por quê:** o usuário observou que a inicial não resolve o caso real — numa lista de 2000 pessoas, "Dhiego F." não distingue ninguém de "Dhiego Fernandes", e quem procura o próprio resultado (ou o de um amigo) não o encontra. A objeção levantada foi a exposição de menores: nome completo de adolescente ao lado do horário e do local em que ele esteve, numa página pública e indexável, é exposição de outra natureza — e o consentimento do responsável normalmente não é dado com isso em mente. O desfecho separa os dois casos em vez de escolher um deles.

**Descartado:** manter a inicial para todos (não resolve o homônimo, que é o problema que motivou a revisão) e publicar o nome completo de todos, inclusive menores (a exposição de adolescente é justamente o que a regra existia para evitar).

**Consequência aceita, e não eliminável:** o formato passa a **sinalizar quem é menor de idade** — "Lucas M." no meio de nomes completos diz "esta pessoa tem entre 13 e 17 anos". Continua sendo bem menos exposição que o nome completo, e a alternativa (abreviar todos) foi descartada pelo motivo acima. Registrado aqui para que a auditoria de T21 encontre a inferência já avaliada, não como descoberta.

**Onde a regra vive:** `deveAbreviarSobrenome(idade)` em `classificacao/nomePublico.ts`, um lugar só. A projeção lê a idade do banco, chama a função e **descarta a idade**: o modelo público continua sem o campo, e RNF-08 segue sendo propriedade estrutural. `paraNomePublico` passou a exigir a opção `abreviarSobrenome` explicitamente — sem valor padrão, nenhum caller publica o formato errado por omissão.

**Momento da mudança:** feita antes de T12 e T13 existirem, quando custa quatro arquivos e o texto do termo. Depois da UI de classificação construída, custaria bem mais.

**Reversível?** Sim, e o custo é o mesmo de agora — mais uma versão do termo.

### D-22 — O telefone sai da organização, e o termo diz isso com nome e sobrenome

**Decidido (2026-08-19, com o usuário):** o telefone de **todos** os participantes é repassado a duas organizações — a FIAP e uma escolinha de corrida que Lélio Assumpção pretende abrir futuramente. No caso de menor de 18, o telefone repassado é o do responsável, e o bloco de aceite dele passou a autorizar isso explicitamente. Nenhum outro dado sai da organização do NEXT.

**Por quê está escrito assim:** consentimento cobre o que a pessoa marcou, não o que está no meio do texto. Por isso o repasse aparece em três lugares — seção própria (`compartilhamento`), aceite do participante e aceite do responsável. Se aparecesse só no corpo, a autorização para ele não existiria.

**A contradição que a mudança criou, e como foi resolvida:** o termo promete expurgo em 10 dias, e a cópia entregue à FIAP e à escolinha não é nossa para apagar — ainda mais para uma escolinha que talvez nem exista dentro desses 10 dias. Em vez de escolher entre a promessa e o repasse, o texto declara o limite: *"o prazo de 10 dias vale para os nossos sistemas, não para a cópia que está com eles"*, e o pedido de exclusão é **encaminhado** a quem recebeu. Promessa que não se pode cumprir é pior que ausência de promessa.

**Descartado:** repasse só dos ganhadores (o usuário optou por todos) e caixa de autorização separada para o repasse, que seria a opção mais limpa em privacidade e custaria coluna nova em `consentimento`, migração e campo no formulário de T06.

**Registrado como risco, não como decisão:** o e-mail `dhiegodev@hotmail.com` fica exposto em página pública indexável, com o custo previsível de spam. Alternativa, se incomodar: formulário de contato ou endereço dedicado ao evento — muda o texto e exige versão nova.

**Consequência para T15 e T19:** o termo passou a prometer que **o site sai do ar** ao fim dos 10 dias. Isso deixou de ser decisão de infraestrutura e virou compromisso escrito com o participante.

**Superado em parte no mesmo dia:** o repasse deixou de ser condição de inscrição e passou a ser autorização opcional (D-23). O que continua valendo aqui é a lista de destinatários, o limite do prazo e o encaminhamento do pedido de exclusão.

### D-23 — Repasse opcional, termo obrigatório: dois consentimentos, não um

**Decidido (2026-08-19, com o usuário):** o aceite do termo continua obrigatório — sem ele não há cadastro (RF-08) —, mas o repasse do telefone à FIAP e à escolinha virou **caixa separada e opcional**. Quem não marcar se inscreve normalmente.

**Por que não bastou mudar o texto.** Consentimento opcional embutido num aceite obrigatório não é opcional: a pessoa que quisesse correr sem entregar o telefone não teria como. E, sem registro separado, não haveria como provar depois quem autorizou e quem recusou — na hora de montar a lista para a FIAP, o critério seria memória de alguém.

**Três mudanças estruturais, não cosméticas:**

1. Coluna `consentimento.aceite_compartilhamento` (migração `0001_repasse_opcional`), com `default false` — ausência de autorização é recusa, nunca permissão — e **deliberadamente sem `check`**: aqui `false` é dado válido, ao contrário dos outros dois aceites, e é justamente o "não" que precisa ficar gravado.
2. O termo passou a ter `aceites: Aceite[]`, cada um com `obrigatorio` e, quando cabe, `aplicaSe: 'menor-de-18'`. A diferença entre as caixas virou dado consultável por T05 e T06 (`aceitesObrigatorios()`), em vez de convenção que a UI precisa lembrar. O erro que isso previne é banal e caro: copiar o `required` da caixa de cima e transformar o opcional em bloqueante.
3. `obrigatorio` entra no hash de integridade. Tornar obrigatório um aceite opcional muda o que a pessoa consentiu sem mudar uma palavra do texto — e, sem isso no hash, passaria sem versão nova.

**Descartado:** duas colunas (uma para participante, outra para responsável). Uma basta: a coluna registra que o repasse foi autorizado por quem tinha competência para autorizar, e o termo diz quem é essa pessoa em cada caso.

**Consequência para T14:** a exportação precisa respeitar o campo. Lista para a FIAP ou para a escolinha sai filtrada por `aceite_compartilhamento = true`, e essa é a única leitura legítima da coluna.

### D-24 — Nada de travessão no texto que o participante lê

**Decidido (2026-08-19, com o usuário):** o texto do termo e a página `/termo` não usam travessão (`—` ou `–`). Onde havia travessão, agora há ponto, vírgula, dois-pontos ou parênteses.

**Por quê:** observação do usuário ao revisar o item 10 do checklist. O travessão é frequente em texto jurídico traduzido e raro em português brasileiro corrente, e a T03 exige linguagem simples (P3 do PRD). Uma pontuação que faz o leitor hesitar trabalha contra o único objetivo do texto, que é ser entendido de primeira por quem está na fila com o celular na mão.

**Está em teste, e não só combinado.** Preferência de escrita não sobrevive à terceira revisão sem alguém vigiando, e no caso do termo reescrever depois custa uma versão nova. O teste varre tudo que aparece na tela: título, títulos de seção, parágrafos, itens de lista, aceites e o aviso de rascunho.

**Limite deliberado:** vale para o texto lido pelo participante, não para comentários de código, `CONTEXT.md`, `README.md` ou tasks. Ali o travessão continua sendo ferramenta de quem escreve para desenvolvedor.

### D-25 — O guard do termo mora no caso de uso, não no endpoint

**Decidido:** `assegurarTermoAprovado()` é chamado dentro de `registrarInscricao`, e não apenas no endpoint de T05 como a task previa.

**Por quê:** o endpoint é um dos caminhos até a gravação, não o único. Script de importação da contingência em papel (T20), reprocessamento, um segundo endpoint que alguém acrescente em seis meses: todos passam pelo caso de uso, e nenhum deles lembraria do guard sozinho. Colocar a verificação onde o dado é gravado é a diferença entre uma garantia e uma convenção.

**Custo aceito:** o teste do caso de uso depende do termo vigente estar aprovado. Ficou aceitável porque ele está, e porque a recusa continua coberta por teste próprio no módulo de consentimento, com um rascunho sintético.

### D-26 — Código de erro declarado por regra, não derivado do Zod

**Decidido:** cada regra do esquema declara o próprio código em `params.codigo` (`idade_minima`, `telefone_formato`, …), e `CodigoErro` é uma união fechada. O código do Zod (`too_small`, `invalid_type`) só é consultado no fallback, para as falhas de forma.

**Por quê:** RNF-17 pede mensagem específica por campo, e T06 vai precisar reagir a regras específicas — destacar o bloco do responsável é diferente de destacar o telefone dele. Mapear `campo + código do Zod` para intenção funcionaria hoje e quebraria silenciosamente na primeira vez que alguém trocasse um `.min()` por um `.refine()`, porque o código do Zod mudaria sem que nenhum teste percebesse.

**Descartado:** usar a mensagem como identificador. Melhorar a redação quebraria os testes, e o resultado previsível é que ninguém melhora a redação.

**Efeito colateral útil:** a união fechada faz o compilador recusar uma regra nova sem código declarado. A lista continua completa sem depender de disciplina.

---

### D-27 — O limite de taxa conta cadastro concluído, e vem com desligamento de emergência

**Decidido:** a janela deslizante conta apenas cadastros **efetivados**, em duas faixas (30 por 10 minutos, 100 por hora, por origem), com `RATE_LIMIT_ATIVO=false` como desligamento imediato.

**Por quê:** contar toda requisição parece mais seguro e é pior. Quem digita o telefone errado quatro vezes no celular, na fila, gasta cota e acaba trancado fora — e o PRD trata a conclusão do cadastro (≥ 95%) como métrica de sucesso, enquanto um cadastro falso a mais não quebra nada. O custo dos dois erros não é simétrico.

**O risco que fica:** em rede móvel, a operadora coloca milhares de assinantes atrás do mesmo endereço; no local do evento, dezenas de celulares saem do mesmo NAT. Nenhum limite por IP distingue isso de um ataque. Os padrões foram afrouxados e existe a alavanca de desligamento, com teste próprio — mas o número certo só sai da medição de T18, e T21 precisa decidir se o limite fica ligado no dia.

**Descartado:** contador em memória do processo. Zera a cada reinício, que é exatamente quando um ataque compensa, e não sobrevive a mais de uma instância — e o provedor ainda nem foi escolhido (PE-05).

**Descartado também:** balde único para requisições sem endereço de origem. Se o cabeçalho da borda não chegar, os primeiros participantes encheriam o balde e trancariam o evento. Sem origem, não há limite — e T21 confere se a origem chega.

### D-28 — A chave de idempotência é comparada com a digestão do envio

**Decidido:** junto da resposta guardada fica o SHA-256 do envio canonizado. Mesma chave com outro conteúdo é conflito (409), não reenvio.

**Por quê:** sem a comparação, a promessa "mesma chave, mesma resposta" vira "quem apresentar a chave recebe a resposta". Duas pessoas no mesmo ponto de inscrição acabando com a mesma chave — por bug de interface, por cópia de requisição, por um cliente que reaproveita a chave entre formulários — fariam a segunda receber a confirmação com o **nome da primeira**. É vazamento de dado pessoal (RNF-08), não apenas resposta errada.

**Detalhe que custou pensar:** o token do formulário e o honeypot ficam **fora** da digestão. O token muda a cada carga da página, e a retentativa mais comum de todas — recarregar e mandar de novo — viraria conflito se ele contasse.

### D-29 — Tempo mínimo de preenchimento por token assinado, não por campo declarado

**Decidido:** o servidor emite um instante assinado (HMAC) ao renderizar o formulário; o envio devolve o token e o servidor calcula o tempo decorrido.

**Por quê:** a task sugeria medir o tempo entre carga e envio. Feito pelo cliente, isso é perguntar ao suspeito se ele é culpado: qualquer script escreve o número que quiser. Assinado, mentir sobre o tempo exige forjar o HMAC.

**Limite aceito:** o token não é de uso único. Quem carregar a página uma vez e reaproveitar o token por horas passa por aqui. É aceitável porque a barreira que ele venceu custa um pedido de página, enquanto um CAPTCHA custaria segundos de **cada** participante (D-08).

**Efeito colateral:** a chave do token é derivada de `SESSION_SECRET` com rótulo próprio, e não é o segredo cru. Uma fraqueza no token de formulário não vira fraqueza no cookie de sessão do Operador (T08).

### D-30 — O log tem forma fechada e ainda assim é saneado

**Decidido:** `EntradaDeLog` não tem campo onde caiba um corpo de requisição, e o texto livre que sobra (`motivo`, `referencia`) passa por um filtro que apaga e-mail e sequências de dez ou mais dígitos.

**Por quê:** a forma fechada resolve o caso comum e falha de um jeito previsível — alguém interpola o dado dentro da mensagem de um erro de banco, que traz o valor recusado junto. A primeira barreira depende de ninguém contornar a forma; a segunda não depende de nada.

**Custo aceito:** o filtro é mais amplo do que preciso e pode estragar uma mensagem de diagnóstico. Um UUID atravessa intacto, que é o que o suporte precisa para achar o registro.

---

### D-31 — A palavra "Pitch" mora numa constante, com gênero junto

**Decidido:** `src/shared/vocabulario.ts` guarda o substantivo, o plural, o artigo definido, o indefinido e as formas "os dois" / "as duas". A interface nunca escreve a palavra à mão.

**Por quê:** a PE-01 estava listada como bloqueio para congelar a copy de T06, T11 e T13, e esperar o organizador significaria parar. Não é internacionalização: é uma pendência com data para acabar, guardada onde a resposta custa uma linha.

**O detalhe que justifica o gênero:** "o Pitch" e "a Pista" concordam diferente. Uma constante só com o substantivo produziria "escolha o Pista" espalhado por três telas no dia da troca — pior do que não ter constante nenhuma, porque pareceria resolvido.

### D-32 — A validação do cliente é carregada depois da primeira pintura

**Decidido:** o formulário importa `esquemaInscricao` dinamicamente, dispara o carregamento na montagem e o aguarda apenas no envio. As três idades saíram para `idades.ts`, sem dependência, para que a decisão de exibir o bloco do responsável não arraste o Zod junto.

**Por quê:** a task pede validação no cliente com o esquema de T04, importado e não reescrito — e está certa, porque duas cópias da regra divergem. Mas cumprir isso com import estático colocava 286 KB no pacote inicial da única página que 2000 pessoas abrem em rede móvel congestionada (RNF-04). O esquema não serve para nada até alguém tocar no botão, e entre a carga e o toque passam dezenas de segundos de digitação.

**Se o carregamento falhar,** o envio segue sem validação local. O servidor revalida tudo (RNF-13) e devolve as mesmas mensagens no 422 — bloquear o envio porque um recurso opcional não baixou seria transformar otimização em requisito.

**Verificado:** o pedaço que contém o Zod não aparece na lista de scripts do HTML da raiz.

### D-33 — A métrica de conclusão é medida no servidor, não no navegador

**Decidido:** a taxa de conclusão do PRD §7 sai de duas linhas de log do servidor — `inscricao.formulario_aberto` na renderização e o 201 de `inscricao.cadastro` — e o tempo de preenchimento vem do próprio token de T05, que já carrega o instante da carga, assinado.

**Por quê:** a task pedia eventos emitidos pela interface. O servidor já sabia as duas coisas. Evento de navegador custa JavaScript, é bloqueado por parte dos aparelhos, e precisaria de uma URL de coletor exposta ao cliente para funcionar.

**Efeito colateral:** a métrica não some para quem bloqueia rastreamento, e nenhum dado sai do aparelho do participante para medi-la.

---

### D-34 — O orçamento de peso é um script que falha, não uma frase no README

**Decidido:** `npm run orcamento` mede o primeiro carregamento contra a aplicação de pé e sai com erro acima de 150 KB gzip. O número do README vem dele.

**Por quê:** RNF-04 fala em tempo, e tempo depende da rede de quem está na fila. O que dá para controlar deste lado é o peso — e um teto que ninguém verifica é uma frase que envelhece no primeiro import distraído. O caso concreto já existia: bastava trocar o import dinâmico do Zod (D-32) por um estático para somar 60 KB sem que nada quebrasse.

**Medido em gzip, não em brotli:** brotli é o melhor caso e depende da borda estar configurada. Passar no pior caso é a garantia que sobrevive a uma troca de hospedagem (PE-05).

**Fora da conta:** o pacote `nomodule`, que navegador moderno não pede, e o que é carregado depois da primeira pintura. Contar os dois faria o orçamento reprovar por bytes que ninguém baixa.

**Não entrou no CI:** medir exige a aplicação de pé, com variáveis de ambiente e uma porta. Isso é ambiente de deploy, e pertence a T19.

### D-35 — O destino do QR fica escrito dentro do arquivo do QR

**Decidido:** o SVG gerado carrega `<title>Inscrição SpeedX — {url}</title>` e a data de geração, e o script avisa em voz alta quando a `APP_URL` ainda é provisória.

**Por quê:** dois QR impressos são indistinguíveis a olho nu. Sem o destino gravado, descobrir para onde aponta o cartaz que já está na parede exige escanear — e ninguém escaneia o cartaz errado por engano, justamente porque parece certo. O domínio ainda não existe (PE-05), então o arquivo de hoje é um espaço reservado que **vai** ser regerado, e o risco de alguém mandar o provisório para a gráfica é real.

**Efeito colateral útil:** a tabela de tamanhos de impressão é calculada a partir do arquivo, não escrita à mão. Uma URL definitiva mais longa empurra o símbolo para uma versão com mais módulos, e a tabela muda junto.

---

### D-36 — A sessão do Operador mora no banco, não dentro do cookie

**Decidido:** o cookie carrega um número aleatório de 256 bits e nada mais; tudo o que a sessão significa está em uma linha da tabela `sessao`, e o que fica gravado lá é o HMAC do token, não o token.

**Por quê:** a alternativa — token assinado autocontido — dispensa a consulta por requisição e é o padrão recomendado por quase toda documentação. Ela quebra numa pergunta só: o que acontece quando a organização precisa tirar um Operador do ar no meio do evento? Com validade de dezesseis horas, nada acontece até o prazo vencer. Sair também não sairia de verdade. Um sistema que registra autoria de Lançamento (RF-23) precisa poder revogar a assinatura no instante em que decide isso.

**O custo, medido pelo uso real:** uma consulta por índice único, por requisição autenticada, feita por um punhado de Operadores a poucos lançamentos por minuto. As duas mil pessoas do cadastro público nunca passam por esse caminho.

**Efeito colateral útil:** desativar a conta derruba as sessões abertas em todos os aparelhos sem código nenhum a mais, porque a consulta junta `operador` e confere `ativo`.

### D-37 — scrypt no lugar de Argon2id ou bcrypt

**Decidido:** `node:crypto.scrypt`, N=2^16, r=8, p=1 — 64 MiB e cerca de dois décimos de segundo por conferência. O hash gravado carrega algoritmo e parâmetros.

**Por quê:** a T08 pedia Argon2id ou bcrypt. O que os une e importa é serem lentos de propósito e caros em memória; scrypt é as duas coisas e já está no Node. `argon2` e `bcrypt` exigem node-gyp, e o provedor de hospedagem ainda não existe (PE-05) — uma dependência que precisa de toolchain C é exatamente o que falha no primeiro deploy de um sistema sem janela de manutenção. `bcryptjs`, a saída em JavaScript puro, resolve a compilação piorando o que interessa.

**Descartado com registro:** trocar depois é barato, porque `conferirSenha` lê o algoritmo de cada hash em vez de supor o atual. Se T19 escolher uma hospedagem que ofereça Argon2id sem custo de build, a migração é gradual e sem reset de senha.

### D-38 — O limite de taxa desceu para `src/infra/`

**Decidido:** o mecanismo de janela deslizante saiu de `contexts/inscricao/` para `src/infra/limiteDeTaxa.ts`, camada nova abaixo dos contextos. Em Inscrição ficou só a política do cadastro.

**Por quê:** não foi arrumação. Identidade precisa do mesmo mecanismo e **não pode** importar Inscrição — o lint recusa, e o SDD §2 é o motivo. `shared/` não servia: é folha da árvore de dependências e não alcança o banco. O próprio arquivo já previa a mudança desde T05, num comentário.

**Regra nova, imposta por lint:** `infra/` não importa contexto nenhum, e rota não importa `@/infra` — senão o caso de uso do contexto seria contornável pelo caminho de baixo.

### D-39 — O desligamento de emergência não alcança o login

**Decidido:** `RATE_LIMIT_ATIVO=false` desliga o limite do cadastro público e não toca no limite de tentativas de login. Quem define a política é o contexto; o mecanismo comum não sabe que a alavanca existe.

**Por quê:** a alavanca foi criada em D-27 para um cenário específico — o limite recusando participante de verdade na fila, sem tempo de publicar código novo. Enquanto a política morava dentro do mecanismo, puxá-la teria destravado junto a força bruta contra o painel. É o tipo de efeito colateral que ninguém decide e que só se descobre depois.

**Como o login conta, ao contrário do cadastro:** consome cota a tentativa **recusada**, e em duas faixas — por origem, contra quem varre muitas contas de um lugar só, e por conta, contra quem varre muitas senhas de muitos lugares. Sem a segunda, uma botnet distribuída passa direto.

### D-40 — A renovação silenciosa acontece na API, não na página

**Decidido:** a sessão desliza nas rotas de `/api/painel`, e no máximo uma vez a cada `SESSAO_RENOVACAO_MINUTOS`. As páginas do painel só leem.

**Por quê:** duas limitações reais, e nenhuma delas é preferência. Server Component não escreve cookie — a resposta pode já estar sendo transmitida quando a decisão sairia. E renovar a cada requisição seria um UPDATE por chamada do painel sem nada em troca, com a fila e a classificação disputando o mesmo banco durante o evento.

**O que isso garante, na prática:** durante a operação o painel conversa com a API o tempo todo, então a sessão desliza sozinha enquanto houver trabalho. Para quem logou e ficou parado vale o teto de `SESSAO_HORAS`, que cobre o evento inteiro com folga.

### D-41 — O saneamento do log deixa passar UUID inteiro

**Decidido:** `sanear` retira os UUIDs de cena antes dos filtros de e-mail e telefone e os devolve intactos depois.

**Por quê:** o filtro de telefone apaga dez dígitos ou mais separados por hífen, ponto ou espaço. Um UUID sorteado com onze dígitos seguidos no começo tem exatamente essa forma — `cb103307-9014-43c3-...` virava `cb[removido]c3-...`. O comentário do arquivo afirmava o contrário desde T05, e o teste passava porque o exemplo escolhido à mão tinha letras cedo o bastante. O que se perdia era o identificador que liga a linha de log ao registro que ela descreve: o Operador que assinou o Lançamento, apagado justamente no rastro que existe para dizer quem assinou.

**O que se paga:** um telefone escrito na forma exata de um UUID hexadecimal atravessaria. Nenhum caminho do sistema produz esse texto — telefone entra por uma coluna que o banco obriga a ser dez ou onze dígitos e nada mais.

### D-42 — O teto de processos dos testes precisou ser reescrito

**Descoberto:** `vitest.config.mts` limitava a três processos por `poolOptions.forks` desde T02. O Vitest 4 **removeu** essa opção — avisava a cada execução e rodava com a paralelização padrão. A suíte vinha passando por folga de memória, não por configuração.

**Como apareceu:** dois arquivos de banco a mais e uma derivação de senha que reserva 64 MiB por conferência derrubaram um worker de forma intermitente, com "Worker exited unexpectedly". Reescrito como `maxWorkers: 2`.

**Lição registrada porque vai se repetir:** um aviso de depreciação que ninguém lê é uma configuração que deixou de existir sem que nada quebre — até o dia em que quebra por outro motivo aparente.

### D-43 — Os comandos de terminal passaram a ler o `.env`

**Decidido:** `src/shared/ambienteCli.ts` carrega a configuração com `@next/env`, e `db:migrate`, `db:seed` e `criar-operador` a chamam antes de qualquer coisa.

**Por quê:** `next dev` e `next start` carregam o `.env` sozinhos; `tsx` não. Os três comandos morriam na validação de ambiente reclamando de `DATABASE_URL` com o arquivo ali ao lado. Quem os usou até aqui exportou as variáveis à mão — funciona, e esconde o problema de quem chegar depois.

**`@next/env` e não `dotenv`:** é a mesma implementação que a aplicação usa, já vem instalada, e respeita a mesma ordem de arquivos. Um segundo carregador com regras próprias faria o comando enxergar uma configuração e a aplicação, outra — que é pior do que não carregar nada.

---

### Fechamento das decisões da T08 — 2026-08-23

Levantadas na entrega da T08 e revisadas com a definição do banco na mão.

| # | Decisão | Fechamento |
|---|---|---|
| D-36 | Sessão no banco | **Confirmada.** A revogação imediata continua sendo o que um sistema com autoria de Lançamento (RF-23) precisa ter, e o custo — uma consulta por índice único, para um punhado de Operadores — não muda com a escolha de hospedagem |
| D-37 | scrypt no lugar de Argon2id | **Confirmada como definitiva para o evento.** Ver abaixo |
| D-38 | Limite de taxa em `src/infra/` | **Confirmada.** Imposta por lint e coberta por `tests/fronteiras.test.ts`; não havia alternativa, já que Identidade não pode importar Inscrição |
| D-39 | Alavanca de emergência não alcança o login | **Confirmada, e completada por D-44** — sozinha, deixava um buraco operacional |
| D-40 | Renovação silenciosa só na API | **Confirmada.** As duas limitações que a motivaram são do framework, não preferência: Server Component não escreve cookie, e um UPDATE por requisição seria escrita pura durante o evento |

**Por que D-37 fica como está.** A decisão original era condicional: "se a hospedagem oferecer Argon2id sem custo de build, trocar é barato". Com PostgreSQL definido e a hospedagem ainda em aberto, a condição não se resolveu — e trocar agora custaria uma dependência nativa nova em um sistema que roda um dia só, para ganhar pouco. As contas do painel são meia dúzia, com senha de no mínimo doze caracteres escolhida por quem administra, não pelo usuário; o cenário que separa Argon2id de scrypt na prática é o vazamento de uma base com milhões de senhas fracas escolhidas por gente. O formato gravado carrega o algoritmo, então a porta continua aberta depois do evento sem reset de senha.

**Parâmetros, para quem for revisar:** N=2^16, r=8, p=1 — 64 MiB e cerca de dois décimos de segundo por conferência. Dobrar para N=2^17 é mudar uma constante em `senha.ts`, e o custo é dobrar também a pressão de memória da suíte, que já derrubou um worker uma vez (D-42).

### D-44 — O limite de login ganha uma alavanca própria

**Decidido:** `npm run criar-operador -- --destravar marina` zera as marcas de limite de login daquela conta e as de origem, e o limite volta a contar na tentativa seguinte.

**Por quê:** D-39 tirou o login do alcance de `RATE_LIMIT_ATIVO`, e isso estava certo — mas não pôs nada no lugar. O resultado era um sistema sem saída para o caso mais provável do dia: senha de doze caracteres, digitada em tablet, de pé, sob sol, com o teclado capitalizando a primeira letra. Dez erros e o Operador ficava fora por quinze minutos. RNF-16 dá quinze **segundos** para um lançamento inteiro; quinze minutos é a fila de um Pitch parada, e a única saída seria editar a tabela no terminal, no meio do evento, sem rastro.

**Por que não é um buraco de segurança.** Roda no terminal de quem já tem a `DATABASE_URL` — a mesma autorização que cria contas (RNF-14). Quem chega aqui já podia apagar a tabela inteira. E zera o contador, não desliga o limite: um teste cobre exatamente isso, refazendo as dez tentativas depois do destravamento e conferindo que a trava volta.

**O que ela apaga, e o que não apaga.** Apaga as marcas da conta e **todas** as de origem do escopo de login — não dá para mirar só a origem certa, porque o que fica gravado é o HMAC do endereço e ninguém digita um HMAC no terminal; se as dez tentativas saíram do mesmo tablet, que é o caso comum, limpar só a conta não destravaria nada. Não encosta no limite do cadastro público, que é o que protege as duas mil inscrições (RNF-12) — e há teste para isso.

---

### D-45 — A divergência de collation entre PGlite e Postgres nativo, e o que fazer com ela

**Medido em 2026-08-23**, na primeira conexão com um PostgreSQL de verdade:

| | PGlite 0.5.5 | PostgreSQL 18.6 local |
|---|---|---|
| `datcollate` | `C` | `Portuguese_Brazil.1252` |
| `datctype` | `C.UTF-8` | `Portuguese_Brazil.1252` |
| `lower('JOÃO')` | `joão` | `joão` |
| `LIKE 'pre%'` com btree comum | **usa o índice** | **não usa**, nem com `enable_seqscan = off` |

**O que isso não afeta:** o dobramento de caixa com acento é idêntico nos dois, então a unicidade de `lower(usuario)` do Operador e a busca por nome com acento se comportam igual. E o nome de usuário do Operador é ASCII por construção — `esquemaUsuario` recusa qualquer outra coisa —, então ali a questão nem se coloca.

**O que isso afeta, e é sério:** `text_pattern_ops` é decorativo em collation `C` e **obrigatório** fora dela. Um refactor que o removesse deixaria a suíte inteira verde e transformaria a busca do painel (RF-16) em varredura sequencial sobre 2000+ linhas a cada tecla digitada pelo Operador — em produção, e só lá. É a pior forma de defeito que este projeto pode ter: invisível no lugar onde se procura por defeitos.

**Duas defesas, porque nenhuma sozinha basta.** O teste em `tests/esquema.test.ts` afere a **declaração** do índice, que é o que se perde num refactor; ele não afere o plano, e não teria como, porque no PGlite o plano é outro por construção. E o cabeçalho da T10 manda conferir o `EXPLAIN` contra um Postgres real antes de fechar a task.

**Descartado:** alinhar os dois collations. Forçar `C` em produção quebraria a ordenação alfabética de nomes; forçar `pt_BR` no PGlite não é possível — ele embute o que embute. Conviver com a divergência **sabendo onde ela morde** é mais honesto do que fingir que os dois motores são idênticos.

**Consequência para o resto do projeto:** a frase "PGlite é o mesmo Postgres" continua verdadeira para constraints, tipos, transações e códigos de erro — que é o que a suíte de fato verifica. Ela não é verdadeira para **plano de execução**, e nenhuma decisão de desempenho deve ser tomada com base no que o PGlite faz. T18 mede contra banco real, e agora há um.

---

### D-46 — A idempotência desceu para `src/infra/`

**Decidido:** o mecanismo de chave de idempotência — digestão canônica, consulta, gravação e leitura de violação de unicidade — saiu de `contexts/inscricao/submeterInscricao.ts` para `src/infra/idempotencia.ts`.

**Por quê:** exatamente o motivo de D-38. Cronometragem precisa do mesmo mecanismo para FL-06 e **não pode** importar Inscrição — o lint recusa, e o SDD §2 é a razão. A alternativa seria uma segunda implementação, e duas idempotências divergem no dia em que uma ganha um caso especial que a outra não tem.

**O que ficou em cada lado:** `infra/` tem o mecanismo; Inscrição manteve só a lista de campos que ficam fora da digestão, que é decisão dela (o token do formulário muda a cada carga). Os 40 testes de T05 e T06 passaram sem alteração — sinal de que a fronteira estava no lugar certo.

### D-47 — A máquina de estados é uma tabela, não uma sequência de `if`

**Decidido:** `TRANSICOES` é um objeto com três entradas e cinco atributos cada: origens permitidas, destino, tipo de Lançamento, se exige Tempo e se carimba `resolvido_em`.

**Por quê:** o atributo `carimbaResolucao` justifica a escolha sozinho. `resolvido_em` é o critério de desempate de RF-31; a correção de Tempo **não** pode alterá-lo, senão um acerto administrativo muda a posição de terceiros. Como ramo dentro de uma função de trinta linhas, essa regra sobrevive até a primeira refatoração distraída. Como coluna de uma tabela, ela é lida por um teste de três linhas que não precisa de banco.

**Efeito colateral:** as três funções públicas (`registrarTempo`, `corrigirTempo`, `marcarAusente`) são casca sobre um motor único. A parte difícil — trava, transação, auditoria, idempotência — existe uma vez só, e é justamente a parte que ninguém revisa três vezes com o mesmo cuidado.

### D-48 — `SELECT ... FOR UPDATE` em vez de compare-and-set

**Decidido:** a linha da Tentativa é travada dentro da transação, não atualizada com `WHERE estado = ?`.

**Por quê:** a task oferecia as duas. O compare-and-set é mais barato e não serve aqui: a correção precisa do `tempo_ms` **anterior** para a trilha de RF-23, e lê-lo antes do UPDATE sem travar reabre exatamente a janela que o compare-and-set existia para fechar.

**Descartado:** ler o anterior de dentro do próprio UPDATE. O Postgres não expõe `OLD` em `RETURNING`, e emular isso com CTE deixaria a operação mais difícil de ler do que o problema justifica.

### D-49 — Segundo registro é recusa, não conversão silenciosa

**Decidido:** `registrarTempo` sobre Tentativa que já tem Tempo devolve `transicao_recusada` **carregando o Tempo atual**, em vez de virar correção automaticamente.

**Por quê:** RF-25 admite "bloqueada ou tratada como correção", e as duas cumprem a letra. Converter em silêncio apaga um resultado medido sem ninguém confirmar — e o PRD §7 lista "contestação que o sistema não consiga esclarecer" como contraindicador. Devolver o valor que está lá permite ao painel de T11 perguntar antes, o que também é RF-18.

**Consequência para T11:** a tela precisa tratar essa situação como oferta de correção, não como erro vermelho. Está anotado no tipo de retorno.

---

### D-50 — Busca por trecho e sem acento, sem índice, decidida por medição

**Decidido:** a busca do painel (RF-16) casa **trecho** em qualquer posição, sem distinção de acento nem de caixa, com `translate(lower(coluna), ...)` e `like '%termo%'`. Sem índice novo, sem `pg_trgm`.

**Por quê, com os números.** A T02 tinha adiado esta decisão para cá, quando o banco estivesse escolhido. Medido contra os 2000 participantes reais:

| forma | custo |
|---|---|
| prefixo, usando os índices `text_pattern_ops` | 77 buffers |
| trecho, sem índice nenhum | **73 buffers** |

Nesta escala o índice economiza duas páginas de índice e paga as outras vinte e oito no heap de qualquer jeito. `pg_trgm` seria uma extensão a instalar e um índice GIN a manter, no dia do evento, para ganhar nada mensurável.

**E acento não era detalhe:** 677 dos 2000 nomes têm acento. Sem normalizar, um terço da massa fica inalcançável para quem digita sem acento — que é como se digita com pressa, em tablet, de pé.

**`translate` e não `unaccent`:** `unaccent` é extensão, não vem no PGlite e não é `IMMUTABLE` sem embrulho. `translate` é função de núcleo, roda igual nos dois motores e caberia num índice se um dia precisar. O mapa de acentos mora em `busca.ts`, escrito uma vez e usado pelos dois lados — divergir as duas cadeias faria a busca falhar exatamente nos nomes acentuados.

**O que se paga:** a Fila deixou de usar `participante_nome_idx` e `participante_sobrenome_idx`. Eles ficam, porque removê-los custa uma migração para ganhar nada, e são o remédio imediato se a massa crescer. **Quando isto deixa de valer:** uma ordem de grandeza a mais de participantes. T18 mede; o upgrade nesse dia é GIN sobre a mesma expressão.

**Relação com D-45:** o aviso deixado no cabeçalho da T10 mandava conferir o `EXPLAIN` da busca por prefixo. Foi atendido de forma mais forte — medindo as duas formas antes de escolher, em vez de confirmar a escolhida.

### D-51 — A guarda de sessão é repetida em cada rota, de propósito

**Decidido:** cada `route.ts` do painel chama `exigirOperadorNaApi()` nas próprias linhas. Não existe `withAuth` embrulhando o handler.

**Por quê:** o embrulho é mais limpo de escrever e faz a proteção **sumir do arquivo que ela protege**. `tests/painelGuarda.test.ts` afirma, lendo cada rota, que a guarda está lá — é assim que uma rota nova de T11 que esqueça a proteção falha o teste em vez de ir para produção aberta. Duas linhas repetidas por arquivo compram uma verificação estrutural que cobre código que ainda não foi escrito.

**Descartado:** confiar num `proxy.ts` para cobrir tudo sob `/api/painel`. Mesmo motivo de T08: a documentação do Next é explícita que proxy serve para conferência otimista, não como única defesa.

### D-52 — `POST /tentativa` dispensa chave de idempotência

**Decidido:** a inclusão em Pitch adicional (RF-24) não pede `chave`, ao contrário das três transições de Tempo.

**Por quê:** a unicidade `(participante_id, pitch)` no banco já torna a operação idempotente por construção. O reenvio esbarra na constraint e volta como `409 tentativa_ja_existe` — que é exatamente a informação que uma chave de idempotência devolveria. Exigir a chave seria cerimônia sem efeito, e cerimônia sem efeito ensina a ignorá-la onde ela importa.

---

## 4. Premissas assumidas

| # | Premissa | Se cair |
|---|---|---|
| P-01 | ~~Stack Next.js + PostgreSQL (D-03)~~ — **deixou de ser premissa em 2026-08-18**: Next 16.3, React 19.2, TypeScript 6.0, Zod 4.4 e ESLint 9.39 estão instalados e verificados | — |
| P-07 | PostgreSQL segue como escolha de banco, ainda não instalado nem provisionado | T02 muda; os contextos não, pois nenhum depende do banco ainda |
| P-02 | A hospedagem anunciará HTTP/3 | FL-02 e FL-07 caem para TCP e RNF-04 fica em risco; verificação obrigatória em T19/T21 |
| P-03 | Dois Pitches, valores 1 e 2, fixos | `CHECK (pitch IN (1,2))` e a UI de duas abas precisam mudar |
| P-04 | Um único evento, sem multi-evento | O esquema não tem `evento_id`; acrescentar depois é migração custosa |
| P-05 | Operadores em número pequeno, criados por CLI | Se forem muitos, será preciso uma tela de administração |
| P-06 | Idade é informada, não derivada de data de nascimento | Segue o PRD (RF-02 pede "idade"); se virar data de nascimento, T02, T04 e T06 mudam |

---

## 5. Pendências abertas

| # | Pendência | Quem resolve | Bloqueia |
|---|---|---|---|
| PE-01 | Termo oficial: **Pitch** ou **Pista** — **deixou de bloquear em 2026-08-20**: a palavra vive em `src/shared/vocabulario.ts` (D-31), e trocá-la custa uma linha. Continua aberta como decisão. | Organizador | — |
| PE-02 | ~~Prazo de retenção dos dados após o evento (RNF-11)~~ — **resolvida em 2026-08-19**: máximo de 10 dias após o evento, definido pelo usuário. Já escrito na seção `retencao` do termo; T15 usa a data do evento (PE-06) como base da contagem | — | — |
| PE-03 | ~~Canal para solicitação de exclusão de dados (RF-09)~~ — **resolvida em 2026-08-19**: presencial, no ponto de inscrição durante o evento; sem canal remoto (D-20). Já escrito na `v0.2` do termo | — | — |
| PE-04 | ~~Aprovação por escrito do texto de consentimento (RF-09)~~ — **resolvida em 2026-08-19**: `v1.0-2026-08-19` aprovada por Dhiego, registro em `docs/aprovacao-termo.md`. Se o organizador formal do NEXT for outra pessoa, cabe contra-assinar, sem custo de versão | — | — |
| PE-05 | Hospedagem e banco. **Resolvida na metade em 2026-08-23**: o banco é **PostgreSQL 18**, decidido pelo usuário depois de a avaliação mostrar que o Autonomous Database da Oracle é incompatível de fundo com o projeto. Falta **onde** hospedar aplicação e banco em produção. **Continua bloqueando a impressão**: sem o domínio definitivo, o QR de `docs/qr/inscricao.svg` é provisório (D-35) | Time técnico | T19 (hospedagem), material impresso de T07 |
| PE-06 | Data do evento e janela de operação. **O local foi confirmado em 2026-08-23: São Paulo**, o que fixa o fuso de `formatHoraDoEvento` (`America/Sao_Paulo`). Falta a **data** | Organizador | T15 (data-base da retenção), T19 (congelamento de deploy) |

---

## 6. Vocabulário do projeto

Glossário completo no [SDD §3](SDD.md). Os termos que mais causam confusão:

- **Pitch** — uma das duas pistas. É atributo da **Tentativa**, nunca do Participante.
- **Tentativa** — intenção registrada de um Participante disputar um Pitch. Nasce Pendente na Inscrição. É o agregado raiz da Cronometragem. Evitar chamar de "corrida", porque "corrida" também nomeia o evento inteiro.
- **Lançamento** — o **ato** de registrar um Tempo. Distinto de **Tempo**, que é o valor. RF-23 rastreia lançamentos, não tempos.
- **Nome Público** — nome + inicial do sobrenome. Existe **somente** no contexto de Classificação; é o único identificador pessoal admissível em superfície pública.
- **Ausente** — estado da Tentativa de quem não compareceu. Sai da Fila, permanece na Exportação, não aparece na Classificação. **Não é exclusão.**
- **Operador** — usuário autenticado que faz lançamentos. O organizador chama de "supervisor"; no sistema, o termo oficial é Operador.
- **Versão do termo** — identificador do texto de consentimento (`v0.1-rascunho-2026-08-19`), gravado em `consentimento.versao_termo` a cada cadastro. Não é número de release do sistema: muda quando o **texto** muda, e só então.
- **Sessão** — linha da tabela `sessao` que liga um Operador a uma janela de tempo. O cookie do navegador não é a sessão: é um número aleatório que aponta para ela. Encerrar a sessão é escrever uma coluna, não esperar um prazo.
- **Guarda** — a conferência de acesso feita no servidor antes de qualquer trabalho: `exigirOperador` nas páginas do painel, `exigirOperadorNaApi` nas rotas. Não é o mesmo que "não ter link para o painel".
- **Rascunho** (de termo) — versão ainda não aprovada pelo organizador. Não é rótulo editorial: sob rascunho, nenhum consentimento pode ser registrado (D-18).
