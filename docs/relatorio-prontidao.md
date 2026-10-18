# Relatório de prontidão — 17/10/2026, sete dias antes do evento

> **Veredicto: NÃO PODE abrir as inscrições hoje.** Passa a "pode, com ressalva" quando três coisas virarem: (1) um disparador de 1 a 3 minutos contra `/api/saude` estiver ativo e o cold start for reverificado; (2) a falha do job de ponta a ponta no CI, que vem reprovando o commit publicado, tiver causa conhecida; (3) o organizador decidir o domínio e o QR for regenerado — o QR que está no repositório aponta para `speedx.exemplo.br`, que não existe.

Executado em 2026-10-17, entre 20:06Z e 20:40Z, contra `https://fiapspeedx.vercel.app`
(versão publicada `c596953`, o mesmo commit do `HEAD`) e contra a árvore local.
Seguindo o PRD de verificação, nenhum código de produto, teste ou configuração de
produção foi alterado. Os únicos arquivos alterados estão em §8.

**Como ler.** Cada item tem um de três veredictos: **PASSOU** (comando rodado, saída
colada), **REPROVOU** (comando rodado, saída colada, o esperado ao lado) e
**NÃO VERIFICÁVEL DAQUI** (por que não, e quem consegue). Nada aqui foi concluído
lendo código.

> **Atualização da mesma noite (`PRD-go-live.md`).** A condição (2) do veredicto
> virou: a causa do e2e vermelho é conhecida e **não é defeito do site publicado**.
> São 28 de 28 contra `c596953` num Postgres descartável. Os dois testes de 360 px
> dependem da fonte que o runner Ubuntu tem (D-104). Consertado com a fonte fixa em Roboto (D-106).
> Também mudaram: R8 (o `PRD.md` foi restaurado, e `npm test` dá 703 de 703) e R4
> (`o-que-falta-para-voce.md` passou a dizer 800/2400, com D-90). R5 foi medido de
> novo com `inlineCss` (D-105). A flag entrou, com o teto em 151 KB (D-106), e falta conferir depois do deploy. **O veredicto continua "não
> pode"**: as condições (1) e (3) seguem abertas.

---

## 1. O que reprovou, por consequência no dia do evento

| #   | achado                                                                                                                                                                                                                       | o que acontece no dia 24 se ficar assim                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Cold start: 3 de 3 batidas frias devolveram `503`**, e uma das três repetições imediatas também. **Não existe disparador de aquecimento** — o banco ficou suspenso das 13:17Z às 19:49Z de hoje sem ninguém acordá-lo (B3) | A primeira pessoa a escanear o QR pela manhã, e a primeira depois de cada pausa de 5 min, recebe erro sem ter feito nada. Repetir na hora nem sempre resolve                         |
| R2  | **O QR do repositório codifica `https://speedx.exemplo.br`**, gerado em 21/08 (`docs/qr/inscricao.svg`). Nenhum material impresso existe ainda (§7)                                                                          | Se esse arquivo for à gráfica, todo cartaz aponta para lugar nenhum. Se nada for à gráfica, não há contingência em papel quando a internet cair                                      |
| R3  | **O job "Testes de ponta a ponta" do CI falha nos quatro últimos commits**, incluindo o publicado `c596953`. Último verde: `ba96d2c`, 09/09 (B1.6)                                                                           | Desconhecida — e é esse o problema. A suíte que exercita cadastro, painel e 360 px de ponta a ponta está vermelha sobre o código que está no ar                                      |
| R4  | **`docs/o-que-falta-para-voce.md` §3 manda pôr 300 e 1200 na Vercel**, abaixo dos 800 e 2400 decididos em D-90. Este PRD de verificação repetiu esses números (B2.6)                                                         | Se alguém seguir o documento, o limite cai para menos da metade do calibrado, e a fila atrás de um mesmo IP (Wi-Fi do local, CGNAT) volta a levar `429` — o defeito que T23 corrigiu |
| R5  | **RNF-04 reprova em 3G lento: 4,98 s publicado, 4,77 s local**, contra a meta de 3 s. Antes era 4,6 s (B4.1)                                                                                                                 | Quem estiver em 3G lento espera ~5 s para ver a página. 3G rápido e 4G passam                                                                                                        |
| R6  | **`next@16.3.1` está na faixa de três avisos críticos** do `npm audit`, um deles em `next/og` (`ImageResponse`), que `app/opengraph-image.tsx` usa. Correção em `next@16.3.8` (B1.1)                                         | Exposição real não verificada daqui (ver N9). O cartão é estático, sem entrada de usuário, o que reduz a superfície, mas não a anula                                                 |
| R7  | **HTTP/3 não é anunciado**: sem `alt-svc`, nem por cabeçalho nem por quadro ALTSVC (B2.1)                                                                                                                                    | FL-02/FL-07 caem para TCP. Já é o risco R-1 do checklist de T21, que **continua sem assinatura**                                                                                     |
| R8  | **`npm test` na árvore de hoje: 701 de 703.** O `PRD.md` do produto foi sobrescrito, sem commit, por este PRD de verificação, e `tests/rastreabilidade.test.ts` lê esse arquivo (B1.3)                                       | Nenhuma no site. Mas um commit feito agora levaria o CI ao vermelho e apagaria o PRD do produto do histórico de trabalho                                                             |
| R9  | **Não existe banco de homologação.** O Neon tem uma branch só, `production`, e o `.env` local aponta para ela (B2.9)                                                                                                         | Qualquer `npm run perf:preparar`, `db:seed` ou teste e2e rodado desta máquina escreve no banco do evento. `deploy.md` §6 promete dois bancos                                         |

