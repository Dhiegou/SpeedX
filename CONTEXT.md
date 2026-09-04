# CONTEXT.md — Contexto, decisões e raciocínio

Registro vivo do projeto. Documenta o **porquê**; o **o quê** está no [PRD.md](PRD.md), no [SDD.md](SDD.md), em [.claude/tasks/](.claude/tasks/README.md) e no código.

Mantido segundo a skill [`.claude/skills/documentar-contexto.md`](.claude/skills/documentar-contexto.md).

---

## 1. Estado atual

**2026-08-28.** Vinte tarefas tocadas (T01–T17 e T22 concluídas; T18 e T19 parciais) e **632 testes passando** — 613 de unidade e integração, mais 19 de ponta a ponta. `npm run check` limpo. Publicado em https://github.com/Dhiegou/SpeedX.

**As cinco trilhas de produto estão fechadas, o dia do evento é observável e a suíte cobre os 53 requisitos do PRD.** T15 fechou o ciclo de vida do dado pessoal (`docs/retencao.md`); T16 pôs de pé `/api/saude`, o painel do dia e o relatório de métricas (`docs/monitoramento.md`); T17 traduziu cada linha *Verificação* do PRD em teste executável e — o que importa mais — pôs um teste a **vigiar** essa tradução (`docs/testes.md`).

**Não resta tarefa por começar.** O que resta é o que nenhuma delas podia resolver de dentro do repositório: **um domínio publicado, três contas contratadas e uma tarde de ensaios**. A T21 auditou o que é código e deixou tudo isso escrito em `docs/checklist-pre-evento.md`, com dono e consequência por item — e o checklist **não tem assinatura**, de propósito: a rodada não autoriza o evento.

**A T20 fechou o que é código.** `npm run fichas` gera a ficha numerada, o termo integral e a folha de tempos, todos lendo o mesmo `TERMO_VIGENTE` que a tela; um teste compara papel e esquema nos dois sentidos (D-86). O que falta é imprimir e ensaiar, e as duas coisas são do dia.

**A T18 mediu e achou o que procurava.** Leitura sustentada a 200 req/s com p95 de 7,9 ms e zero 5xx; documento público de 14 KB comprimidos; propagação de ~20 s com borda. E um reprovado: **o limite de taxa, como está configurado, recusaria a fila do evento** — 200 cadastros do mesmo IP viraram 30 aceitos e 170 recusados. A proposta de calibração está em `docs/relatorio-carga.md`, e **T23 decidiu** em 2026-09-01: 800 por janela e 2400 por hora, acima da proposta, porque a premissa de três a cinco IPs não se confirmou (D-90).

**A T19 está parcial, e a divisão é limpa.** Tudo o que o repositório decide sozinho está decidido, testado e escrito: região da função colada à do banco, pool dimensionado contra o pooler e não contra o número (D-80), HSTS com prazo (D-81), a versão publicada saindo do commit, `docs/deploy.md` e `docs/plano-do-dia.md`. O que falta são sete verificações que exigem **um endereço publicado e três contas criadas** — HTTP/3 anunciado, `HIT` de borda, sincronia de relógio, restauração de backup. Estão no checklist de `docs/deploy.md` §8, cada uma com o comando ao lado.

**Três requisitos continuam sem verificação automática**, cada um com justificativa escrita que um teste obriga a existir: RNF-04 (rede real), RNF-05 (o dia do evento) e RNF-15 (gente com cronômetro). **RNF-18 saiu dessa lista em T17** — 360 px é uma largura, e um navegador sabe ser 360 px. **RNF-06 saiu em T20**: a ficha de papel virou artefato gerado e comparado com o esquema por teste (D-86); o que sobrou de manual é o ensaio, que é item de T21.

**2026-08-25 — o organizador respondeu três pendências, e uma delas mudou uma palavra do produto.**

- **PE-01 fechou, e não como o projeto supunha.** Não é "Pitch" nem "Pista": são dois **Cockpits**, que é onde fica o simulador (D-75). A palavra na tela mudou primeiro; o identificador do banco e da API acompanhou horas depois, na **T22** (D-77), porque manter dois nomes para o mesmo conceito é o que a linguagem ubíqua existe para impedir.
- **PE-06 fechou.** O evento é em **24 de outubro de 2026**. Preenche a última linha vazia de `docs/retencao.md` e data o vencimento da retenção: **4 de novembro de 2026, 00:00** em São Paulo. O comando de expurgo continua sem valor padrão, de propósito (D-63).
- **PE-05 fechou mais um terço.** A aplicação vai para a **Vercel, plano gratuito** (D-76). Continuam sem destino **quem hospeda o Postgres**, qual é o **domínio** e o **monitor externo** — e são eles, não a aplicação, que ainda seguram o QR definitivo (T07), a T19 e o desligamento do site prometido no termo.

**2026-08-27 — sobrou uma coisa de PE-05, e é a que tem o maior prazo.** O banco é o **Neon em São Paulo** (D-79) e o monitor é o **UptimeRobot gratuito** (D-82). **O domínio não existe**, e é ele que segura o resto: sem endereço publicado não há `curl --http3`, não há `HIT` de borda para conferir e o QR de T07 continua provisório. Material impresso precisa de folga antes de 24/10, e uma URL de comprimento diferente muda o número de módulos do código — o QR se refaz, não se corrige.

---

## 2. Linha do tempo das sessões

### 2026-08-28 — Sessão 25: execução da T21

**Pedido:** fazer a T21.

**Entregue:** `npm run auditar`, `tests/auditoria.test.ts` e `docs/checklist-pre-evento.md`. **Parte 1 fechada com evidência item a item**; Partes 2 e 3 levantadas, cada pendência com dono e consequência.

**A auditoria virou comando.** A task pedia leitura de código, e leitura confere o código de hoje contra a massa de hoje. `npm run auditar` confere o corpo que sai de verdade contra o banco de verdade, aceita um alvo (`-- https://<dominio>`) e pode ser repetido na véspera e no meio do evento — quando o dado deixa de ser sintético.

**A primeira verificação de RNF-09 era inútil, e o próprio número denunciou** (D-89). Perguntar "o nome completo do menor aparece no corpo?" exige a ressalva "a não ser que exista adulto homônimo". Contra a massa real a ressalva dispensou **151 de 151** menores — vinte nomes e vinte sobrenomes em duas mil pessoas colidem sempre —, e o script dizia "ok" sem ter verificado nada. Virou verificação por **contagem**, e confirmei que morde: com a abreviação desligada de propósito, ele acusa `"Pedro R.": esperadas 2, publicadas 0` e sai com código 1.

**O achado da auditoria foi no documento, não no código** (D-88). O SDD §BC-05 dizia que a Custódia é o único contexto autorizado a reunir dados pessoais com resultados; ao pé da letra, a busca do painel violava isso — e precisa violar, porque é assim que o Operador distingue homônimos. A invariante real é mais estreita: fora da Custódia ninguém lê e-mail, idade nem Responsável, e o telefone vira quatro dígitos **no banco**. Corrigi a frase e fixei a invariante em teste.

**Evidência que só o tráfego real dava:** o log do teste de carga de T18 tem 141.463 linhas geradas por 200 cadastros com e-mail e telefone verdadeiros. Zero e-mails, zero sequências de dez dígitos, zero ocorrências do prefixo de teste.

**O que a T21 não fecha, e não fecharia de jeito nenhum hoje:** domínio, contas publicadas e uma tarde de ensaios. O checklist diz isso por escrito e **não tem assinatura**, de propósito.

---

### 2026-08-28 — Sessão 24: execução da T20

**Pedido:** conferir se a finalização anterior deixou algo pendente e seguir com a T20.

**Entregue:** `npm run fichas`, que gera as três peças impressas em `docs/contingencia/` — ficha numerada, termo integral e folha de tempos —, mais `docs/contingencia.md` com o procedimento de uma página e `tests/contingencia.test.ts` com 14 casos. Quatro dos cinco critérios fechados; o ensaio com o time entra em T21.

**A peça que T03 tinha preparado apareceu.** O termo é dado estruturado desde a T03 justamente porque o mesmo texto precisaria sair em três lugares: a rota `/termo`, o formulário e a ficha impressa (D-09). Quatro meses depois, a ficha lê `TERMO_VIGENTE` e não copia uma palavra. E o gerador recusa rodar sob rascunho, pela mesma função que barra o cadastro (D-18): duzentas fichas impressas com texto não aprovado parecem válidas e colhem assinatura que não vale.

**O teste que importa compara papel e esquema nos dois sentidos** (D-86). O defeito que ele impede é lento: alguém acrescenta um campo ao cadastro em setembro, as fichas foram para a gráfica em agosto, e no dia a digitação recusa duzentas fichas. Ninguém pega isso em revisão — a ficha é um script e o cadastro é um Zod. Verifiquei que o teste morde: renomeando `email` na lista da ficha, dois casos falham nomeando o campo.

**A sonda do esquema precisou de dois corpos.** Submeter `{}` não alcança o `superRefine`, e as exigências de Responsável — as de RNF-07 — não apareciam. A segunda sonda é um menor sem responsável.

**RNF-06 saiu do registro de verificação manual, e não fui eu que decidi.** A suíte completa falhou no teste de rastreabilidade de T17: existe teste citando RNF-06, logo a justificativa manual tem de sair. É o mecanismo de D-71 funcionando sozinho, quatro tarefas depois de escrito. O que continua manual é o **ensaio**, e ele está no checklist de T21, não no registro de dispensas.

---

### 2026-08-28 — Sessão 23: execução da T18

**Pedido:** seguir com a próxima tarefa.

**Entregue:** `perf/` versionado — preparo do banco de carga, três cenários de Artillery e um medidor —, mais `docs/relatorio-carga.md` com números medidos. Quatro dos seis critérios de T18 fechados, um **reprovado de propósito** e um adiado por depender de aparelho.

**O achado que paga a tarefa: o limite de taxa recusaria a fila do evento.** Duzentos cadastros legítimos do mesmo IP produziram **30 criados e 170 recusados com 429** — trinta é exatamente `RATE_LIMIT_CADASTROS_POR_JANELA`. O limite funcionou como configurado; a configuração é que está errada para um lugar onde dezenas de celulares saem do mesmo NAT. D-27 sempre disse "calibrar em T18, decidir em T21"; T18 pôs número no lugar do palpite e **T23 fechou a decisão** (D-90).

**D-56 se resolve, e a resposta é remover.** Os três índices criados por raciocínio em T02 têm **zero varreduras** em `pg_stat_user_indexes` depois da carga. `tentativa_fila_idx` é o único usado. A projeção lê 3227 de 4000 linhas — varrer é o plano certo.

**Números que sobreviveram à medição:** documento público de 3227 linhas em **83,1 KB brutos / 14,0 KB gzip** (melhor que os 106/18 extrapolados em T12); projeção em 3,7 ms; fila em 0,068 ms; leitura sustentada a 200 req/s com **p95 de 7,9 ms e zero 5xx em 101.917 requisições**; propagação de 5,1 s sem borda, ~20 s com ela.

**Três defeitos foram da bancada, e cada um ensinou sobre o sistema.** O `401` em todo o painel era o cookie `Secure` recusando-se a viajar por HTTP — o código certo, o alvo errado. Os 46 `409 chave_em_conflito` eram o `$uuid` do Artillery, resolvido por usuário virtual e não por requisição: o teste reenviava a mesma chave com Tentativa diferente, e o servidor recusou como FL-06 promete. E um `truncate` no meio de uma medição veio de `medir.ts` importar uma constante de `preparar.ts`, que **executa a si mesmo** ao ser carregado (D-84).

**Uma mudança de código saiu da tarefa:** TLS exigido pelo **destino** e não pelo ambiente (D-85). A regra antiga impedia rodar o artefato de produção contra Postgres local — o que T18 precisa — e ainda deixava desenvolvimento contra banco remoto trafegar em claro.

**O que não foi medido, e por quê:** acerto de cache de borda, 3G real e HTTP/3 sob perda dependem do ambiente publicado, que depende do domínio. A medição inteira rodou numa máquina só, com gerador e servidor disputando os mesmos núcleos — é o pior caso, e é assim que está escrito no relatório.

---

### 2026-08-27 — Sessão 22: T22 commitada e execução da T19

