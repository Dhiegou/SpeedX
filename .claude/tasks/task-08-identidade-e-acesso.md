# T08 — Identidade e Acesso (BC-04)

**Contexto SDD:** BC-04 · fluxo FL-04
**Depende de:** T02
**Bloqueia:** T10, T14
**Requisitos:** RF-11, RF-12, RNF-14

---

## Objetivo

Autenticar Operadores e fornecer sua identidade aos demais contextos. O SDD trata este contexto como genérico e substituível: Cronometragem deve depender apenas do conceito de "Operador autenticado", nunca do mecanismo.

## Escopo

1. **Login por usuário e senha** em `/painel/login`, sobre TLS (FL-04).
   - Hash de senha com Argon2id (ou bcrypt com custo adequado).
   - Resposta genérica para usuário inexistente e senha errada — sem distinguir os dois casos.
   - Limite de tentativas por usuário e por IP.
2. **Sessão** em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, com expiração que cubra a janela inteira do evento com folga (ex.: 16 horas) — o Operador **não pode** ser deslogado no meio do dia.
   - Renovação silenciosa a cada requisição autenticada.
3. **Sem auto-cadastro** (RNF-14). Nenhuma rota pública cria conta. Operadores são criados por **script de CLI administrativo** (`npm run criar-operador`), executado por quem tem acesso ao ambiente.
4. **Múltiplas sessões simultâneas** de Operadores distintos são permitidas e não se invalidam (RF-12).
5. **Interface para os demais contextos:** `getOperadorAtual(): { id, nome } | null`. É a única coisa que BC-02 e BC-05 conhecem sobre autenticação.
6. **Guarda de rota:** todo caminho sob `/painel` e `/api/painel` exige sessão válida; sem sessão, redireciona ou responde 401. Aplicar no servidor, jamais só no cliente.
7. Logout explícito.

## Critérios de aceitação

- [ ] Acesso a qualquer rota do painel sem sessão válida é bloqueado no servidor (RF-11) — verificado com `curl` sem cookie, não pela tela.
- [ ] Não existe nenhuma rota, formulário ou endpoint público que crie conta (RNF-14) — verificado por leitura do roteamento.
- [ ] Dois operadores logados simultaneamente permanecem ambos válidos; a sessão de um não invalida a do outro (RF-12).
- [ ] Senha nunca aparece em log nem em resposta.
- [ ] Sessão sobrevive a 10 horas de uso contínuo (teste com relógio adiantado).
- [ ] `getOperadorAtual` é o único ponto de leitura de sessão fora deste contexto (verificado por busca no código).

---

## Resultado da execução — 2026-08-22

| Arquivo | Papel |
|---|---|
| `src/contexts/identidade/modelo.ts` | O que os outros contextos conhecem: `{ id, nome }`, e nada mais |
| `src/contexts/identidade/senha.ts` | Derivação e conferência com scrypt; o gasto de tempo da recusa |
| `src/contexts/identidade/sessao.ts` | Abrir, resolver, renovar, encerrar, expurgar |
| `src/contexts/identidade/autenticar.ts` | Caso de uso do login: validação, limite, senha, sessão |
| `src/contexts/identidade/politicaDeLogin.ts` | As faixas por origem e por conta |
| `src/contexts/identidade/schema.ts` | Forma da credencial que chega pela rede |
| `src/contexts/identidade/criarOperador.ts` | Criação e desativação de conta — sem rota, só CLI |
| `src/contexts/identidade/servico.ts` | Composição: banco, cookie e as duas guardas |
| `src/infra/limiteDeTaxa.ts` | O limite de taxa, mudado de casa (ver abaixo) |
| `src/shared/ambienteCli.ts` | Carrega o `.env` para os comandos de terminal |
| `app/api/painel/sessao/route.ts` | `POST` entra, `DELETE` sai, `GET` diz quem é — guardado |
| `app/painel/login/` | Tela de login, fora do grupo protegido |
| `app/painel/(protegido)/` | Layout com a guarda, mais uma página provisória até T11 |
| `scripts/criar-operador.ts` | `npm run criar-operador`, com senha digitada sem eco |
| `src/db/migrations/0003_sessao_do_operador.sql` | Tabela `sessao` e unicidade funcional do usuário |
| `tests/identidade.test.ts`, `tests/endpointPainel.test.ts`, `tests/painelGuarda.test.ts` | 50 testes |

### As cinco decisões que valem registro

1. **Sessão no banco, não cookie assinado** (D-36). Um cookie autocontido é mais barato — nenhuma consulta por requisição — e paga isso com a revogação. Com dezesseis horas de validade, desativar um Operador ou clicar em sair não teria efeito nenhum até o prazo vencer. Quem assina Lançamentos com autoria registrada (RF-23) precisa poder deixar de assinar na hora em que a organização decide isso. O custo é uma consulta indexada por requisição autenticada, feita por um punhado de pessoas.