**Observações que não chegam a reprovar**, mas que alguém precisa saber:

- Produção tem **1 participante de teste** (cadastrado em 03/09) e **1 Operador** (B2.9). O participante vai sair nas exportações e no relatório de pendências se ficar lá.
- Na madrugada após ~24 h sem uso, o Neon gratuito **arquiva a branch** (`timeline_archive` em 13/10 e 16/10), e o despertar seguinte demora mais: 2,2 a 3,2 s de `start_compute`, contra 0,5 a 1,8 s no ciclo normal. No dia 24 de manhã, a primeira batida pegará esse caso.
- `GET` em `/api/painel/tentativa` e `/api/painel/ausencia` (rotas só de `POST`) devolve o 405 automático do framework com `Cache-Control: public, max-age=0, must-revalidate`, e não `no-store`. O corpo é vazio e `max-age=0` impede reuso, então não vaza nada. Fica registrado porque `tests/deploy.test.ts` diz vigiar "todo o resto é `no-store`", e esse caso escapa da vigilância.
- O README dizia 594 testes; `docs/testes.md` e `o-que-falta-para-voce.md` dizem 636. Hoje são **703** (corrigido só no README, como o PRD pediu).

---

## 2. O que NÃO É VERIFICÁVEL DAQUI, e quem consegue