**Pedido:** ver em que tarefa o projeto parou e seguir com a próxima.

**A T22 estava pronta e fora do histórico.** 83 arquivos modificados na árvore, nenhum commit desde T17: a renomeação inteira, a migração `0004` e o snapshot escrito à mão viviam só no disco. Rodei a suíte (594 verdes), o `check` (limpo) e commitei. A varredura de `pitch` achou **uma sobra real** — a `description` do `package.json`, que a auditoria de T22 não cobriu porque o critério listava `src/`, `app/`, `tests/`, `e2e/` e `scripts/`. Uma segunda apareceu depois, num comentário do `.env.example`.

**Depois, T19.** Três decisões do usuário nesta sessão: o banco é o **Neon em São Paulo** (D-79), o monitor é o **UptimeRobot gratuito** (D-82), e o **domínio continua sem existir** — hoje o item de maior prazo do projeto, porque QR impresso não se corrige, se refaz.

**O item 5 da task pedia "pool dimensionado", e a leitura óbvia era a errada** (D-80). Não existe *o* pool: cada instância de função abre o seu, e o `max: 10` que estava lá desde T02 vira trezentas conexões pedidas a um banco que oferece cem. Baixar para 1 também não serve — a Classificação é `force-dynamic` e uma instância atende várias requisições. Quem resolve é o **pooler** do provedor; o número por instância é teto local, não defesa. Junto veio a pegadinha que agora está escrita em dois lugares: migração quer a string **direta**, porque PgBouncer não repassa comando com estado de sessão.

**Três promessas passaram a quebrar alto** (`tests/deploy.test.ts`, 11 casos). A que mais me interessa é a segunda: bastaria um campo `dataHora` num esquema Zod para o relógio de um tablet decidir o desempate de RF-31, e **nenhum teste de comportamento pegaria** — o comportamento não muda, muda de quem é o relógio.

**Um defeito de dois meses apareceu na conferência final, e não era de código** (D-83). Uma alteração em `app/api/exportacao/route.ts` não aparecia no `git status`: o padrão `exportacao/` do `.gitignore` de T14, escrito contra CSV despejado, casa em qualquer nível e levava a rota inteira junto. **A exportação de T14 nunca esteve no repositório** — o arquivo no disco, a suíte verde, o build compilando, e um clone limpo produzindo um sistema sem `/api/exportacao`. A correção é uma barra; o que fica é o teste que pergunta ao `git` o que as outras ferramentas não sabem perguntar.

**O que não foi feito, e não dá para fazer daqui:** criar as contas, publicar, apontar domínio e testar a restauração de backup. Quatro dos sete critérios de aceitação de T19 dependem de um endereço publicado. Estão no checklist de `docs/deploy.md` §8, cada um com o comando ao lado, e a task ficou marcada como **parcial** em vez de concluída.

---

### 2026-08-25 — Sessão 21: levantamento de pendências e três respostas do organizador

**Pedido:** verificar o que ficou pendente das tasks feitas até aqui.

**Levantamento.** `npm run check` limpo, e2e com 19 casos passando, árvore limpa, nenhum TODO no código. Duas coisas que documento nenhum registrava apareceram na execução:

1. **`tests/identidade.test.ts` é instável na suíte cheia.** O caso do destravamento estourou os 30 s de `testTimeout` em `npm test` e passou em 40 s rodando o arquivo sozinho. Não é regressão: são 21 conferências de scrypt, cada uma reservando 64 MiB (D-37), competindo com o outro worker. É margem de tempo, e vai piscar vermelho no CI.
2. **Erro de hidratação na Classificação pública.** O e2e passa, mas o `next dev` registra *hydration mismatch* em `Classificacao.tsx`: `useState(() => Date.now())` roda no servidor e de novo no navegador, e `toLocaleString('pt-BR')` usa o fuso do servidor. Atinge o indicador de RF-32. Em produção o React se recupera calado, e é por isso que nenhum teste pega.

**Três respostas do organizador**, aplicadas nesta sessão: o termo é **Cockpit** (D-75), o evento é em **24/10/2026** (PE-06) e a aplicação vai para a **Vercel gratuita** (D-76).

**A troca de palavra custou o que D-31 prometeu que custaria** — duas linhas em `src/shared/vocabulario.ts` — mais duas mensagens que tinham escapado da constante: a recusa de tentativa duplicada em `api/painel/tentativa` e o `error` do `esquemaPitch`. As duas agora leem a constante. Sete asserções de texto na suíte acompanharam.

**Depois, na mesma sessão, os dois achados viraram conserto e nasceu a T22.**

**O relógio da Classificação deixou de ser estado do componente.** `useState(() => Date.now())` roda no servidor e no navegador, e os dois valores nunca coincidem — era essa a divergência de hidratação. Virou `useSyncExternalStore`, cujo `getServerSnapshot` devolve nulo: enquanto a página não hidrata sai a hora absoluta no fuso do evento, que os dois lados escrevem igual; depois entra o relativo que RF-32 pede. O `title` deixou de usar `toLocaleString()` sem argumento, que formata no fuso de quem lê, e passou a usar `formatDataHoraDoEvento` (D-78). O log do e2e, que trazia o erro, passou a não trazer nenhum.

**O teste de identidade ganhou prazo próprio** (`vi.setConfig`, 120 s) com o porquê escrito no arquivo: vinte e uma derivações de scrypt num caso só, ~250 ms cada, competindo com o outro worker. O que **não** foi feito: baixar o custo do scrypt em teste, porque uma variável que enfraquece a derivação de senha é uma variável que um dia vaza para produção.

**A T22 renomeou `pitch` para `cockpit`** no código e no banco (D-77). Ela existe porque o usuário discordou de D-75 no mesmo dia, e tinha razão.

**Aberto:** o que a Vercel não resolve — banco, domínio e monitor —, e o texto do termo de consentimento, que ainda diz "pista" e não pode ser mudado sem aprovação (D-18).

---

### 2026-08-24 — Sessão 20: execução da T17

**Pedido:** iniciar a T17 (testes automatizados).

**Entregue:** `tests/rastreabilidade.test.ts`, quatro arquivos de ponta a ponta com Playwright, um job de e2e no CI e `docs/testes.md`. 24 testes novos, 613 no total.

**A T17 não era escrever testes; era provar que eles existem** (D-71). O PRD já tinha escrito a suíte, e a maior parte já estava coberta desde T04. O que não existia era algo que **percebesse a ausência** — e esse algo pagou por si na primeira execução: recusou duas justificativas minhas (RF-01 e RF-09 já tinham teste) e apontou RNF-18 como o único requisito de fato descoberto entre os 53.

**RNF-18 deixou de depender de aparelho** (D-72). Era um critério que o projeto carregava como "precisa de celular" desde T06. Não precisa: 360 px é uma largura. O que depende de aparelho é o toque, a rede e a leitura sob sol.

**O banco do e2e custou duas tentativas descartadas** (D-73): criar o banco com o papel da aplicação (permissão negada, e está certo assim) e isolar por esquema com `search_path` (o SQL do drizzle-kit é qualificado com `public`, então as migrações o ignoram). Ficou o banco separado, com um privilégio a conceder uma vez. **Nesta máquina o usuário criou o banco à mão**, sem conceder `CREATEDB` — a suíte roda, mas não se recria sozinha aqui.

**Três defeitos meus que a primeira execução do e2e revelou** (D-74), todos no teste e nenhum no produto: a busca da Fila é do servidor e o Enter agia sobre a lista anterior; gravar limpa a busca, então o laço precisava redigitar a cada volta; e `click` **não é evento de mouse** — `Enter` num botão focado emite um `click` confiável, e contá-lo tornaria RF-19 impossível de passar justamente operando por teclado.

**Aberto:** o e2e roda contra `next dev` e não contra o artefato de produção — reavaliar em T19, quando existir alvo publicado.

---

### 2026-08-24 — Sessão 19: execução da T16

**Pedido:** iniciar a T16 (observabilidade, métricas e alertas).

**Entregue:** `GET /api/saude` para o monitor externo, `GET /api/metricas` como painel do dia, `shared/metricas.ts` com percentis, relatórios e os quatro alertas, o comando `npm run metricas` e `docs/monitoramento.md`. 32 testes novos, 589 no total.

**O log já era a telemetria; faltava alguém ler** (D-67). Toda rota emite evento, resultado, status e duração desde T05. Um emissor paralelo de métricas seria uma segunda coisa a manter, a sanear e a derrubar sem querer — e mediria o mesmo. Isso torna o critério de FL-12 verdadeiro por construção: **não existe coletor a derrubar**.

**`TELEMETRY_URL` foi removida** (D-66). Declarada em T01, documentada no README e no `.env.example`, nunca usada. Configuração que promete um caminho inexistente é pior que nenhuma. Entrou `APP_VERSION` no lugar.

**O log da própria sondagem corrigiu a sondagem** (D-68). Escrevi o teto em 200 ms, amarrado ao critério de aceitação de 300 ms. O relatório rodando contra o log do servidor de verdade mostrou a primeira sondagem em **191 ms** — ela inclui abrir a primeira conexão do pool. Com teto de 200, um monitor batendo logo após o deploy receberia `degradado` de um sistema saudável. Teto passou a 1 s.

**Uma métrica do PRD não fecha, e a honestidade é o entregável** (D-69): uso da busca por nome (≥ 30%). A busca da Classificação roda inteira no navegador — os testes de T13 exigem zero `fetch` durante a busca —, e por isso o servidor não a vê. O adendo de T13 sugeria derivar da razão 200/304, mas isso mede revalidação, que é outra coisa. Encaminhada a T21 para decisão explícita.

**Verificado contra o mundo real:** `/api/saude` em 13 a 33 ms com o banco de pé; `/api/metricas` fazendo seis agregações em 190 ms contra a base de 2000 (1.999 inscritos, 292 pendências, batendo com T14); o relatório rodando sobre o log de um `next dev` de verdade; e um log degradado sintético disparando os quatro alertas com código de saída 1.

**Aberto:** o monitor externo e o teste de disparo real do canal dependem de contratar serviço (PE-05); a taxa de acerto do cache de borda não chega ao servidor por definição e só o painel do provedor sabe (T19).

---

### 2026-08-24 — Sessão 18: execução da T15

**Pedido:** identificar em que tarefa o projeto parou e iniciar a seguinte.

**Entregue:** a T15, que fecha a Custódia e o ciclo de vida do dado pessoal — o prazo de retenção em código, o comando `npm run expurgar`, a exclusão individual a pedido, a higiene automática das tabelas de mecanismo e o procedimento escrito em `docs/retencao.md`. 20 testes novos, 557 no total.

**O prazo vive em dois arquivos, e um teste os amarra** (D-62). `DIAS_DE_RETENCAO` é código; "10 dias" é texto do termo que duas mil pessoas vão aceitar. Nada ligava os dois a não ser um teste que lê a seção `retencao` do termo e procura o número lá dentro — sem ele, mudar a constante quebraria uma promessa em silêncio.

**O comando não tem valor padrão para a data do evento** (D-63). A tentação é `hoje - 10 dias`, e isso ancora o prazo no dia em que alguém lembrou de rodar o comando. Quem esquecer por duas semanas terá guardado 24 dias e achado que cumpriu.

**A higiene automática é oportunista porque não existe agendador** (D-64), e um `cron` que só existisse num provedor viraria dívida no dia da migração — PE-05 continua aberta.

**Um item do escopo recusado de propósito** (D-65): preservar a classificação com nome público como "agregado histórico". O escopo da task permitia; o termo, não. Ele autoriza guardar "apenas números que não identificam ninguém", e nome identifica.

**Verificado contra o banco real** (PostgreSQL 18, massa de 2000): o ensaio conta 2.000 participantes e 2.973 tentativas; a exclusão individual levou a base a 1.999 e 2.971, provando a cascata; a busca por e-mail acha com a caixa trocada; a recusa por prazo funcionou com 30 dias restantes; e sem terminal o comando cancela em vez de apagar.

**Aberto:** o expurgo **total** nunca rodou contra o banco real — só o ensaio, mais a suíte contra Postgres via PGlite. Rodar de verdade apagaria a massa de 2000 que T18 ainda vai medir. Entra no ensaio geral de T21.

---

### 2026-08-23 — Sessão 17: execução da T14

**Pedido:** iniciar a T14 (exportação de dados).