2. **scrypt, não Argon2id nem bcrypt** (D-37). O escopo pedia um dos dois. Os dois exigem compilação nativa, e o provedor de hospedagem ainda não existe (PE-05): uma dependência que precisa de toolchain C é o tipo de coisa que falha no primeiro deploy de um sistema que roda um dia só. scrypt é memory-hard como o Argon2id, está dentro do Node, e o formato gravado carrega o algoritmo — trocar depois é decidir em `conferirSenha`, não migrar hash.

3. **O limite de taxa mudou de casa** (D-38). Estava em `contexts/inscricao/`, com um bilhete dizendo que sairia dali no dia em que houvesse um segundo uso. Este é o dia, e a mudança não foi arrumação: Identidade **não pode** importar Inscrição (o lint recusa, SDD §2). Foi para `src/infra/`, camada nova, abaixo dos contextos — `shared/` não servia porque é folha e não alcança o banco.

4. **O desligamento de emergência não vale para o login** (D-39). `RATE_LIMIT_ATIVO` existe para destravar a fila de inscrição no dia do evento. Enquanto a política morava dentro do mecanismo, puxar essa alavanca teria destravado junto a força bruta contra o painel — um efeito colateral que ninguém decidiu. Agora quem passa a política é o contexto: Inscrição obedece à alavanca, Identidade não a conhece.

5. **A renovação silenciosa só acontece na API** (D-40). O escopo pedia renovação a cada requisição autenticada. Server Component não escreve cookie — a resposta pode já estar sendo transmitida —, então a renovação vive nas rotas de `/api/painel`, por onde o Operador passa o dia. Quem logou e ficou parado tem o teto de `SESSAO_HORAS`, que cobre o evento inteiro. E não grava a cada chamada: só quando a última gravação passou de `SESSAO_RENOVACAO_MINUTOS`.

### Três defeitos encontrados pelos testes, nenhum deles nesta task

**O saneamento do log corroía UUIDs.** `sanear` apaga sequências de dez dígitos ou mais com separador — a forma de um telefone. Um UUID sorteado com onze dígitos seguidos no começo tem exatamente essa forma, e `cb103307-9014-43c3-...` virava `cb[removido]c3-...`. O comentário do arquivo afirmava o contrário, e o teste de T05 passava porque o UUID escolhido à mão tinha letras cedo o bastante. Quem perdia era o registro que existe para dizer **quem** assinou o Lançamento. Corrigido em `src/shared/log.ts`, com regressão usando os UUIDs que disparam o caso.

**O teto de paralelismo dos testes não existia.** `vitest.config.mts` limitava a três processos por `poolOptions.forks` desde T02. O Vitest 4 **removeu** essa opção: avisava a cada execução e rodava com a paralelização padrão. A suíte vinha passando por folga de memória, não por configuração. Acrescentar dois arquivos de banco e uma derivação que reserva 64 MiB por conferência derrubou um worker de forma intermitente. Reescrito como `maxWorkers: 2`.

**Os comandos de terminal não liam o `.env`.** `next dev` e `next start` carregam sozinhos; `tsx` não. `npm run db:migrate`, `db:seed` e o novo `criar-operador` morriam na validação de ambiente reclamando de `DATABASE_URL` com o arquivo ali ao lado. Resolvido em `src/shared/ambienteCli.ts`, com `@next/env` — o mesmo carregador da aplicação, para que comando e aplicação não enxerguem configurações diferentes.

### Critérios de aceitação

- [x] Acesso a qualquer rota do painel sem sessão válida é bloqueado no servidor (RF-11). — verificado com `curl` contra o `next start`: `/painel` responde **307** para `/painel/login` e `GET /api/painel/sessao` responde **401** com `Cache-Control: no-store`. E protegido daqui em diante por `tests/painelGuarda.test.ts`, que falha se uma rota nova sob `/api/painel` esquecer a guarda ou se uma página nova nascer fora do grupo `(protegido)`.
- [x] Não existe nenhuma rota, formulário ou endpoint público que crie conta (RNF-14). — leitura do roteamento **automatizada**: nenhum arquivo sob `app/` importa ou chama `criarOperador`, e o único importador em todo o repositório é `scripts/criar-operador.ts`.
- [x] Dois operadores logados simultaneamente permanecem ambos válidos (RF-12). — e duas sessões do **mesmo** Operador também, porque dois tablets no mesmo Pitch é o uso previsto. O logout de uma não derruba a outra.
- [x] Senha nunca aparece em log nem em resposta. — teste que espia `process.stdout` durante um login aceito e um recusado e procura a senha nas duas saídas.
- [x] Sessão sobrevive a 10 horas de uso contínuo. — relógio adiantado: viva às 10 h, morta às 17 h sem renovação, viva às 17 h com uma renovação feita às 9 h.
- [x] `getOperadorAtual` é o único ponto de leitura de sessão fora deste contexto. — teste estrutural: nenhum arquivo fora de `identidade/servico.ts` importa `next/headers` ou conhece o nome do cookie.