| #   | item                                                                                                                                                                                                                                                                            | por que não                                                                                                                                                                                                                            | quem verifica, e como                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **Valor do limite de taxa que a produção usa** (variáveis `RATE_LIMIT_*` definidas ou não)                                                                                                                                                                                      | Não há CLI da Vercel nem `.vercel/` nesta máquina. O valor só aparece de fora num `429`, o que exigiria ~800 cadastros reais em produção. O padrão de 800/2400 em `src/shared/env.ts` é evidência sobre o código, não sobre o ambiente | Quem tem acesso ao projeto na Vercel: _Settings → Environment Variables_, ou `vercel env ls production`. **Conferir que não estão em 300/1200** (R4) |
| N2  | O texto literal da `DATABASE_URL` na Vercel                                                                                                                                                                                                                                     | Mesmo motivo. O **comportamento** foi verificado (B2.7: as conexões da produção chegam pelo PgBouncer)                                                                                                                                 | Quem tem acesso à Vercel: o host deve terminar em `-pooler`                                                                                          |
| N3  | **Por que o e2e do CI falha**                                                                                                                                                                                                                                                   | Os logs de job do GitHub Actions exigem login; a API pública só diz "exit code 1". Rodar localmente exige um Postgres descartável, e esta máquina não tem Docker nem Postgres — o único banco ao alcance é o de produção (R9)          | O dono do repositório: Actions → run `38670617086` → artefato `playwright-report`                                                                    |
| N4  | Monitor externo (UptimeRobot) configurado, e o disparo do alerta                                                                                                                                                                                                                | A conta não está ao meu alcance. O que deu para provar: **nada chamou rota que toca o banco entre 13:17Z e 19:49Z** (B3.2), então, se o monitor existe, não está apontado para `/api/saude`                                            | Quem tem a conta do UptimeRobot. Teste do alerta: ensaio 8                                                                                           |
| N5  | **Restauração de backup** testada                                                                                                                                                                                                                                               | Restaurar mexe no Neon, fora de escopo. Observado: a janela de histórico do projeto é de **6 horas** (`history_retention_seconds: 21600`, plano `free_v3`) — um erro só percebido no dia seguinte já não tem volta                     | Time técnico, numa branch nova, com a data anotada em `deploy.md` §8                                                                                 |
| N6  | Contas dos Operadores criadas **e testadas por cada pessoa**                                                                                                                                                                                                                    | Senha é pessoal. O banco tem **1** Operador hoje                                                                                                                                                                                       | Cada Operador, no próprio aparelho, antes do dia                                                                                                     |
| N7  | Material impresso                                                                                                                                                                                                                                                               | Não existe ainda e depende de §7                                                                                                                                                                                                       | Organizador, depois da decisão do domínio                                                                                                            |
| N8  | Os ensaios de `o-que-falta-para-voce.md`: contingência em papel, lançamento cronometrado em 15 s, cadastro em 2 minutos, QR com três leitores, Classificação em 360 px sob sol, exportação no Excel em português, **cadastro em 3G real**, disparo do alerta, atalhos do painel | Dependem de gente, aparelho, rede e luz reais                                                                                                                                                                                          | O time, na tarde de ensaios. Levar os números de B4.1 para o item do 3G                                                                              |
| N9  | Se as falhas críticas de `next@16.3.1` (R6) são exploráveis nesta publicação                                                                                                                                                                                                    | Provar exige tentar explorar produção, o que não se faz                                                                                                                                                                                | Quem decidir a atualização para `16.3.8`. Ela é um deploy, e o congelamento é só no dia 24                                                           |
| N10 | RNF-09 (sobrenome de menor) contra dado real                                                                                                                                                                                                                                    | `npm run auditar` rodou, mas a base de produção não tem nenhuma Tentativa válida (B2.8)                                                                                                                                                | Rodar de novo durante o evento, como o próprio script prevê                                                                                          |

---

## 3. Bloco 1 — A árvore local

### B1.1 `npm ci` — **PASSOU**, com aviso de segurança (R6)

```
added 857 packages, and audited 858 packages in 3m
24 vulnerabilities (8 moderate, 15 high, 1 critical)
```

Só as dependências de produção (`npm audit --omit=dev`):

```
next critical 16.0.0 - 16.3.7
sharp high <=0.35.5-rc.1
source-map-js high 1.0.0 - 1.2.1

critical | Next.js: Unauthenticated Remote Code Execution on windows-hosted servers | >=16.0.0 <16.3.3
critical | Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used | >=16.0.0 <16.3.3
critical | Next.js: Remote Code Execution in next/og ImageResponse | >=16.2.0 <16.3.6
high     | Next.js has Server-Side Request Forgery in Image Optimization | >=16.0.0 <16.3.8
(mais cinco moderados/baixos, todos corrigidos em <16.3.8)
```

`npm ls next` → `next@16.3.1`. `app/opengraph-image.tsx:1` importa `ImageResponse` de `next/og`. O primeiro aviso crítico (Windows) não se aplica à Vercel.

### B1.2 `npm run check` — **PASSOU**

```
> eslint .
> tsc --noEmit
> prettier --check .
Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

### B1.3 `npm test` — **REPROVOU na árvore de hoje; PASSOU no commit publicado**

Na árvore de trabalho:

```
 FAIL  tests/rastreabilidade.test.ts > ... > o PRD continua sendo lido — 35 requisitos funcionais e 18 não funcionais