**Entregue:** as três saídas da Custódia — base completa em fluxo, lista de repasse filtrada e relatório de pendências —, com sessão obrigatória e rastro de quem exportou. 24 testes novos, 537 no total.

**Um risco que a task não menciona e que estava aberto** (D-60): injeção de fórmula em CSV. Um Participante digita o próprio nome num formulário público sem autenticação; se alguém se cadastrar como `=1+1`, o Excel do organizador executa aquilo ao abrir o arquivo. O caminho está inteiro montado neste sistema — entrada pública, saída em planilha, aberta por alguém de confiança numa máquina de trabalho.

**Onde o rastro da exportação foi parar, e por quê** (D-61): no log estruturado, não numa tabela. A T15 vai apagar o banco, e um registro de auditoria que desaparece junto com o dado que ele auditava não é auditoria.

**Duas vezes o mesmo tropeço de medição, registrado porque é uma armadilha real:** o BOM do CSV "sumia" nas duas formas de conferir que eu usei. `Response.text()` descarta BOM inicial por especificação, e `new TextDecoder()` também. Os bytes estavam certos o tempo todo; quem mentia era o instrumento. O teste passou a olhar `arrayBuffer()` e comparar `EF BB BF`.

**E o BOM como literal cru sumiu do código-fonte** ao ser escrito, do mesmo jeito que o byte nulo de `log.ts` em T08. Virou escape `\uFEFF`, com o motivo anotado no arquivo: caractere invisível sobrevive mal a cópia entre editores, e o sintoma apareceria meses depois como "AssumpÃ§Ã£o" na planilha do organizador.

**Aberto:** abrir o arquivo no Excel de verdade. Separador, BOM e escape foram escritos para o Excel pt-BR e conferidos byte a byte, mas "abre corretamente em Excel" é afirmação sobre um programa que não está aqui.

### 2026-08-23 — Sessão 16: execução da T13

**Pedido:** iniciar a T13 (página pública da Classificação).

**Entregue:** a tabela pública com filtro por Pitch, busca com destaque, paginação e atualização. 29 testes novos, 511 no total. Fecha a trilha de Classificação.

**`normalizar` mudou de casa** — de Cronometragem para `shared/texto.ts`. É o terceiro mecanismo a fazer esse caminho, depois do limite de taxa (D-38) e da idempotência (D-46), e pelo mesmo motivo: dois contextos precisam da mesma regra e não podem se importar. Aqui o risco é específico: no painel a comparação roda no Postgres com `translate`, na Classificação roda no navegador em JavaScript. Divergir faria o mesmo nome achar a pessoa num lugar e não achar no outro.

**Dois defeitos meus, os dois encontrados por teste ou build:**

1. **O build quebrou, e o sintoma escondia o problema.** Com `revalidate = 15` na página, o `next build` falhou com "The server does not support SSL connections" — o build roda com `NODE_ENV=production` e o pool exige TLS. O sintoma era o TLS; o problema é que pré-renderizar a página **amarra o build ao banco**: o CI não tem banco, o deploy de T19 precisaria de credencial de produção para compilar, e a tabela embutida seria a do dia do deploy, vazia. A página virou `force-dynamic`.

2. **O memo que eu escrevi para proteger o banco não protegia nada** (D-58). Um teste de cinquenta leituras **simultâneas** mostrou cinquenta consultas: o memo guardava o resultado, então nenhuma chamada paralela encontrava algo pronto. Ele protegia leituras sequenciais — inútil no único cenário para o qual foi escrito.

**Um item de escopo não implementado, de propósito:** a instrumentação do uso da busca. Seria o único evento de telemetria emitido pelo navegador em todo o sistema, e D-33 tirou a métrica do cadastro do cliente justamente para não ter isso. A alternativa que responde à mesma pergunta está no log do servidor, e foi anotada em T16.

**Aberto:** RNF-18 (360px sem rolagem horizontal) precisa de aparelho. Quarto critério de ensaio, todos em T21.

### 2026-08-23 — Sessão 15: execução da T12

**Pedido:** iniciar a T12 (projeção e endpoint da Classificação).

**Entregue:** a projeção, o formato de transmissão, o endpoint público com cache de borda e ETag. 22 testes novos, 480 no total. `modelo.ts` e `nomePublico.ts` já existiam desde T02/T03 e não precisaram mudar — o tipo fechado e a função de fronteira eram exatamente o que faltava implementar em volta.

**O lint recusou o `servico.ts` que eu ia criar, e estava certo.** A regra diz que só `projecao.ts` alcança o banco neste contexto; abrir uma segunda exceção enfraqueceria justamente a invariante que `tests/fronteiras.test.ts` guarda. A composição foi para dentro da própria fronteira, e este é o único contexto do projeto sem arquivo de composição separado — de propósito.

**O dimensionamento saiu de estimativa para número.** O SDD supunha ~200 KB e ~40 KB comprimidos para 4.000 tentativas. Medido com 2.422 Válidas reais: 62,7 KB brutos, 10,9 KB em gzip, 26,5 bytes por linha. Extrapolando, ~106 KB e ~18 KB no pior caso. O formato posicional é a razão.

**Um cuidado com medição, registrado porque quase virou conclusão errada:** a primeira medida acusou 405 ms de consulta. Era partida do `tsx` e abertura de conexão. O `EXPLAIN ANALYZE` contra o servidor dá **5,3 ms**.

**E um padrão que já apareceu duas vezes** (D-56): o índice `tentativa_classificacao_idx`, criado em T02 "para cobrir a leitura da projeção", não é usado — a projeção lê 81% da tabela e nessa seletividade o índice só acrescenta indireção. É o mesmo que aconteceu com os índices de nome em D-50. T02 criou índices por raciocínio; a medição em escala real mostra que nesta escala eles não pagam.

**Aberto:** dois critérios de T12 dependem de borda de verdade — a segunda requisição servida pelo cache e os 30 s de ponta a ponta de RNF-03. Os dois esperam PE-05.

### 2026-08-23 — Sessão 14: execução da T11

**Pedido:** iniciar a T11 (UI do painel).

**Entregue:** a tela de trabalho do Operador — abas de Pitch, Fila com contagem, busca, campo de tempo com máscara, confirmação obrigatória, correção, ausência, inclusão em Pitch adicional, histórico, atualização periódica e indicador de conexão. 31 testes novos, 458 no total.

**A decisão que organiza tudo** foi tirar o fluxo de dentro do componente (D-53). O critério de RF-18 pede verificar "por leitura do código" que nada é gravado fora da confirmação — e leitura confere o código de hoje, não o de depois que alguém acrescenta um atalho com pressa. Com o fluxo num redutor puro, a verificação virou um teste que percorre todos os pares de estado e evento.

**Dois defeitos que só o teste pegaria:**

1. **A máscara se realimentava.** O campo exibe o texto formatado, então o `onChange` recebia de volta os zeros que a própria máscara colocou: digitar `1`, `2`, `3` produzia `000:00.12`, empurrando o dígito mais antigo para fora. O Operador digitaria `12345` e gravaria outro tempo, sem nenhum sinal de erro na tela.
2. **O atalho que a task pede não funciona como está** (D-54). Ela diz `1` e `2` para trocar de Pitch, mas o foco vive no campo de busca durante toda a navegação da Fila, e `1` e `2` são os dígitos que mais se digita no campo de tempo.

**Aberto:** RNF-16 — quinze segundos por lançamento, cronometrado com o supervisor. É o terceiro critério do projeto que depende de gente, e todos estão no checklist de T21.

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

3. **O limite por IP é a peça mais perigosa desta tarefa**, e o perigo é o oposto do que a task supunha: não é o atacante que passa, é o participante legítimo que é barrado por CGNAT. Ver D-27 para o mecanismo e D-90 para os números, que T18 mediu e T23 calibrou.

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

### D-53 — O fluxo do painel é um redutor puro, para que RF-18 vire prova

**Decidido:** a máquina de estados do lançamento mora em `fluxo.ts`, fora do componente, e o componente só despacha eventos.

**Por quê:** o critério de aceitação de RF-18 diz "verificado por leitura do código: não existe caminho de gravação fora do fluxo de confirmação". Leitura humana verifica o código de hoje. Com a decisão espalhada por `useState` e `onClick`, o dia em que alguém acrescentar um atalho de teclado com pressa ninguém relerá tudo — e a etapa que impede gravar o tempo na pessoa errada é justamente a que atrapalha quem tem pressa.

**O que o teste prova**, percorrendo todos os pares de estado e evento: nenhum evento leva `lista` ou `tempo` direto a `gravando`; `falhou` só vem de `gravando`; e a partir de `confirmar` só o evento `confirmar` grava. Por indução, toda gravação passou por uma confirmação.

**Do lado do componente**, o disparo da escrita está amarrado à etapa `gravando` num efeito, não a um clique. Um botão novo que despache `confirmar` passa pela mesma porta; um que tente gravar direto não tem porta.

### D-54 — `Alt+1` / `Alt+2` no lugar de `1` / `2`

**Decidido:** trocar de Pitch é `Alt+1` e `Alt+2`. As teclas sozinhas continuam valendo quando o foco não está num campo de texto.

**Por quê:** a T11 pede `1` e `2` literalmente, e o atalho literal é inutilizável. O foco vive no campo de busca durante toda a navegação da Fila — é o que RF-19 e RF-20 exigem — e `1` e `2` são exatamente os dígitos que mais se digita no campo de tempo. Sem modificador, ou o atalho nunca dispara, ou dispara a cada tecla do tempo.

**Descartado:** teclas de função para o Pitch. `F2` e `F3` já cuidam de ausência e busca global, e mais teclas de função afastariam a mão da posição de digitação, que é o que o atalho existia para evitar.

**Reversível:** um ensaio com o supervisor pode mostrar que `Alt` atrapalha mais que ajuda. A troca é uma linha em `Painel.tsx`.

---

### D-56 — Os índices de T02 foram criados por raciocínio; a medição diz outra coisa

**Constatado, não decidido.** Dois índices criados em T02 com justificativa escrita não são usados na escala real do evento:

| índice | criado para | o que a medição mostra |
|---|---|---|
| `participante_nome_idx` / `_sobrenome_idx` | a busca do painel (RF-16) | a busca virou por trecho em D-50, e nem o prefixo pagava: 77 buffers com índice contra 73 sem |
| `tentativa_classificacao_idx` | a leitura da projeção pública | não usado: a projeção lê 81% da tabela, e o planejador prefere varredura + quicksort — 76 buffers, 5,3 ms |

**Por que ficam:** removê-los custa uma migração para ganhar nada mensurável, e são o remédio imediato se a massa crescer uma ordem de grandeza. Um índice não usado custa escrita no `INSERT`, e as inserções deste sistema acontecem 2.000 vezes num dia — não é onde o desempenho aperta.

**O que isto ensina para o resto do projeto:** índice criado por raciocínio precisa de medição antes de virar premissa. T18 é o lugar de reavaliar os três com número, não com intuição. Se a decisão for remover, é uma migração e um teste de esquema a menos.

### D-57 — O modelo interno tem mais campos que o documento transmitido

**Decidido:** `LinhaClassificacao` tem `id` e `registradoEm`; `LinhaCompacta`, que é o que atravessa a rede, não tem nenhum dos dois.

**Por quê o `id` fica de fora:** é um UUID de 36 caracteres que a tela não usa para nada. A ordem do array já é a classificação e a posição já serve de chave de renderização. São 144 KB economizados nas 4.000 linhas do pior caso — mais que o documento inteiro custa hoje.

**Por quê o `registradoEm` fica de fora, e este é o motivo que importa:** ele serve ao desempate de RF-31, que o servidor **já resolveu** ao ordenar. Publicá-lo diria a que horas uma pessoa nomeada esteve num lugar — e para os menores de 18 essa é exatamente a exposição que RNF-09 existe para evitar, só que entrando por outra porta. Menos campo na rede é menos superfície, e aqui também é menos risco.

**Descartado:** mandar objetos com chaves curtas em vez de arrays posicionais. Ganharia legibilidade do corpo cru e pagaria com as chaves repetidas 4.000 vezes. O comentário em `documento.ts` e o tipo nomeado cobrem a legibilidade a custo zero de rede.

---

### D-58 — Cache de leitura tem de guardar a promessa, não o resultado