### O que ficou de fora, e por quê

**Nenhum `proxy.ts`.** A documentação do Next é explícita: o proxy roda em toda rota, inclusive nas pré-buscadas, e serve para conferência otimista — não deve ser a única defesa. A decisão de acesso ficou onde os dados são alcançados: o layout do grupo protegido e cada rota de API. Um proxy acrescentaria uma segunda cópia da regra e a ilusão de que ela é a que vale.

**Prefixo `__Host-` só em produção.** O navegador só aceita o cookie com esse prefixo por HTTPS, com `Path=/` e sem `Domain` — o que fecha a porta de um subdomínio sobrescrever a sessão do painel. Em `http://localhost` ele seria descartado em silêncio e ninguém conseguiria logar em desenvolvimento.

## Estado

**Concluída em 2026-08-22.** Login, sessão, guardas e criação de contas por CLI, com 50 testes novos. Desbloqueia T10 (API do painel) e T14 (exportação), que agora têm de quem depender para autoria e acesso.

Um critério fica aberto por falta de ambiente: o login de ponta a ponta contra Postgres de verdade não rodou nesta máquina — não há banco local de pé (`ECONNREFUSED`). O caminho inteiro está coberto contra Postgres real na suíte, via PGlite, e a verificação com `curl` cobriu o que não depende do banco. Refazer com banco de pé é item de T19.

---

## Adendo — 2026-08-23: fechamento das decisões

D-36, D-37, D-38 e D-40 confirmadas sem mudança. D-39 estava incompleta: tirou o
login do alcance de `RATE_LIMIT_ATIVO` — corretamente — e não pôs alavanca
nenhuma no lugar. Um Operador que errasse a senha dez vezes ficava fora por
quinze minutos, com a fila do Pitch parada, e a única saída seria editar
`limite_taxa` no terminal durante o evento.

Fechada com `src/contexts/identidade/destravarLogin.ts` e a opção
`npm run criar-operador -- --destravar <usuario>`. Zera o contador, não desliga
o limite; não encosta no limite do cadastro público. Três testes novos, 352 no
total. Raciocínio completo em D-44 no `CONTEXT.md`.

**Banco definido:** PostgreSQL 18 — a versão que o PGlite executa nos testes
(`select version()` → 18.3). Resolve metade da PE-05.

---

## Adendo — 2026-08-23: o critério aberto fechou

O login de ponta a ponta rodou contra **PostgreSQL 18.6 nativo** (Windows, UTF8,
collate `Portuguese_Brazil.1252`), com 2000 participantes e 2973 tentativas de
massa no banco. Vinte e um passos por `curl`, contra a aplicação de pé:

| # | Verificação | Resultado |
|---|---|---|
| 1 | `GET /painel` sem cookie | **307** → `/painel/login` |
| 2 | `GET /api/painel/sessao` sem cookie | **401** `nao_autenticado` |
| 3–4 | Senha errada · usuário inexistente | **401**, corpo **byte a byte idêntico** |
| 5 | Credencial correta | **200** com `{ operador, expiraEm }`, sem token no corpo |
| 6 | `Set-Cookie` | `speedx_sessao`, `HttpOnly`, `SameSite=lax`, `Path=/`, sem `Secure` (correto em `http://localhost`) |
| 7–8 | API e página com cookie | **200**; o HTML traz o nome do Operador |
| 9 | Cookie forjado | **401** |
| — | Linha em `sessao` | `token_hash` gravado (não o token), `encerrada_em` nulo, **16 h** de validade |
| 10–12 | Logout | **204**; `encerrada_em` preenchido, linha preservada; o mesmo cookie passa a dar **401** |
| 13 | Dez senhas erradas | 401 até esgotar a cota, depois **429** |
| 14 | Senha certa sob trava | **429** com `Retry-After: 853` |
| 15 | `--destravar teste-e2e` (D-44) | 9 marcas da conta + 10 de origem apagadas |
| 16–17 | Login logo em seguida | **200**, sessão nova funcionando |
| 18–20 | `--desativar` com sessão **viva** | a sessão cai na requisição seguinte: **401** na API, **307** na página |
| 21 | Operador `seed`, cujo hash é a string `nao-serve-para-login` | **401**, não 500 — hash ilegível é recusa, não erro |

O passo 20 é o que justifica D-36 na prática: com um cookie assinado
autocontido, aquela sessão continuaria válida por dezesseis horas depois de a
conta ser desativada.

Massa de teste removida ao final; o banco ficou como estava (2000 participantes,
2973 tentativas, os dois Operadores originais, zero sessões).

**Este critério deixa de depender de T19.** O que continua lá é a verificação
com TLS e credencial de produção (SDD FL-09), que exige a hospedagem escolhida.