AssertionError: expected [] to have a length of 35 but got +0
 FAIL  tests/rastreabilidade.test.ts > ... > não há justificativa para requisito que o PRD não contém
AssertionError: Justificativa sem requisito correspondente: RNF-04, RNF-05, RNF-15.

 Test Files  1 failed | 37 passed (38)
      Tests  2 failed | 701 passed (703)
EXIT=1
```

Esperado: 703 de 703. Causa, verificada com `git status` (` M PRD.md`) e `git show HEAD:PRD.md`: o `PRD.md` na árvore é este PRD de verificação, que sobrescreveu o PRD do produto (v2.0) sem commit. O teste lê `PRD.md` e não encontra mais os 35 RF e 18 RNF.

Contraprova, numa cópia limpa do `HEAD` (`git worktree add --detach … HEAD`, mesmas dependências):

```
 Test Files  38 passed (38)
      Tests  703 passed (703)
   Duration  88.73s
```

**O número do autor do PRD se confirma: 703 testes em 38 arquivos, contra o código publicado.** O teste não foi alterado. O conserto é guardar o PRD de verificação com outro nome e restaurar o `PRD.md` (`git checkout -- PRD.md`). Não fiz isso porque o arquivo é seu e não está commitado.

### B1.4 `npm run build` — **PASSOU**

```
✓ Compiled successfully in 1205ms
  Finished TypeScript in 4.5s ...
✓ Generating static pages using 11 workers (15/15) in 1095ms
Route (app)
┌ ƒ /                       ├ ƒ /classificacao       ├ ○ /opengraph-image
├ ƒ /api/classificacao      ├ ƒ /painel              ├ ƒ /termo
... (21 rotas; 2 estáticas, 19 dinâmicas)
EXIT=0
```

### B1.5 `npm run orcamento` — **PASSOU**, local e publicado

```
##### LOCAL (next start)                    ##### PUBLICADO
/                146.3 KB  folga 3.7 KB    /termo           146.8 KB  folga 3.2 KB
/termo           145.8 KB  folga 4.2 KB    /                146.6 KB  folga 3.4 KB
/classificacao   143.6 KB  folga 6.4 KB    /classificacao   143.8 KB  folga 6.2 KB
/painel/login    136.5 KB  folga 13.5 KB   /painel/login    136.8 KB  folga 13.2 KB
Todas as rotas dentro do orçamento.        Todas as rotas dentro do orçamento.
```

Teto de 150 KB gzip. Na publicação, a folga mais apertada é a do termo: 3,2 KB.

### B1.6 CI no GitHub — **REPROVOU** (fora dos cinco comandos, mas é o mesmo portão)

`GET api.github.com/repos/Dhiegou/SpeedX/actions/runs`:

```
c596953 push completed failure 2026-10-15T02:22:13Z
16bbb5f push completed failure 2026-10-15T01:06:36Z
5619593 push completed failure 2026-10-15T00:22:41Z
25c07e7 push completed failure 2026-10-14T23:54:27Z
...
ba96d2c success 2026-09-09   ← último verde

JOB Testes de ponta a ponta failure
    failure - Testes de ponta a ponta