**Decidido:** `documentoDaClassificacao` memoiza a **promessa** da consulta, com validade de 5 s, e descarta o memo se a consulta falhar.

**Como o defeito apareceu.** A primeira versão guardava o valor pronto. Um teste de cinquenta leituras simultâneas — que é o cenário de RNF-01, 500 pessoas abrindo a página no mesmo segundo — mostrou **cinquenta consultas**: nenhuma das chamadas paralelas encontrava o memo preenchido, porque a primeira ainda não tinha terminado. O memo protegia leituras sequenciais, que são exatamente as que não precisavam de proteção.

**Por que 5 s e não 15.** O orçamento de RNF-03 é de trinta segundos entre o lançamento e a aparição pública. A borda de T12 gasta 15; este memo gasta 5; sobram 10 para a consulta, a rede e o intervalo de polling da tela. Dois caches de quinze segundos em série gastariam o orçamento inteiro antes do primeiro byte sair do servidor.

**Falha não fica guardada.** Cachear a indisponibilidade por cinco segundos seria o pior momento possível para fazê-lo — todo mundo recarregando ao mesmo tempo receberia o erro.

**Vale além desta função:** qualquer cache de leitura sob concorrência tem esse mesmo buraco, e ele é invisível em teste sequencial. T16 e T18 devem procurar o padrão em outros lugares.

### D-59 — A página pública não é pré-renderizada, e o motivo não é o TLS

**Decidido:** `/classificacao` é `force-dynamic`. Quem protege o banco é o memo de D-58 somado ao cache de borda de T12.

**Como a decisão apareceu:** com `revalidate = 15`, o `next build` passou a falhar com "The server does not support SSL connections". O build roda com `NODE_ENV=production`, e `src/db/index.ts` exige TLS nesse ambiente (SDD FL-09) — coisa que um Postgres de desenvolvimento não oferece.

**Mas o TLS era o sintoma.** O problema é o acoplamento: pré-renderizar amarra o **build** à disponibilidade do banco. O CI de T01 não tem banco nenhum; o deploy de T19 passaria a precisar de credencial de produção só para compilar; e a tabela embutida no artefato seria a do dia do deploy — quer dizer, vazia, servida a quem abrisse a página antes da primeira revalidação.

**O que não se perde:** a primeira pintura continua trazendo a tabela, porque o Server Component lê a projeção na requisição. O que muda é quando a leitura acontece.

---

### D-60 — O CSV precisa se defender do Excel

**Decidido:** `escapar` prefixa com apóstrofo qualquer campo que comece com `=`, `+`, `-` ou `@`.

**Por quê:** injeção de fórmula em CSV. O Excel trata um campo iniciado por esses caracteres como fórmula e o **executa** ao abrir o arquivo. Neste sistema o caminho está todo montado: o nome é digitado num formulário público sem autenticação, e o arquivo é aberto pelo organizador numa máquina de trabalho.

**A T14 não pede isso.** Pedir seria supor que quem escreveu a task conhecia o ataque; não tratar seria supor que ninguém vai tentar. Entre as duas suposições, a segunda é a cara.

**O que se paga:** um telefone `+55…` aparece como `'+55…` num editor de texto. Na planilha — que é onde ele vai ser lido — aparece certo, porque o Excel consome o apóstrofo ao exibir.

### D-61 — O rastro da exportação vai para o log, não para o banco

**Decidido:** `custodia.exportacao` é registrado no log estruturado (stdout → agregador), com identificador do Operador e instante. Não há tabela de auditoria de exportação.

**Por quê:** a T15 vai apagar o banco dez dias depois do evento (PE-02). Um registro de auditoria gravado numa tabela desapareceria junto com o dado que ele auditava — e auditoria que some com o auditado não é auditoria. O log sobrevive ao expurgo, como já está escrito em `log.ts` desde T05.

**Detalhe que decorre do fluxo:** o rastro sai **antes** do corpo. Uma exportação em fluxo pode ser interrompida no meio, e o que precisa ficar registrado é que alguém pediu a base, não que conseguiu baixá-la inteira.

**O que fica no log e o que não fica:** o identificador do Operador, não o nome. A forma fechada de `EntradaDeLog` não carrega nome de pessoa (RNF-08), e quem precisar do nome cruza com a tabela de Operadores enquanto ela existir.

### D-62 — O prazo de retenção mora em dois lugares, e um teste os amarra

**Decidido:** `DIAS_DE_RETENCAO = 10` vive em `custodia/retencao.ts`, e o texto "10 dias" vive na seção `retencao` do termo `v1.0-2026-08-19`. Um teste lê o termo e procura o número da constante dentro dele.

**Por quê:** são arquivos diferentes, em contextos diferentes, e nada mais os liga. O termo é imutável depois de aprovado (D-19); a constante não é. Alguém que ajuste o número no código para "facilitar um teste" quebraria uma promessa feita a duas mil pessoas, e nenhuma revisão pegaria isso — o código continuaria coerente consigo mesmo.

**Descartado:** derivar o texto do termo a partir da constante. O termo é prova documental e não pode ter parte gerada: o que a pessoa aceitou tem de estar escrito por extenso no arquivo que se guarda.

**Reversível:** sim, mas na direção contrária. Se algum dia o prazo mudar, muda o termo primeiro — com versão nova — e o código depois.

---

### D-63 — O expurgo não adivinha a data do evento

**Decidido:** `npm run expurgar` exige `--evento AAAA-MM-DD` e não tem valor padrão. Recusa datas que não existem (`2026-02-31`) em vez de reinterpretá-las, e recusa rodar antes do vencimento a menos que se passe `--antecipar`.

**Por quê:** o padrão óbvio seria `hoje - 10 dias`. Isso ancora o prazo no dia em que alguém lembrou de rodar o comando, e não no dia contra o qual a promessa foi feita — esquecer por duas semanas viraria 24 dias de guarda com aparência de cumprimento. Como PE-06 ainda não fechou, não existe data para colocar como padrão, e isso é uma vantagem: um padrão aqui seria um palpite com poder de apagar a base.

**Sobre a recusa antes do vencimento:** apagar cedo é mais protetivo em tese. Na prática o caso real não é o organizador zeloso — é um dedo trocado na data na semana do evento, com o painel em uso. `--antecipar` existe para quem de fato quer, e diz o que está fazendo.

**Descoberto ao verificar:** sem terminal, o `readline` fecha sem chamar a resposta da confirmação. Sem tratamento, a promessa ficava pendurada para sempre; com um tratamento descuidado, o silêncio viraria consentimento. Só uma das duas leituras é segura, e é a que recusa.

---

### D-64 — A higiene contínua é oportunista, não agendada

**Decidido:** a varredura que apaga chaves de idempotência e marcas de limite com mais de 48 h é disparada por `consultarEfeito`, no máximo uma vez por hora por processo, e **não é aguardada**. `npm run expurgar -- --higiene` faz o mesmo sob demanda.

**Por quê:** não há agendador neste sistema, e a hospedagem ainda não está escolhida (PE-05). Um `cron` de provedor viraria dívida no dia da migração. O gatilho escolhido é o próprio caminho que **cria** as linhas que precisam sumir — toda escrita idempotente passa por ali.

**Por que não é aguardada:** a faxina não pode segurar a requisição que a disparou, nem falhar junto com ela. Se falhar, sai uma linha de log e o cadastro da pessoa segue. O contrário seria trocar um problema que ninguém vê por um que todo mundo vê, no dia do evento.

**O que se paga:** em ambiente sem processo longo a função pode ser interrompida antes de terminar. Não há dano — o DELETE é idempotente e a próxima requisição depois da hora tenta de novo.

**Efeito colateral que valeu a pena:** `RATE_LIMIT_JANELA_SEGUNDOS` e `LOGIN_JANELA_SEGUNDOS` ganharam teto em `env.ts`. Sem isso, uma janela configurada acima de 48 h faria a faxina apagar contagem que o limite ainda usaria — um limite de taxa que se desarma sozinho e ninguém percebe.

---

### D-65 — Nem a classificação com nome público sobrevive ao expurgo

**Decidido:** o único vestígio que o expurgo preserva é `resumoAnonimo` — contagens de participantes e de menores, e por Pitch quantas tentativas, quantas válidas, quantas ausentes, quantas pendentes, mais melhor tempo, mediana e pior. Sai no terminal e no log, e **não volta para tabela nenhuma**.

**Por quê:** o escopo de T15 permitia preservar "agregados anônimos … classificação com nome público, se o organizador quiser histórico". O termo, não: ele autoriza guardar "apenas números que não identificam ninguém". Nome identifica — e o nome público de menor, com a inicial do sobrenome, já sinaliza a faixa etária (D-21). Entre o que a task permitia e o que o termo prometeu, vale o termo.

**Descartado com registro:** guardar a classificação numa tabela `historico`. Quem quiser histórico com nomes precisa de um termo aceito para isso, não de uma exceção no comando de expurgo.

**Como isso é verificado:** o teste percorre os **valores** do resumo e falha se qualquer texto que não seja o instante de geração aparecer. As chaves são nomes de campo escritos no código; o que não pode existir ali é texto vindo do banco.

**Consequência para o resto:** `operador` também não é apagado — não é dado de participante, e é a conta que permite entrar no painel depois do expurgo para conferir que a base está vazia. O que vai embora são as sessões.

---

### D-66 — `TELEMETRY_URL` sai; o transporte da telemetria é a saída padrão

**Decidido:** a variável foi removida de `env.ts`, do `.env.example` e do README. No lugar entrou `APP_VERSION`, devolvida por `/api/saude` e preenchida por T19 com o commit publicado.

**Por quê:** declarada em T01 e **nunca usada** por nenhuma linha de código. Configuração que promete um caminho inexistente é pior que nenhuma: quem chega depois a preenche com a URL de um coletor e conclui que a telemetria está ligada, quando nada é enviado. O engano só apareceria no dia em que alguém procurasse a métrica e não a achasse.

**Descartado:** implementar a emissão por HTTP que a variável prometia. FL-12 exige que a coleta não adicione latência ao caminho da requisição nem falhe junto com ele; um POST por operação adiciona exatamente isso, e precisaria de fila, repetição e desistência para não adicionar. A saída padrão em JSON por linha já é não bloqueante, já é recolhida por qualquer plataforma e já está escrita desde T05.

**Consequência:** não existe coletor neste sistema. O critério de aceitação "derrubar o coletor não afeta a aplicação" passa a ser verdadeiro por construção, e o teste que o prova força a escrita em stdout a lançar.

---

### D-67 — Não há um segundo caminho de telemetria: o log é a fonte

**Decidido:** as métricas de T16 são derivadas do log estruturado. `shared/metricas.ts` é a leitura — puro, sem banco e sem relógio —, e `npm run metricas` é a interface.

**Por quê:** toda rota já emitia evento, resultado, status e duração. Um emissor paralelo de métricas seria uma segunda coisa a manter, a sanear contra dado pessoal e a derrubar sem querer — e mediria exatamente o mesmo. Três ganhos vieram de graça: nenhuma métrica carrega dado pessoal (a forma de `EntradaDeLog` é fechada e já era saneada), nada depende do provedor ainda não escolhido (PE-05), e o relatório roda contra um arquivo hoje e contra o agregador amanhã.

**O que se paga:** métricas só existem onde há linha de log. Duas ficam de fora e estão registradas como tal — a taxa de acerto do cache de borda, que por definição não chega ao servidor, e o uso da busca da Classificação (ver D-69).

**Descartado:** uma tabela de métricas no banco. Além de escrever no caminho da requisição, ela desapareceria no expurgo de T15 — o mesmo argumento de D-61.

---

### D-68 — O teto da sondagem de saúde não é o critério de aceitação

**Decidido:** `LIMITE_DA_SONDAGEM_MS` passou de 200 ms para **1 s**.

**Por quê, e como se descobriu:** a primeira versão amarrou o teto ao critério de T16 ("`/api/saude` responde em ≤ 300 ms"). São grandezas diferentes: o critério descreve o **regime**, e o teto existe para distinguir banco **pendurado** de banco lento. Um banco fora do ar costuma aceitar a conexão e não responder; sem prazo, a sondagem herda essa espera e o monitor registra "sem resposta", que é indistinguível da aplicação inteira ter caído.