JOB Lint, tipos e testes success
```

Esperado: os dois jobs verdes no commit publicado. A causa está em N3. `npx playwright test --list` → `Total: 28 tests in 5 files` (listados, **não rodados** daqui).

---

## 4. Bloco 2 — O ambiente publicado

Antes de tudo: `/api/saude` devolve `"versao":"c596953"`, então o que está no ar é o `HEAD`.

### B2.1 `alt-svc` anuncia `h3` — **REPROVOU**

```
$ curl -sI https://fiapspeedx.vercel.app/ | grep -iE '^(HTTP|alt-svc)'
HTTP/1.1 200 OK
```

O `curl` local não fala HTTP/2, então repeti com o cliente `http2` do Node (`ALPN h2`, `GET /`), escutando também o quadro ALTSVC:

```
ALPN h2
:status: 200
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-security-policy: frame-ancestors 'none'
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
server: Vercel
strict-transport-security: max-age=15552000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
x-vercel-cache: MISS
x-vercel-id: gru1::gru1::hm5tq-1792268947555-1685522d499b
(nenhum quadro ALTSVC recebido)
```

Esperado: `alt-svc: h3=":443"…`. O risco já está escrito como R-1 em `checklist-pre-evento.md`, mas sem assinatura. O checklist de `deploy.md` §8 aceita qualquer das duas coisas: o h3 ou o risco assinado. Hoje não há nenhuma.

### B2.2 `/api/classificacao` com `HIT` na segunda chamada em 15 s — **PASSOU**

```
20:27:06  HTTP/1.1 200 OK  Age: 0  Cache-Control: public  X-Vercel-Cache: MISS
20:27:08  HTTP/1.1 200 OK  Age: 3  Cache-Control: public  X-Vercel-Cache: HIT
20:27:11  HTTP/1.1 200 OK  Age: 5  Cache-Control: public  X-Vercel-Cache: HIT
```

(A Vercel consome o `s-maxage` na borda e entrega só `public` ao cliente.) Brotli também foi conferido: `Content-Encoding: br`.

### B2.3 `no-store` em painel, exportação, métricas e saúde — **PASSOU**, com uma observação

```
/api/painel/fila                   401  Cache-Control: no-store
/api/painel/participante           401  Cache-Control: no-store
/api/painel/sessao                 401  Cache-Control: no-store
/api/painel/tempo            (GET) 405  Cache-Control: no-store
/api/painel/tentativa        (GET) 405  Cache-Control: public, max-age=0, must-revalidate
/api/painel/ausencia         (GET) 405  Cache-Control: public, max-age=0, must-revalidate
/api/painel/tentativa/1/historico  401  Cache-Control: no-store
/api/exportacao                    401  Cache-Control: no-store
/api/metricas                      401  Cache-Control: no-store
/api/saude                         200  Cache-Control: no-store, no-cache, must-revalidate

POST /api/painel/tempo       401  Cache-Control: no-store
POST /api/painel/tentativa   401  Cache-Control: no-store
POST /api/painel/ausencia    401  Cache-Control: no-store
```

Todo método que a rota de fato implementa responde `no-store`. As duas linhas de 405 são a observação de §1.

### B2.4 HSTS presente e HTTP redirecionando para HTTPS — **PASSOU**

```
Strict-Transport-Security: max-age=15552000; includeSubDomains
$ curl -sI http://fiapspeedx.vercel.app/
HTTP/1.0 308 Permanent Redirect
Location: https://fiapspeedx.vercel.app/
```

### B2.5 `instante` de `/api/saude` contra relógio de referência (2 s) — **PASSOU**

Primeiro, o relógio desta máquina contra o NTP.br, porque o relógio local não é a referência:

```
w32tm /stripchart /computer:a.st1.ntp.br   →  +01.1606s  +01.1589s  +01.1606s
w32tm /stripchart /computer:pool.ntp.org   →  +01.1619s  +01.1621s  +01.1612s
```

Depois, o servidor contra o relógio local, no ponto médio de cada requisição:

```
status 200 rtt 273 ms  servidor-local 1.270 s
status 200 rtt  40 ms  servidor-local 1.168 s
status 200 rtt  34 ms  servidor-local 1.167 s
status 200 rtt  36 ms  servidor-local 1.167 s
status 200 rtt  49 ms  servidor-local 1.171 s
```

Servidor − NTP.br ≈ 1,167 − 1,160 = **+0,007 s**. A tolerância é de 2 s.

### B2.6 Variáveis do limite de taxa na Vercel — **NÃO VERIFICÁVEL DAQUI** (N1), com uma correção ao PRD

`which vercel` → `command not found`, e não existe `.vercel/` no projeto. Sem acesso ao ambiente, o veredicto não pode ser PASSOU por dedução a partir do padrão do código.

**Correção:** o PRD diz que "D-90 calibrou para 300 e 1200". Não calibrou. D-90 (CONTEXT.md) e `src/shared/env.ts:115,121` dizem **800 e 2400**, e 300 era a proposta que D-90 rejeitou. Os números 300/1200 vêm de `docs/o-que-falta-para-voce.md` §3, que nunca foi atualizado — é o achado R4.

### B2.7 `DATABASE_URL` de produção é a do pooler — **PASSOU** pelo comportamento (o texto literal é N2)

O projeto Neon tem um único endpoint (`ep-wandering-art-aclcb151`). Seis requisições à produção, e logo em seguida, em `pg_stat_activity`, todas as conexões do papel da aplicação:

```
200 200 200 200 200 200     (20:31:34Z)
pid 808  neondb_owner  application_name=pgbouncer  client_addr=127.0.0.1
         backend_start 2026-10-17T20:26:39.808Z   agora 20:31:37.390Z