O erro apareceu no relatório rodando contra o log de um `next dev` real: a **primeira** sondagem depois de subir o processo levou 191 ms, porque inclui abrir a primeira conexão do pool. Com teto de 200, um monitor batendo logo após o deploy tinha chance real de receber `degradado` de um sistema saudável — alarme falso no minuto em que alguém está olhando, que é a forma mais rápida de um alerta perder crédito.

**Vale além desta função:** limite de tempo de sondagem se dimensiona pelo que se quer distinguir, não pela meta de desempenho da coisa sondada.

---

### D-69 — A métrica de uso da busca não é mensurável, e isso fica escrito

**Decidido:** o uso da busca por nome da Classificação (PRD §7, meta ≥ 30%) **não é medido**. O relatório diz isso com todas as letras, em vez de exibir um número aproximado no lugar.

**Por quê:** a busca roda inteira no navegador, sobre o documento já carregado — os testes de T13 contam as chamadas a `fetch` durante a busca e exigem **zero**. É isso que a faz instantânea e que a faz não gastar rede em 3G, e é pelo mesmo motivo que o servidor não a vê. Medir exigiria telemetria de navegador na página mais pública do evento, e D-33 tirou a telemetria do cliente do cadastro justamente para não ter uma URL de coletor exposta.

**Descartado, e por que a alternativa não serve:** o adendo de T13 a esta task sugeria derivar a métrica da razão entre 200 e 304 no log de `classificacao.leitura`. Essa razão mede **revalidação** — quantas leituras saíram sem corpo —, não quantas pessoas digitaram um nome. O número está no relatório, com esse nome e essa ressalva. Chamá-lo de uso da busca seria inventar uma medida.

**Encaminhado a T21** como risco aceito, com duas saídas possíveis: a métrica cai do PRD, ou alguém aceita a telemetria de navegador de olhos abertos. A escolha é do organizador, não do código.

---

### D-70 — Duas rotas de observação, e não uma

**Decidido:** `/api/saude` (pública, health check) e `/api/metricas` (autenticada, painel do dia) são rotas separadas.

**Por quê:** respondem perguntas diferentes, para públicos diferentes, em frequências diferentes. Juntá-las faria a rota que o monitor bate a cada 60 segundos carregar seis agregações — e, pior, cair junto com o banco, apagando justamente o sinal que distingue "banco fora" de "aplicação fora".

**Sobre a autenticação do painel:** o corpo é só contagem, e nada ali identifica ninguém. O que se protege é a informação operacional — "1.462 inscritos e 293 pendências às 16h" é um retrato do evento que não precisa estar aberto — e o custo: uma rota pública que faz seis agregações por chamada é um amplificador de carga de graça no dia em que a carga importa.

**Onde o painel mora, e por quê:** em `custodia/metricas.ts`. A consulta atravessa BC-01 e BC-02 no mesmo documento, e BC-05 é o único lugar autorizado a isso (SDD §1). A alternativa — meia consulta em Inscrição, meia em Cronometragem, soma na rota — move o cruzamento para fora do lugar onde ele é auditável, que é exatamente o que a fronteira existe para impedir.

**Uma exceção de lint, com um arquivo de largura:** `/api/saude` é a única rota que alcança o banco sem passar por um caso de uso, no mesmo feitio da exceção de `classificacao/projecao.ts`. Não há caso de uso a contornar — não é regra de negócio "o banco está de pé" —, e um inventado só para atravessar a sondagem seria uma camada que não decide nada. `tests/fronteiras.test.ts` falha se a exceção crescer.

---

### D-71 — A rastreabilidade PRD → teste é verificada por teste, não por leitura

**Decidido:** `tests/rastreabilidade.test.ts` lê o `PRD.md`, extrai os 53 códigos de requisito e varre os **nomes** de todos os testes procurando cada um. Falha quando um requisito não é citado nem consta de um registro de verificação manual com justificativa escrita.

**Por quê:** a cobertura já existia; o que não existia era algo que percebesse quando ela deixasse de existir. Um requisito entra no PRD, ninguém escreve o teste, e nada reclama até a auditoria de T21 achar o buraco tarde demais. Uma planilha de rastreabilidade teria o mesmo problema com passo a mais: ela envelhece em silêncio.

**Três detalhes que o tornam útil em vez de decorativo:**

1. **Conta o nome do teste, não o arquivo.** Um comentário citando RF-22 no topo de um arquivo faria o requisito parecer coberto sem nenhuma asserção. O que vale é o título que aparece no relatório quando o teste falha, porque é ele que diz a quem está consertando qual promessa do produto quebrou.
2. **Justificativa manual não sobrevive à automação.** Assim que existe teste citando o código, o registro **tem** de perder a linha. Sem isso ele vira depósito de dispensas que ninguém revisita, e T21 leria "verificado à mão" sobre algo que a suíte verifica em três segundos.
3. **Justificativa curta é recusada**, e justificativa órfã — de requisito que saiu do PRD — também.

**Pagou por si na primeira execução:** recusou minhas justificativas para RF-01 e RF-09, que já tinham teste para a parte automatizável, e apontou RNF-18 como o único requisito descoberto.

---

### D-72 — RNF-18 não depende de aparelho, e não dependia desde o começo

**Decidido:** a verificação de "360 px sem rolagem horizontal" é um teste de ponta a ponta, num projeto do Playwright com essa largura. Saiu da lista de critérios que esperam o mundo físico.

**Por quê:** 360 px é uma largura, e um navegador sabe ser 360 px de largura. O projeto vinha carregando isso como "precisa de celular" desde T06, e o que de fato precisa de celular é o toque, a rede e a leitura sob sol — esses continuam em T21.

**Como é medido:** a sobra de largura do documento (`scrollWidth - clientWidth`), e não uma captura de tela. Imagem exige alguém para olhar, e ninguém olha na terça depois do deploy. Quando falha, o teste **nomeia o elemento** que estourou, para o conserto começar no lugar certo.

**Cobre também o pior caso**, que é o formulário com o bloco do Responsável aberto — três campos e um aceite a mais. Conferir só a tela inicial deixaria de fora justamente a versão mais larga.

---

### D-73 — O e2e tem banco próprio, e duas alternativas foram descartadas

**Decidido:** os testes de ponta a ponta usam o banco `speedx_e2e`, derivado da `DATABASE_URL` com o nome trocado, recriado do zero a cada execução.

**Por quê não o banco de desenvolvimento:** o e2e apaga e reescreve tudo. A massa de 2000 que T18 vai medir sumiria na primeira execução distraída.

**Descartado 1 — criar o banco com o papel da aplicação.** "Permissão negada ao criar banco de dados", e está certo assim: é o mesmo papel que vai para produção, e ele não deve poder criar banco. Pedir `CREATEDB` seria elevar o privilégio do processo do evento por conveniência da suíte — mas conceder **ao papel local**, uma vez, é aceitável e é o que a mensagem de erro recomenda.

**Descartado 2 — isolar por esquema, com `search_path`**, o que dispensaria privilégio nenhum. Morreu em `CREATE TYPE "public"."estado_tentativa"`: o SQL gerado pelo drizzle-kit é **qualificado com `public`**, então as migrações ignoram o `search_path` e insistem em escrever no esquema de desenvolvimento. Reescrever o SQL em tempo de execução resolveria e trocaria a coisa que mais importa aqui — exercitar as migrações exatas de produção — por conveniência de ambiente.

**Estado nesta máquina:** o usuário criou o banco à mão, sem conceder `CREATEDB`. A suíte roda; em máquina nova o comando precisa ser repetido. Registrado em `docs/testes.md`.

---

### D-74 — Três armadilhas do e2e, e o que cada uma ensina

Nenhuma era defeito do produto. As três eram do teste, e as três se repetem em qualquer suíte de navegador.

**1. Esperar o elemento certo não é esperar o estado certo.** A busca da Fila é do servidor. Eu digitava e apertava Enter em seguida; o Enter seleciona `itens[indice]` da lista **em memória naquele instante**, ainda a anterior. O teste selecionava outra pessoa. Esperar a linha certa aparecer não bastaria — ela aparece enquanto a lista antiga ainda está lá. O que prova que o filtro chegou é a **quantidade**.

**2. O fluxo real não é o fluxo que se imagina.** Gravar limpa a busca (é metade do que RF-20 pede), e a Fila volta sem filtro. Meu laço digitava o termo uma vez e esperava a lista continuar filtrada nas cinco voltas. Corrigir para redigitar a cada lançamento **fortaleceu** o teste: ele passou a conferir o campo vazio a cada volta.

**3. `click` não é evento de mouse.** O vigia de ponteiro acusou seis eventos numa execução em que o mouse não foi tocado: `Enter` num botão focado **ativa** o botão, e o navegador emite um `click` com `isTrusted` verdadeiro. `click` é evento de **ativação**, e o teclado o dispara por desenho. Contá-lo tornaria RF-19 impossível de passar justamente operando por teclado. O que denuncia o ponteiro são `pointerdown`, `mousedown` e `mouseup` — mais um `click` com `detail` maior que zero, porque ativação por teclado traz `detail` zero.

**Vale além destes testes:** as três falhas passariam despercebidas como "teste instável" e seriam resolvidas com um `waitForTimeout`. Nenhuma delas era instabilidade; as três eram o teste medindo a coisa errada.

---

### D-75 — O termo oficial é Cockpit, e o identificador interno não mudou junto

**Decidido em 2026-08-25, pelo organizador:** a palavra é **Cockpit**. Não era o desempate que o projeto esperava entre "Pitch" (SDD §3) e "Pista" (PRD) — as duas estavam erradas. O evento é de **simulador**, e os dois postos são cockpits. Não existe pista física nenhuma.

**O que a decisão confirma:** a regra do SDD §3 — a linguagem ubíqua segue o vocabulário falado — estava certa; o que estava errado era o palpite sobre qual era o vocabulário falado. Perguntar teria custado uma frase em agosto.

**O que ela custou:** duas linhas em `src/shared/vocabulario.ts`, exatamente o que D-31 prometeu. A constante existia para essa troca e pagou por si.

**Duas fugas que a constante não pegava**, e que a troca revelou: `'Esta pessoa já tem uma tentativa neste Pitch.'` em `app/api/painel/tentativa/route.ts` e `{ error: 'Pitch deve ser 1 ou 2.' }` em `src/contexts/cronometragem/schema.ts`. Duas mensagens que o usuário lê, escritas à mão fora do lugar onde a palavra mora. Ambas passaram a ler a constante — a segunda é o primeiro caso de um contexto importar `@/shared/vocabulario`, o que é legítimo: `shared/` é folha, e a regra de fronteira só proíbe o caminho contrário.

**O identificador interno continua `pitch`:** coluna `tentativa.pitch`, campo do documento público da Classificação, tipo `Pitch` do domínio. Renomear alcançaria migração de banco e contrato de API para mudar nada do que alguém lê. A fronteira entre a palavra falada e o identificador é a própria constante, e o glossário do SDD registra as duas.

> **Revisto no mesmo dia — ver D-77.** Este parágrafo durou algumas horas. O usuário perguntou se não era melhor renomear tudo, e o argumento que eu tinha usado — o custo da migração — não era o argumento que decide. Fica registrado como estava porque a decisão errada e a razão dela valem mais que um texto limpo.

**O que não foi reescrito:** o texto histórico das tasks entregues e das sessões anteriores. São registros datados do que se pensava naquele dia; corrigi-los apagaria a única evidência de que o projeto operou seis semanas com a palavra errada.

---

### D-76 — A aplicação vai para a Vercel gratuita; o banco continua sem casa

**Decidido em 2026-08-25, pelo usuário:** hospedagem da aplicação na **Vercel, plano Hobby (gratuito)**.

**O que isso fecha.** A borda da Vercel anuncia HTTP/3 e comprime com Brotli, o que atende FL-02 e FL-07 sem trabalho de infraestrutura; ela honra `s-maxage` e `stale-while-revalidate`, que é a estratégia de cache de T12; e o deploy sai de commit, com reversão em minutos, que é o que T19 pede no item 6.

**O que isso não fecha, e é o que sobra de PE-05:**

1. **O Postgres não vem junto.** O banco é PostgreSQL 18 desde 2026-08-23 (D-14), mas "onde ele roda" continua em aberto. Precisa de TLS obrigatório (FL-09), backup automático com restauração testada (T19 §5) e, de preferência, região São Paulo — a página da Classificação é `force-dynamic` (D-59), então cada primeira pintura atravessa a distância entre função e banco.
2. **O domínio.** Sem ele o QR de `docs/qr/inscricao.svg` continua provisório (D-35), e uma URL definitiva de comprimento diferente muda o número de módulos do código.
3. **O monitor externo** de T16 continua a contratar.

**O risco do uso não comercial foi levantado e fechado em 2026-08-25.** O plano Hobby da Vercel é para uso não comercial, e o evento tem patrocinadores — mas o que vai ao ar é uma **iniciação científica em nome da universidade**, conforme o usuário: o site não carrega marca de patrocinador, não vende nada e não cobra inscrição. Fica registrado assim, com o detalhe que importa se alguém reabrir a pergunta: **o que decide é o que a página faz, não o que o evento em volta dela é**. Se um patrocinador pedir logotipo na página de inscrição, a pergunta volta.

**Também a verificar em T19**, porque nenhuma delas se resolve daqui: a região das funções (o padrão não é São Paulo), o teto de execução do plano contra a exportação completa de T14, e o limite de conexões do Postgres visto de um ambiente sem servidor de longa duração.

---

### D-77 — O identificador interno acompanhou a palavra, e a migração foi escrita à mão

**Decidido em 2026-08-25**, algumas horas depois de D-75, a pedido do usuário: `pitch` vira `cockpit` **em tudo** — coluna, constraints, tipos, campos de API, estado de interface, classe de CSS. Executado como T22.

**Por que a decisão anterior estava errada.** Eu tinha pesado o custo da migração contra o benefício de quem lê a tela, e concluído que ninguém lê o nome da coluna. Lê: quem depura às sete da noite do dia 24 de outubro, com a fila parada, vendo `tentativa.pitch` numa janela e "Cockpit 2" na outra. Nesse momento, confirmar que são a mesma coisa custa segundos que não existem. Duas palavras para o mesmo conceito é precisamente o que o SDD §3 existe para impedir — e o custo real, medido, foi 66 arquivos numa varredura e uma migração de três linhas.

**A varredura cega acertou o código e errou a prosa.** Quatro substituições resolveram os 66 arquivos e o `tsc` passou de primeira. O que ela não sabe distinguir é **a palavra usada** da **palavra citada**: o comentário que contava a história da decisão virou "não era escolha entre 'Cockpit' e 'Pista'", que não quer dizer nada. Vale para qualquer renomeação em massa — o compilador confere identificador, não confere texto, e a revisão que importa é a dos comentários.

**Três mensagens que o participante lê apareceram só agora.** `src/contexts/inscricao/schema.ts` recusava o cadastro com "Escolha pelo menos uma **pista**", "**Pista** inválida" e "Cada **pista** pode ser escolhida uma vez só". Escaparam da auditoria de D-75 porque aquela busca procurava "Pitch", e estas usavam a **outra** palavra errada. Só apareceram porque renomear obrigou a varrer "pista" também. As três passaram a ler `COCKPIT.singular`.

**A migração precisou ser escrita à mão, e o motivo é uma pergunta.** `drizzle-kit generate` recusa rodar sem terminal interativo quando vê uma coluna sumir e outra aparecer: ele pergunta se é renomeação ou substituição. As duas respostas não se parecem — uma preserva 2971 Tentativas, a outra apaga a coluna. Escrevi `0004_renomeia_pitch_para_cockpit.sql` com três `RENAME` e montei o snapshot a partir do `0003`. A conferência não foi leitura: rodar `drizzle-kit generate` de novo devolveu **"No schema changes, nothing to migrate"**, que é o programa dizendo que o snapshot escrito à mão descreve o esquema do código. A suíte recria o banco a partir das migrações, então os 594 verdes provam a cadeia.

**O que não foi renomeado, e por quê:** o texto do termo de consentimento (`v1.0-2026-08-19`) diz "a pista, o tempo e o horário". É texto aprovado por escrito (D-17) e versão nova nasce rascunho, o que **impede cadastro** até alguém aprovar (D-18). Não é varredura: é decisão do organizador. O PRD também ficou como está, de propósito — é o documento de origem, e `tests/rastreabilidade.test.ts` o lê.

---

### D-78 — O relógio da página pública é fonte externa, não estado

**Decidido em 2026-08-25**, ao consertar uma divergência de hidratação que nenhum teste pegava e que só aparecia no log do `next dev`.

**O defeito.** `const [agora] = useState(() => Date.now())` parece inofensivo e não é: o inicializador roda **duas vezes**, uma no servidor ao pintar a primeira tabela e outra no navegador, e os dois valores nunca coincidem. O React descartava a árvore vinda do servidor e repintava a página inteira — em produção, calado, porque a divergência é "recuperável". O e2e passava. O que denunciava era uma linha no log do servidor de desenvolvimento.

**O conserto.** `useSyncExternalStore`, que existe para exatamente este caso: `getServerSnapshot` devolve nulo, os dois lados pintam o mesmo texto, e o relógio só anda depois de hidratar. O instante mora fora do componente porque `getSnapshot` precisa devolver o **mesmo** valor entre avisos — `Date.now()` ali dentro renderizaria em laço.

**Um segundo defeito no mesmo trecho:** o `title` usava `toLocaleString('pt-BR')` sem fuso, que formata no fuso de **quem lê**. Além de divergir na hidratação, é a hora errada: quem lê está no evento, e a hora que interessa é a de São Paulo. Virou `formatDataHoraDoEvento`, com o fuso fixo.

**O que isto ensina sobre a suíte:** `npm test` e o e2e passavam nos dois estados, antes e depois. O que achou o defeito foi ler o log de uma execução que já estava verde.

---

### D-79 — O banco é o Neon, em São Paulo, e a região não é preferência

**Decidido em 2026-08-27, pelo usuário**, ao executar T19: **Neon, plano gratuito, região `aws-sa-east-1`**, com as funções da Vercel fixadas em `gru1` (`vercel.json`).

**Por que a região é decisão de arquitetura, e não de conforto.** A página da Classificação é `force-dynamic` (D-59): não há pré-renderização, então **cada primeira pintura atravessa a distância entre a função e o banco**. A região padrão da Vercel é `iad1`, na Virgínia. Função em Washington com banco em São Paulo custa cerca de 120 ms de ida e volta por consulta, e é exatamente esse número que RNF-01 mede. Duas linhas de configuração compram o que nenhuma otimização de consulta compraria.

**Por que o Neon e não o Supabase**, entre os dois que oferecem São Paulo de graça: o pooler vem embutido e é o que este sistema mais precisa (D-80), e o Supabase gratuito **pausa projeto ocioso** — o que é um risco real para um sistema que fica parado até 24 de outubro e precisa estar de pé às oito da manhã daquele sábado.

**O que continua a verificar, e não daqui:** TLS exigido pelo servidor, backup automático e, principalmente, **a restauração testada**. Backup não testado não é backup, e a linha para anotar a data já está no checklist de `docs/deploy.md` §8.

---

### D-80 — Em função efêmera, quem protege o banco é o pooler, não o tamanho do pool

**Decidido em 2026-08-27**, ao ler o item 5 de T19 com a hospedagem já escolhida.

**O item pedia "pool de conexões dimensionado", e a leitura óbvia é a errada.** Não existe *o* pool: cada instância de função que a plataforma acorda abre o seu. Trinta instâncias no pico de cadastro, com o `max: 10` que estava no código desde T02, pedem **trezentas** conexões a um Postgres gratuito que oferece cem. O que o participante vê não é lentidão — é o cadastro recusado com `too many clients already`.

**E a correção intuitiva também é errada.** Baixar para 1 transformaria concorrência em fila dentro do processo, e a Classificação é `force-dynamic`: uma instância atende mais de uma requisição ao mesmo tempo.

**O que resolve é o pooler do provedor.** A função fala com o PgBouncer, que multiplexa milhares de clientes sobre poucas conexões reais. `DB_POOL_MAX=5` por instância vira teto local, não defesa. Junto veio `idleTimeoutMillis` de 30 s para 10 s: em função que congela entre requisições, conexão ociosa segurada é assento que o pooler não pode dar a mais ninguém.

**A pegadinha que fica escrita em dois lugares** (`.env.example` e `docs/deploy.md` §3): `npm run db:migrate` quer a string **direta**. PgBouncer em modo transação não repassa comando que dependa de estado de sessão, e uma migração que falha no meio falha no pior lugar possível.

---

### D-81 — HSTS de 180 dias, sem `preload`, porque o site tem data para morrer

**Decidido em 2026-08-27**, ao escrever os cabeçalhos de segurança em `next.config.ts`.

A recomendação de manual — dois anos com `includeSubDomains; preload` — pressupõe um site que continua existindo. **Este não continua:** o termo de consentimento promete que ele sai do ar dez dias depois do evento (D-22), e a data é 4 de novembro de 2026.

Entrar na lista de pré-carga dos navegadores é fácil e **sair leva meses**. Deixaríamos um domínio morto marcado como somente-HTTPS no mundo inteiro, e quem o registrasse depois herdaria a marca sem ter pedido. Cento e oitenta dias cobrem a vida do site com folga e vencem sozinhos.

**Também de propósito:** o HSTS só é emitido quando `NODE_ENV=production`. Gravar `localhost` como somente-HTTPS no navegador de quem desenvolve quebra outros projetos da mesma máquina, e isso não é hipótese.

---

### D-82 — O monitor externo é o UptimeRobot, e as duas diferenças ficam escritas

**Decidido em 2026-08-27, pelo usuário:** UptimeRobot, plano gratuito, apontado para `/api/saude`, `/` e `/classificacao`.

T16 tinha escrito o requisito com duas exigências que o plano gratuito não cumpre ao pé da letra, e a resposta honesta é registrar a diferença, não silenciá-la (`docs/monitoramento.md` §3):

1. **Intervalo de 5 minutos, não 60 segundos.** Uma queda pode passar cinco minutos sem alerta. Aceitável porque, dentro da janela do evento, quem percebe antes disso é o Operador na frente da fila. **O monitor existe para o resto do calendário** — a madrugada anterior, o intervalo do almoço, a hora em que ninguém está olhando.
2. **Canal por push do aplicativo, não SMS.** Lendo o requisito de T16 de novo, ele não pedia SMS: pedia **vibrar no bolso de quem pode agir**, porque no dia ninguém abre caixa de entrada. O aplicativo instalado nos dois celulares atende; o e-mail fica como segundo canal. **Testar o disparo antes do dia** — alerta que ninguém viu chegar é alerta que não existe.

---

### D-83 — Padrão de `.gitignore` que come código, e o teste que o denuncia

**Descoberto em 2026-08-27**, ao conferir por que uma alteração em `app/api/exportacao/route.ts` não aparecia no `git status`.

**O defeito.** O `.gitignore` de T14 traz um bloco cuidadoso contra vazamento: nenhum CSV, nenhum dump, nenhuma pasta de exportação. Duas das linhas eram `exportacao/` e `exportacoes/` — e padrão de gitignore sem barra inicial casa em **qualquer** nível. `app/api/exportacao/` entrava junto.

**O que isso significava:** a rota de exportação de T14, com sessão obrigatória e rastro de auditoria, **nunca esteve no repositório**. O arquivo existia no disco desta máquina, a suíte rodava sobre ele, o `npm run build` o compilava e o `git status` estava limpo. Um clone teria produzido um sistema sem `/api/exportacao` — e ninguém descobriria antes de tentar exportar a base no fim do evento.

**A correção é uma barra:** `/exportacao/` e `/exportacoes/`, ancoradas na raiz. O que protege o dado continua valendo em qualquer pasta, porque são as **extensões** (`*.csv`, `*.dump`, `*.sql.gz`) que barram o arquivo despejado, e é o arquivo que carrega a base — não o nome do diretório.

**O que fica é o teste** (`tests/deploy.test.ts`): `git status --ignored` sobre `app`, `src`, `tests`, `e2e` e `scripts` tem de devolver lista vazia. Conferi que ele falha de verdade, remontando o padrão largo: a mensagem nomeia `app/api/exportacao/`.