```

Essa conexão nasceu 0,15 s depois do `instante` da batida fria do ciclo 3 (20:26:39.658Z), quando nada além da produção tocava o banco. Uma conexão direta da função apareceria como outro backend, não `pgbouncer`, e o pool do `pg` a manteria aberta por segundos. Não havia nenhuma.

### B2.8 `npm run auditar` contra o publicado — **PASSOU**, sobre base vazia

```
Auditando https://fiapspeedx.vercel.app
Documento público: 0 linhas, 0 nomes distintos.
[  ok ] RNF-08 — corpo público          0 KB, campos: geradoEm, linhas, total
[  ok ] RNF-10 — rotas protegidas       9 rotas responderam 401 sem cookie
[aviso] RNF-09 — sobrenome de menor     nenhuma Tentativa válida na base
Nenhum vazamento encontrado.
EXIT=0
```

RNF-08 e RNF-10 passaram contra o ambiente real. RNF-09 não teve dado para verificar (N10).

### B2.9 Estado do banco de produção (leitura apenas) — informativo

```
branches: 1  → "production" (primary, default)   — não existe homologação (R9)
drizzle.__drizzle_migrations: 5   — as 5 migrações do repositório (0000–0004) aplicadas
participantes 1 · tentativas 1 · operadores 1 · primeiro/último cadastro 2026-09-03 23:29:30Z
.env local: DATABASE_URL → ep-wandering-art-aclcb151-pooler…  (o mesmo endpoint da produção)
```

---

## 5. Bloco 3 — O cold start do banco (D-91)

### B3.1 Reprodução, três ciclos — **REPROVOU: 3 de 3 batidas frias falharam**

Script em segundo plano. Antes de cada ciclo, 390 s (6,5 min) sem nenhuma requisição ao site ou ao banco. Depois, três chamadas a `/api/saude`: a fria, a seguinte e uma +3 s.

```
== ciclo 1: ocioso desde 20:06:53Z, aguardando 390 s
20:13:23.296Z  fria      HTTP 503 2.061519s  {"situacao":"degradado","versao":"c596953","banco":{"alcancavel":false}}
20:13:25.520Z  seguinte  HTTP 200 0.590300s  {"situacao":"ok",…,"banco":{"alcancavel":true,"latenciaMs":494}}
20:13:29.366Z  +3s       HTTP 200 0.112318s  {"situacao":"ok",…,"banco":{"alcancavel":true,"latenciaMs":3}}
== ciclo 2: ocioso desde 20:13:29Z, aguardando 390 s
20:19:59.737Z  fria      HTTP 503 1.900235s  {"situacao":"degradado",…,"banco":{"alcancavel":false}}
20:20:01.780Z  seguinte  HTTP 503 1.089417s  {"situacao":"degradado",…,"banco":{"alcancavel":false}}
20:20:06.074Z  +3s       HTTP 200 0.132752s  {"situacao":"ok",…,"banco":{"alcancavel":true,"latenciaMs":27}}
== ciclo 3: ocioso desde 20:20:06Z, aguardando 390 s
20:26:36.523Z  fria      HTTP 503 1.908839s  {"situacao":"degradado",…,"banco":{"alcancavel":false}}
20:26:38.621Z  seguinte  HTTP 200 0.126735s  {"situacao":"ok",…,"banco":{"alcancavel":true,"latenciaMs":33}}
20:26:41.979Z  +3s       HTTP 200 0.102552s  {"situacao":"ok",…,"banco":{"alcancavel":true,"latenciaMs":3}}
```

|                                              | falhas    |
| -------------------------------------------- | --------- |
| batida fria                                  | **3 / 3** |
| chamada imediatamente seguinte (~2 s depois) | **1 / 3** |
| +3 s                                         | 0 / 3     |

Esperado, para um sistema pronto: 0 / 3. O registro do Neon confirma que cada batida fria acordou o banco de fato, e que ele dormiu de novo entre os ciclos:

```
start_compute    20:13:25Z (1267 ms)   ← ciclo 1
suspend_compute  20:18:46Z
start_compute    20:20:01Z (1774 ms)   ← ciclo 2
suspend_compute  20:25:16Z
start_compute    20:26:38Z  (544 ms)   ← ciclo 3
```

Os 3 de 3 de hoje somam-se aos 2 de 2 que D-91 mediu em 03/09. **Não é sorte: é o padrão.** A falha é de 2 s, e não um tempo de espera longo. O teto de 1 s da sondagem (`src/infra/saude.ts`) devolve `503` antes de o banco acordar. Isso explica `/api/saude`. **Não medi o que o participante vê** numa página que lê o banco (`/classificacao`, `/api/inscricao`) quando é ela a batida fria. O autor do PRD viu `/classificacao` responder normalmente, mas como segunda chamada.

### B3.2 O disparador de aquecimento existe? — **REPROVOU: não existe, em intervalo nenhum**

`mcp__Neon__list_operations`, mesmo endpoint, hoje:

```
start_compute    2026-10-17T13:12:04Z
suspend_compute  2026-10-17T13:17:31Z
                 … 6 h 32 min sem nenhuma operação …