**A lição, e ela é maior que o defeito:** um arquivo não rastreado é invisível para **toda** ferramenta que este projeto usa para se vigiar. Lint, tipos, testes, build e o teste de rastreabilidade de T17 leem o disco, e o disco estava certo. A única ferramenta que sabia da ausência era o `git`, e ninguém estava perguntando a ele.

---

### D-84 — Quem exporta não executa

**Descoberto em 2026-08-28**, quando a mesma medição devolveu 3227 linhas numa execução e **zero** na seguinte.

**O defeito.** `perf/medir.ts` importava `urlDoBancoDeCarga` de `perf/preparar.ts`. E `preparar.ts` é um comando: a última linha dele chama `principal()`. Importar a constante **disparava o preparo inteiro**, `truncate` incluído, correndo em paralelo com a medição. Na primeira execução a leitura ganhou a corrida; na segunda, o apagamento.

**O que engana aqui** é que nada falha. Não há erro, não há aviso, e o número que sai é plausível — um banco vazio devolve tempos ótimos. Uma medição de desempenho contra base apagada é a pior espécie de resultado: parece sucesso.

**A correção não é mover o `truncate`:** é um arquivo deixar de ser duas coisas. As constantes e os derivadores de URL foram para `perf/banco.ts`, sem efeito nenhum ao importar; `preparar.ts` ficou só comando. Vale para todo script deste repositório que também exporte algo — e há outros que ainda não morderam ninguém porque nada os importa.

---

### D-85 — TLS é exigido pelo destino, não pelo ambiente

**Decidido em 2026-08-28**, ao descobrir que T18 não conseguia medir.

A regra de T02 era `ssl: NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined`, e ela errava dos dois lados:

- **Para menos:** um desenvolvimento apontado para banco remoto trafegava a base inteira em claro pela internet, sem que nada reclamasse.
- **Para mais:** o artefato de produção ficava **impossível de rodar** contra um Postgres local. É exatamente o que T18 precisa para medir, e o que um ensaio de homologação num laptop precisaria para existir. A medição só começou depois de trocar isto.

**O que decide é se existe rede a proteger.** Contra `localhost`, `127.0.0.1` ou `::1` o pacote não sai da máquina; contra qualquer outro host, TLS com certificado conferido. Uma `DATABASE_URL` de produção apontando para o Neon continua exigindo TLS, e **não existe variável de ambiente capaz de desligar** — a alternativa óbvia seria um `DB_SSL=false`, e uma variável que enfraquece a proteção é uma variável que um dia vaza para produção. URL que não se analisa também exige: a dúvida não relaxa a regra.

`tests/deploy.test.ts` guarda os três casos, e mais um: que `ssl:` nunca volte a olhar para `NODE_ENV`.

---

### D-86 — O papel e a tela são comparados por teste, não por revisão

**Decidido em 2026-08-28**, ao escrever a ficha de contingência de T20.

**O defeito a impedir é de calendário, não de código.** Alguém acrescenta um campo ao cadastro em setembro; as fichas foram para a gráfica em agosto. No dia do evento, com o sistema fora do ar, duzentas pessoas preenchem um papel que não tem onde escrever o dado novo — e a digitação posterior, que passa pelo **mesmo** caso de uso e pelas mesmas validações (RNF-13), recusa cada uma delas. O prejuízo é duzentos cadastros perdidos, descobertos tarde demais para refazer.

**Nenhuma revisão pega isso.** A ficha é um script de geração; o cadastro é um esquema Zod. São dois arquivos que ninguém lê lado a lado, e a divergência não quebra nada até o dia em que o papel é usado.

`tests/contingencia.test.ts` compara os dois **nos dois sentidos**: todo campo que o esquema exige tem onde ser escrito, e a ficha não pede nada que o cadastro não saiba receber — porque campo a mais no papel é dado pessoal coletado sem finalidade, o oposto do que o termo promete.

**A extração dos campos exigidos é uma sonda, não uma leitura de `.shape`.** `esquemaInscricao` é um esquema transformado, e o que interessa não é a forma declarada: é o que ele de fato recusa quando falta. Submeter `{}` e colher os caminhos das reclamações responde isso — mas só até certo ponto, e essa foi a lição: **o corpo vazio nunca alcança o `superRefine`**, então as exigências de Responsável, que são as de RNF-07 e as mais caras de descobrir tarde, não apareciam. Duas sondas, e a segunda é um menor de idade sem responsável nenhum.

**Confirmei que o teste morde**, renomeando `email` na lista da ficha: dois casos falham nomeando o campo. Guarda que ninguém viu falhar é guarda que ninguém sabe se funciona.

---

### D-87 — O termo impresso é peça obrigatória, e não um endereço no rodapé

**Decidido em 2026-08-28**, ao montar a ficha de papel.

A ficha carrega os **aceites palavra por palavra** e a versão do termo. O texto integral vai numa peça separada, em cópias no balcão — e não impresso no verso de cada ficha, o que custaria 400 folhas para resolver menos: o que a pessoa assina são os aceites.

**A alternativa que parecia óbvia e é errada** era imprimir na ficha o endereço da rota `/termo`, como a tela faz com o link. A ficha de papel **só existe quando não há internet**; mandar quem vai assinar consultar uma URL é oferecer exatamente o que acabou de cair. Por isso o termo impresso é item do checklist de contingência, com quantidade, e não uma linha de rodapé.

---

### D-88 — A auditoria corrigiu o SDD, e não o código

**Descoberto em 2026-08-28**, na Parte 1 da T21.

O SDD §BC-05 afirmava que a Custódia é o **único** contexto autorizado a "reunir dados pessoais de Inscrição com resultados de Cronometragem no mesmo documento". Auditando o cruzamento, encontrei que a busca do painel (`cronometragem/consultas.ts`) devolve nome, sobrenome e os quatro últimos dígitos do telefone **junto** com as Tentativas da pessoa, tempo incluído.

**A tentação era tratar isso como violação e mexer no código.** Seria errado: é exatamente assim que o Operador distingue dois homônimos antes de lançar um tempo (RF-15, RF-16). Sem nome e sem os quatro dígitos, a fila do dia para.

**O que estava errado era a frase.** A invariante que de fato vale, e que o código sempre respeitou, é mais estreita: fora da Custódia ninguém lê **e-mail, idade ou dados de Responsável**, e o telefone é reduzido a quatro dígitos **no banco** (`right(telefone, 4)`), de modo que o número inteiro não chega a trafegar até a aplicação. A Custódia é única por reunir o **registro pessoal completo** com resultados — não por reunir "dados pessoais", que é vago demais para ser verificável.

Corrigi §BC-05 com a distinção, deixei a correção datada dentro do próprio SDD, e fixei a invariante em `tests/auditoria.test.ts`. **Uma invariante que não dá para verificar não é invariante; é intenção.**

---

### D-89 — Uma verificação que não pode falhar não está verificando

**Aprendido em 2026-08-28**, escrevendo a auditoria de RNF-09.

A primeira versão perguntava: "o nome completo de algum menor aparece no corpo público?". Isso obriga uma ressalva, porque um adulto homônimo publica o mesmo nome legitimamente — então virou "a não ser que exista adulto com o mesmo nome".

Contra a massa real, a ressalva dispensou **151 de 151** menores. Vinte nomes e vinte sobrenomes em duas mil pessoas colidem sempre, e o script passou a responder "ok" sem ter verificado nada. **O que denunciou foi o próprio relatório**, porque ele imprimia o número de dispensas: "151 têm adulto homônimo, conferido" ao lado de "151 menores" é uma frase que se lê duas vezes.

A correção foi trocar presença por **contagem**: para cada nome, as ocorrências publicadas têm de bater com as Tentativas Válidas de quem tem aquele nome, adultos e menores separados. Um sobrenome que escape produz uma ocorrência a mais, e nenhum homônimo esconde isso.

**As duas lições, e a segunda é a que fica:**

1. Uma exceção larga demais transforma verificação em cerimônia.
2. **Guarda que ninguém viu falhar é guarda que ninguém sabe se funciona.** Desliguei a abreviação de propósito, republiquei e rodei: `"Pedro R.": esperadas 2, publicadas 0`, código de saída 1. Sem esse passo, o "ok" da versão quebrada e o "ok" da versão certa são a mesma linha de texto.

### D-90 — O limite de taxa foi calibrado pelo pior caso, porque a premissa de chegada não pôde ser confirmada

**Decidido em 2026-09-01**, fechando T23 sobre a medição de T18.

D-27 deixou os padrões do limite em 30 por janela de 10 minutos e 100 por hora, com a nota de que o número era palpite a calibrar. T18 mediu o palpite: 200 cadastros legítimos partindo do **mesmo IP** viraram **30 aceitos e 170 recusados** com 429. O mecanismo estava certo e a configuração, errada — **o 31º participante de uma fila levava um "tente mais tarde" sem ter feito nada**.

| variável | antes | agora |
|---|---|---|
| `RATE_LIMIT_CADASTROS_POR_JANELA` | 30 | **800** |
| `RATE_LIMIT_CADASTROS_POR_HORA` | 100 | **2400** |
| `RATE_LIMIT_JANELA_SEGUNDOS` | 600 | 600 |

**Por que 800 e não os 300 que o relatório propôs.** A conta de T18 dividia os 2000 participantes por três a cinco IPs de saída, com chegada espalhada em quatro horas, e propunha o dobro do pico resultante. Perguntado, o organizador respondeu que **não garante haver Wi-Fi no local**, e que o cadastro precisa funcionar tanto por Wi-Fi quanto por dados móveis. Isso derruba o divisor nos dois ramos:

- **Com Wi-Fi**, ele é um endereço só carregando uma fatia grande dos 2000 — não um quinto deles.
- **Sem Wi-Fi**, todo mundo entra por dados móveis, e o CGNAT da operadora é o caso que o próprio relatório nomeia: milhares de assinantes atrás de um endereço.

Não há ramo em que 300 mantenha a folga de 2× que o justificava. **A concentração de chegada continua não confirmada** — ninguém sabe dizer se a fila se forma na abertura ou se dilui pelo dia — e 800 é o valor que cobre a rajada.

**A assimetria é o argumento inteiro, e ela não é simétrica de propósito.** Errar para cima custa pouco: o limite existe contra automação em escala, e quem estiver decidido a automatizar não passa pelo NAT do evento, passa por fora dele — a segunda defesa contra isso é o tempo mínimo de formulário (`FORMULARIO_SEGUNDOS_MINIMOS`), que não depende de IP e não foi tocada. Errar para baixo custa participante recusado na fila, que é o custo mais caro que este sistema pode pagar (RNF-15).

**O que impede o número de voltar sozinho.** O padrão foi trocado **no código** (`src/shared/env.ts`), e não só na variável de ambiente da Vercel: o padrão é o que um ambiente novo herda quando alguém esquece de definir a variável, e um padrão que recusa a fila é uma armadilha esperando homologação. `tests/deploy.test.ts` recusa qualquer padrão abaixo do piso, com mensagem que nomeia o motivo em vez do número — porque o que precisa sobreviver é a razão, não o valor.

**R-2 mudou de mitigação, e não saiu do checklist.** Deixou de ser "`RATE_LIMIT_ATIVO=false` derruba o limite" e passou a ser "os valores foram calibrados sobre medição; a alavanca continua existindo para o caso de a calibração ter errado". A alavanca é pior que o número: ela não calibra, desliga — e deixa o cadastro sem contenção nenhuma pelo resto do evento.

**O alerta que faltava.** T16 tinha quatro alertas e nenhum olhava para 429. Uma recusa por `limite_ip` durante o evento é a única evidência de que esta decisão errou, e ela chegava só como contagem num relatório que alguém precisaria lembrar de rodar. Agora é o alerta `cadastro_limitado`, crítico, com limiar zero: com estes valores, participante legítimo não deveria alcançar o limite nenhuma vez.

**O que esta decisão não resolve.** A medição rodou numa máquina só, sem borda no meio. Vale para o número, porque o limite é contagem no banco e não depende de cache — mas se os 429 aparecerem no ambiente publicado com estes valores, foi a premissa de chegada que errou, e o número sobe de novo.

### D-91 — O cold start do banco é do plano, não do código: conviver custa dois minutos por dia, corrigir custa assinatura

**Decidido em 2026-09-03**, na primeira publicação, contra o ambiente real.

O Neon no plano gratuito suspende a computação depois de **5 minutos** de ociosidade, e desligar isso não é uma configuração que exista ali: só os planos Launch e Scale a oferecem. Medido contra `fiapspeedx.vercel.app`: com o compute suspenso, **a requisição que acorda o banco é a que falha**. Duas de duas batidas frias devolveram `503`; catorze segundos depois, a mesma rota respondia em 193 ms, e em seguida em 4 ms.

**Por que o `503` e não uma espera.** A sondagem de `/api/saude` tem teto de 1 s (`LIMITE_DA_SONDAGEM_MS`), escolhido em T16 para distinguir banco pendurado de banco lento. Acordar demora mais que um segundo, então a sondagem classifica o banco acordando como indisponível. O health check está certo para o que foi desenhado; ele apenas não conhece este terceiro estado.

**O que se decidiu: conviver, não corrigir.** Duas medidas, e nenhuma delas é código.

1. **Um disparador de 1 a 3 minutos** contra `/api/saude`. O intervalo tem de ser **menor** que o da suspensão, e é aqui que o plano original falhava: os 5 minutos do UptimeRobot gratuito empatam com os 5 minutos da suspensão e perdem a corrida com frequência. O monitor deixa de ser só observação e passa a ser parte do funcionamento.
2. **Aquecer antes de abrir a fila**, e depois de cada intervalo longo — linha nova no `plano-do-dia.md`.

**O custo do alerta, que quase passou despercebido.** Com o banco dormindo, `/api/saude` responde `503` legitimamente. Um monitor que alerta na primeira falha vai disparar em toda madrugada tranquila — e o próprio `src/infra/saude.ts` já nomeia esse risco a propósito de outra coisa: alarme falso é a maneira mais rápida de um alerta perder crédito. Por isso o item do checklist pede **confirmação antes do disparo**, não só o intervalo curto.

**A correção de verdade continua existindo e é comprável:** plano pago com scale-to-zero desligado. Um mês de assinatura para um evento de um dia é uma troca defensável, e fica registrada aqui como a saída caso o aquecimento se mostre frágil no ensaio.

**O que sobra de risco.** Enquanto for o plano gratuito, o primeiro visitante depois de um silêncio longo pode precisar de uma segunda tentativa. É o mesmo custo que D-90 passou uma tarefa inteira evitando — participante legítimo recusado sem ter feito nada (RNF-15) —, com a diferença de que ali a causa era configuração nossa e aqui é o plano do provedor.

### D-92 — O sistema visual passou a ser verificado, e não afirmado

**Decidido em 2026-09-03**, executando o PRD-front.

`globals.css` abria com duas afirmações: que nenhuma cor é escrita à mão dentro de um módulo, e que o anel de foco é um só em toda parte. **As duas eram falsas** — havia 47 cores literais em seis módulos, e o painel tinha 386 linhas com zero `var(--foco)`, justamente a tela operada por teclado durante dez horas.

O defeito não aparecia em tela nenhuma. Ele aparece **no dia em que a paleta muda**: cinco telas acompanham e duas não, e quem descobre é quem abre o site depois de publicado.

**A correção não foi arrumar as cores — foi tirar a afirmação do comentário e pôr num teste.** `tests/sistemaVisual.test.ts` recusa cor literal em módulo, anel de foco próprio, `@import`, `url()` e `style={{ }}` em linha. `tests/contraste.test.ts` lê os tokens de `globals.css` e calcula os 35 pares: 4.5:1 para texto, 3:1 para elemento gráfico.

**Por que calcular em vez de escrever a tabela.** O critério de aceitação pedia contraste "verificado par a par e escrito". Escrito envelhece no primeiro ajuste de tom, e ninguém refaz trinta e cinco contas à mão na véspera do evento. Calculado, a paleta nova só entra se passar.

**O que isso libera.** Trocar a identidade inteira virou trocar valores num arquivo — foi assim que D-93 aconteceu no mesmo dia, sem abrir seis módulos.

### D-93 — Asfalto e bandeira: a paleta saiu do azul-marinho, e custou 0,7 KB

**Decidido em 2026-09-03.**

A paleta anterior era azul-marinho sobre a escala de cinzas padrão de biblioteca. Tinha contraste e não tinha personalidade: parecia sistema interno, que é o oposto do que duas mil pessoas deveriam encontrar ao escanear um QR num evento.

| | antes | agora |
|---|---|---|
| escuro estrutural | azul-marinho `#12306b` | asfalto `#1f2530` |
| fundo | cinza-gelo `#f8fafc` | papel morno `#f7f6f4` |
| acento | âmbar `#b45309` | brasa `#c2410c` |

**O argumento de cada troca.** O asfalto é a cor do chão onde a corrida acontece, e separa o produto de qualquer painel corporativo — carregando branco com 15:1, que importa mais que o tom porque a tela vai estar ao sol. O papel morno substitui o cinza azulado porque, sob luz forte, o frio lava e some contra a superfície branca; o morno mantém as duas distinguíveis. E a energia ficou concentrada num acento só: cor quente que marca, nunca decora.

**Junto vieram as escalas que faltavam**: oito passos de espaço e uma escala tipográfica de razão 1,25, no lugar do `rem` avulso que cada módulo escolhia — havia `0.85rem`, `0.875rem` e `0.9rem` significando a mesma intenção em arquivos diferentes.

**A hierarquia da Classificação mudou junto, e é o retorno maior.** As quatro colunas tinham o mesmo peso visual, e não valem a mesma coisa: quem abre a página faz uma pergunta só — "onde eu estou?" — e a responde varrendo a coluna de nomes. O nome passou a ser o maior, o tempo vem logo atrás, a posição virou índice apagado (menos nas três do pódio) e o Cockpit virou etiqueta.

**O custo, medido:** o primeiro carregamento foi de **142,3 KB para 143,0 KB gzip**, com os mesmos 10 recursos e nenhum pedido de rede novo. Teto de 150. Ou seja, a identidade inteira custou 0,7 KB — porque saiu de cor, espaço e tipografia do sistema, que é o que carrega em zero byte, e não de fonte ou imagem, que teriam custado de 15 a 30 KB cada e estouravam a folga sozinhas.


---

## 4. Premissas assumidas

| # | Premissa | Se cair |
|---|---|---|
| P-01 | ~~Stack Next.js + PostgreSQL (D-03)~~ — **deixou de ser premissa em 2026-08-18**: Next 16.3, React 19.2, TypeScript 6.0, Zod 4.4 e ESLint 9.39 estão instalados e verificados | — |
| P-07 | PostgreSQL segue como escolha de banco, ainda não instalado nem provisionado | T02 muda; os contextos não, pois nenhum depende do banco ainda |
| P-02 | A hospedagem anunciará HTTP/3. **A Vercel anuncia** (D-76); o que falta é o `curl --http3` contra o domínio de verdade | FL-02 e FL-07 caem para TCP e RNF-04 fica em risco; verificação obrigatória assim que o domínio existir (`docs/deploy.md` §4), com o risco declarado em T21 |
| P-03 | Dois Cockpits, valores 1 e 2, fixos | `tentativa_cockpit_valido` e a UI de duas abas precisam mudar |
| P-04 | Um único evento, sem multi-evento | O esquema não tem `evento_id`; acrescentar depois é migração custosa |
| P-05 | Operadores em número pequeno, criados por CLI | Se forem muitos, será preciso uma tela de administração |
| P-06 | Idade é informada, não derivada de data de nascimento | Segue o PRD (RF-02 pede "idade"); se virar data de nascimento, T02, T04 e T06 mudam |

---

## 5. Pendências abertas

| # | Pendência | Quem resolve | Bloqueia |
|---|---|---|---|
| PE-01 | ~~Termo oficial: **Pitch** ou **Pista**~~ — **resolvida em 2026-08-25**: nenhuma das duas. São dois **Cockpits**, que é onde fica o simulador (D-75). A troca custou duas linhas em `src/shared/vocabulario.ts`, como D-31 previa, mais duas mensagens que tinham escapado da constante | — | — |
| PE-02 | ~~Prazo de retenção dos dados após o evento (RNF-11)~~ — **resolvida em 2026-08-19**: máximo de 10 dias após o evento, definido pelo usuário. Já escrito na seção `retencao` do termo; T15 usa a data do evento (PE-06) como base da contagem | — | — |
| PE-03 | ~~Canal para solicitação de exclusão de dados (RF-09)~~ — **resolvida em 2026-08-19**: presencial, no ponto de inscrição durante o evento; sem canal remoto (D-20). Já escrito na `v0.2` do termo | — | — |
| PE-04 | ~~Aprovação por escrito do texto de consentimento (RF-09)~~ — **resolvida em 2026-08-19**: `v1.0-2026-08-19` aprovada por Dhiego, registro em `docs/aprovacao-termo.md`. Se o organizador formal do NEXT for outra pessoa, cabe contra-assinar, sem custo de versão | — | — |
| PE-05 | Hospedagem, banco e domínio. **Resolvida em cinco sextos.** Banco: **PostgreSQL 18** (D-14, 2026-08-23), hospedado no **Neon, região `aws-sa-east-1`** (D-79, 2026-08-27). Aplicação: **Vercel gratuita**, funções em `gru1` (D-76). Monitor externo: **UptimeRobot gratuito** (D-82). **Falta o domínio**, e ele sozinho segura quatro critérios de T19, o QR definitivo de T07 (D-35) e o desligamento do site prometido no termo. O uso não comercial do plano Hobby deixou de ser risco em 2026-08-25: é iniciação científica em nome da universidade, sem marca de patrocinador na página (D-76) | Time técnico | T19 (quatro critérios), material impresso de T07, o desligamento do site (T15 §3, passo 5), a configuração do monitor |
| PE-06 | ~~Data do evento e janela de operação~~ — **resolvida em 2026-08-25**: **24 de outubro de 2026**, em São Paulo (o local já estava confirmado desde 2026-08-23, e é o que fixa `America/Sao_Paulo`). A retenção vence em **4 de novembro de 2026, 00:00**, escrito em `docs/retencao.md` §2. `npm run expurgar` continua exigindo `--evento 2026-10-24` escrito à mão: a data existir não a torna valor padrão (D-63) | — | — |

---

## 6. Vocabulário do projeto

Glossário completo no [SDD §3](SDD.md). Os termos que mais causam confusão:

- **Cockpit** — um dos dois postos de simulador, onde fica o simulador que a pessoa disputa. É atributo da **Tentativa**, nunca do Participante. Uma palavra só, da tela ao nome da coluna `tentativa.cockpit` (D-75, D-77). "Pitch" e "Pista" aparecem no texto histórico deste arquivo porque era o que se pensava até 2026-08-25.
- **Tentativa** — intenção registrada de um Participante disputar um Pitch. Nasce Pendente na Inscrição. É o agregado raiz da Cronometragem. Evitar chamar de "corrida", porque "corrida" também nomeia o evento inteiro.
- **Lançamento** — o **ato** de registrar um Tempo. Distinto de **Tempo**, que é o valor. RF-23 rastreia lançamentos, não tempos.
- **Nome Público** — nome + inicial do sobrenome. Existe **somente** no contexto de Classificação; é o único identificador pessoal admissível em superfície pública.
- **Ausente** — estado da Tentativa de quem não compareceu. Sai da Fila, permanece na Exportação, não aparece na Classificação. **Não é exclusão.**
- **Operador** — usuário autenticado que faz lançamentos. O organizador chama de "supervisor"; no sistema, o termo oficial é Operador.
- **Versão do termo** — identificador do texto de consentimento (`v0.1-rascunho-2026-08-19`), gravado em `consentimento.versao_termo` a cada cadastro. Não é número de release do sistema: muda quando o **texto** muda, e só então.
- **Sessão** — linha da tabela `sessao` que liga um Operador a uma janela de tempo. O cookie do navegador não é a sessão: é um número aleatório que aponta para ela. Encerrar a sessão é escrever uma coluna, não esperar um prazo.
- **Guarda** — a conferência de acesso feita no servidor antes de qualquer trabalho: `exigirOperador` nas páginas do painel, `exigirOperadorNaApi` nas rotas. Não é o mesmo que "não ter link para o painel".
- **Rascunho** (de termo) — versão ainda não aprovada pelo organizador. Não é rótulo editorial: sob rascunho, nenhum consentimento pode ser registrado (D-18).