start_compute    2026-10-17T19:49:53Z   ← o teste manual do autor do PRD
suspend_compute  2026-10-17T19:57:01Z
start_compute    2026-10-17T20:13:25Z   ← meu ciclo 1
```

Um disparador de 1 a 3 minutos, ou mesmo um monitor de 5 minutos, apareceria como banco nunca suspenso ou como suspende/acorda a cada poucos minutos. O que aparece é o banco dormindo seis horas e meia. **Nenhum disparador nem monitor chama `/api/saude` hoje.** Os ciclos de B3.1 confirmam: 6,5 minutos sem nada acordar o banco, três vezes seguidas.

Neste relatório, **este é o item mais importante**: os itens 3.19 e 3.20 do checklist estão em aberto, a sete dias do evento.

As duas saídas já estão registradas em D-91. Nenhuma das duas é minha para executar:

- **Conviver:** `cron-job.org` (gratuito, de minuto em minuto) contra `GET /api/saude`, a partir de pelo menos uma hora antes da abertura da fila. Depois, **repetir B3.1**: com o disparador ativo, a batida fria deve sumir.
- **Corrigir:** um mês de plano pago do Neon, com scale-to-zero desligado.

Detalhe para quem configurar: o projeto mostra `suspend_timeout_seconds: 0`, que no plano `free_v3` significa o padrão da plataforma. Os ciclos medidos suspenderam entre 5 min 10 s e 5 min 16 s depois da última atividade (`20:13:30 → 20:18:46`, `20:20:06 → 20:25:16`). Três minutos de intervalo deixam folga, cinco não.

---

## 6. Bloco 4 — O que não dá para verificar daqui

### B4.1 `npm run perf:rede` de novo — **REPROVOU** (RNF-04 em 3G lento), pior que antes

Local (`next start`, mesmas condições da medição de D-102):

```
rota             perfil        primeira pintura   tudo carregado
/                3G lento      4.77s              7.52s  FALHOU
/                3G rápido     1.61s              2.37s
/                4G lento      0.75s              1.47s
/classificacao   3G lento      4.67s              7.48s  FALHOU
/classificacao   3G rápido     1.48s              2.36s
/classificacao   4G lento      0.64s              1.51s
EXIT=1
```

Contra a publicação (`PERF_ALVO=https://fiapspeedx.vercel.app`), com o TTFB real de `gru1`:

```
/                3G lento      4.98s              7.53s  FALHOU
/                3G rápido     1.63s              2.90s
/                4G lento      0.77s              1.59s
/classificacao   3G lento      4.79s              7.51s  FALHOU
/classificacao   3G rápido     1.54s              2.85s
/classificacao   4G lento      0.71s              1.66s
EXIT=1
```

| `/`, primeira pintura | D-102 (14/10) | hoje, local | hoje, publicado |
| --------------------- | ------------- | ----------- | --------------- |
| 3G lento              | 4,6 s         | 4,77 s      | **4,98 s**      |
| 3G rápido             | 1,5 s         | 1,61 s      | 1,63 s          |

O número anterior se confirma na ordem de grandeza. Hoje está **um pouco pior** (+0,2 s local, +0,4 s publicado). Isso é emulação: o ensaio 7 com rede real continua sendo o que decide (N8). A decisão aberta em D-102, `experimental.inlineCss` (2,2 s medidos em 3G lento contra um estouro de 0,1 KB no orçamento do termo), continua sendo a alavanca conhecida.

### B4.2 A lista que depende de gente e aparelho — **NÃO VERIFICÁVEL DAQUI**

Está inteira em §2 (N4 a N8), sem tentativa de contorno.

---

## 7. A decisão do domínio — **PENDENTE DO ORGANIZADOR**

Não registrei domínio, não comprei nada e não alterei `APP_URL`. A decisão continua aberta, e **deixá-la aberta é a pior das três saídas**: sem ela não sai material impresso, e o material impresso é a contingência para quando a internet cair.

| saída                                                  | o que exige                                                                                | consequência                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **A. Registrar domínio hoje**                          | registro, apontar na Vercel, propagar, `npm run qr`, `npm run fichas`, imprimir            | QR melhor, mas aperta a gráfica em 7 dias      |
| **B. Assumir `fiapspeedx.vercel.app` como definitivo** | `APP_URL=https://fiapspeedx.vercel.app npm run qr`, `npm run fichas` hoje, imprimir amanhã | QR mais denso, mas material impresso garantido |

Dois fatos verificados hoje, que valem para qualquer das duas:

1. **O QR que está no repositório não serve para nenhuma delas.** `docs/qr/inscricao.svg` diz `<title>Inscrição SpeedX — https://speedx.exemplo.br</title>` e `<desc>Gerado em 2026-08-21</desc>`. Em qualquer saída, `npm run qr` tem de rodar antes da gráfica.
2. **O `.env` local tem `APP_URL="http://localhost:3000"`.** Rodar `npm run qr` sem passar a `APP_URL` gera um QR para `localhost`. O script avisa que é provisório, mas gera do mesmo jeito.

Quem decide: o organizador. Prazo real: o da gráfica, que vem antes de 24/10.

---

## 8. O que esta verificação tocou

- **Produção, só leitura:** requisições `GET`/`HEAD` às rotas públicas e de saúde, `POST` vazio sem sessão a três rotas do painel (todos `401`), `npm run auditar` (só `select`), `npm run orcamento` e `npm run perf:rede` contra a URL publicada, e no Neon só operações de leitura (`list_*`, `describe_*`, `select` em `pg_stat_activity`, `pg_stat_user_tables` e contagens). As batidas frias acordaram o banco três vezes, o que era o objetivo.
- **Nenhum teste alterado**, nenhuma variável da Vercel ou configuração do Neon tocada, nenhum `expurgar`, nenhum `db:migrate`, nenhum e2e contra o banco de produção.
- **Arquivos alterados no repositório:** este relatório; `README.md` (contagem de testes da linha de T17); `CONTEXT.md` (D-103).
- **O que ficou como estava, de propósito:** `PRD.md` (R8, é seu), `docs/o-que-falta-para-voce.md` (R4), `docs/testes.md` (636 testes), `next` (R6). Corrigir é decisão de quem lê este relatório.
