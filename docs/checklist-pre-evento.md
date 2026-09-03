# Checklist pré-evento — 24 de outubro de 2026

Última porta antes do evento (T21, RNF-08 a RNF-10, SDD §6).

**Auditoria de privacidade executada em 2026-08-28**, por leitura do código e
por verificação contra a base de 2000 Participantes e 4000 Tentativas. O
resultado da Parte 1 está abaixo, com evidência item a item.

**As Partes 2 e 3 não fecham hoje**, e não por falta de trabalho: elas dependem
de um endereço publicado, de contas contratadas e de gente reunida numa sala.
Cada item pendente traz **quem resolve** e **quando falha se ninguém resolver**.

|                     |                                       |
| ------------------- | ------------------------------------- |
| Responsável técnico | _________________ (assinar ao fechar) |
| Data desta rodada   | 2026-08-28                            |
| Data do evento      | 24/10/2026 · **57 dias**              |
| Commit auditado     | `247dea6` + trabalho de T21           |

---

## Parte 1 — Auditoria de privacidade · **fechada**

Método: leitura do código produzido (restrição 1 do anexo do PRD), mais
verificação executada contra o banco real.

### 1.1 Superfícies públicas

**Três rotas respondem sem sessão**, e cada uma por um requisito:

| rota                     | por quê                                | o que sai                                                                   |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/classificacao` | RF-26 — a tabela é pública             | `{geradoEm, total, linhas}`; cada linha é `[nomePublico, cockpit, tempoMs]` |
| `POST /api/inscricao`    | RF-01 — quem se inscreve não tem conta | eco do próprio cadastro, sem dado de terceiro                               |
| `GET /api/saude`         | T16 — monitor externo não autentica    | `{situacao, versao, instante, banco:{alcancavel, latenciaMs}}`              |

`POST /api/painel/sessao` é o login: a guarda dele é a senha. Está nomeado como
exceção, não esquecido.

**Evidência:** `tests/auditoria.test.ts` falha se aparecer uma quarta rota sem
guarda — o conjunto é fechado por lista, e uma rota nova exige editar o teste.

### 1.2 `LinhaClassificacao` não ganhou campo pessoal

`src/contexts/classificacao/modelo.ts` tem `id`, `nomePublico`, `cockpit`,
`tempoMs`, `registradoEm`. Nenhum e-mail, telefone, idade ou Responsável — e o
`sobrenome` **não é campo do modelo**: chega já resolvido da projeção.

O que atravessa a rede é ainda menor: `id` e `registradoEm` ficam de fora do
documento transmitido (T12). O `registradoEm` sairia publicando o instante exato
em que uma pessoa nomeada esteve num lugar — para menores de 18, é a exposição
que RNF-09 existe para evitar, por outra porta.

**Evidência:** teste que exige a linha com **exatamente três posições**.

### 1.3 `paraNomePublico` é o único ponto que toca sobrenome

Uma única chamada em produção: `classificacao/projecao.ts:78`. A consulta lê
`participante.sobrenome` (linha 52) e o valor entra direto na função. Nenhum
outro módulo do caminho público recebe sobrenome completo.

**Sobre a inferência aceita em D-21:** o formato abreviado **sinaliza que a
pessoa tem menos de 18 anos**. Isso continua verdadeiro e continua aceito — a
alternativa seria abreviar o sobrenome de todo mundo, o que estraga a
distinção entre homônimos, que é o serviço que a página presta. O que a
abreviação protege é o sobrenome; a faixa etária aproximada é o preço, e ele
está declarado no termo que a pessoa aceita.

### 1.4 Nenhum campo pessoal no corpo público · **verificado contra a base**

```
npm run auditar            # ou: npm run auditar -- https://<dominio>
```

Resultado de 2026-08-28, contra 2000 Participantes / 3254 linhas públicas:

```
[  ok ] RNF-08 — corpo público
         83 KB, campos: geradoEm, linhas, total
[  ok ] RNF-10 — rotas protegidas
         9 rotas responderam 401 sem cookie
[  ok ] RNF-09 — sobrenome de menor
         261 Tentativas de menores publicadas com sobrenome abreviado;
         428 nomes distintos conferidos por contagem, nenhum a mais nem a menos
```

**A verificação de RNF-09 é por contagem, e a primeira versão dela era inútil.**
Perguntar "o nome completo do menor aparece no corpo?" exige a ressalva "a não
ser que exista um adulto homônimo" — e contra a massa real a ressalva dispensou
**151 de 151** menores, porque vinte nomes e vinte sobrenomes em duas mil
pessoas colidem sempre. O script dizia "ok" sem ter verificado nada.

Contagem não tem esse buraco: para cada nome, as ocorrências publicadas têm de
bater com as Tentativas Válidas de quem tem aquele nome, separando adultos de
menores. **Confirmado que o script morde:** com a abreviação desligada de
propósito, ele acusa `"Pedro R.": esperadas 2, publicadas 0` e sai com código 1.

### 1.5 Nenhuma consulta parte do navegador · **verificado no pacote publicado**

Varredura do bundle do cliente (`.next/static/`) por `postgresql://`,
`postgres://`, `DATABASE_URL`, `SESSION_SECRET`, `drizzle`, `node-postgres` e
pelo segredo real usado no build: **zero ocorrências em todos**.

A barreira que produz isso não é disciplina: `no-restricted-imports` recusa
`@/db` sob `app/**`, e `tests/fronteiras.test.ts` roda o ESLint para conferir
que a regra continua valendo.

### 1.6 Dado completo exige sessão (RNF-10) · **verificado por requisição**

Nove rotas chamadas sem cookie, todas `401`, com corpo que não vaza nada:

```
{"erro":{"codigo":"nao_autenticado","mensagem":"Faça login para usar o painel."}}
```

Cobertas: as três exportações, `/api/metricas`, fila, busca de participante e as
três de escrita do painel.

### 1.7 Log e telemetria sem dado pessoal · **verificado em tráfego real**

O log do teste de carga de T18 — **141.463 linhas**, geradas por 200 cadastros
com e-mail e telefone de verdade no corpo das requisições:

| busca                              | ocorrências |
| ---------------------------------- | ----------- |
| e-mail                             | **0**       |
| dez ou mais dígitos seguidos       | **0**       |
| o prefixo de e-mail usado no teste | **0**       |

Campos emitidos, e nenhum outro: `evento`, `resultado`, `motivo`, `referencia`,
`duracaoMs`, `preenchimentoMs`, `campos`, `status`, `instante`.

A forma de `EntradaDeLog` é fechada e o saneamento remove e-mail e sequência de
dígitos preservando UUID — um defeito que T08 já tinha encontrado e consertado.

### 1.8 Cruzamento pessoal × resultado · **achado: o SDD estava mais forte que o código**

O SDD §BC-05 dizia que a Custódia é o único contexto autorizado a "reunir dados
pessoais de Inscrição com resultados de Cronometragem no mesmo documento". **Ao
pé da letra, o painel violava isso**: a busca de RF-16 devolve nome, sobrenome e
os quatro últimos dígitos do telefone junto com as Tentativas da pessoa, tempo
incluído. E precisa devolver — é assim que o Operador distingue dois homônimos
antes de lançar.

**A invariante que de fato vale é mais estreita, e o código sempre a respeitou:**
fora da Custódia ninguém lê e-mail, idade nem dados de Responsável, e o telefone
é reduzido a quatro dígitos **no banco** (`right(telefone, 4)`), de modo que o
número inteiro não chega a trafegar até a aplicação.

**Ação tomada:** a frase do SDD foi corrigida e a invariante virou teste
(D-88). Não houve mudança de comportamento — houve mudança de documento, que
estava descrevendo um sistema mais restrito do que o que existe.

### 1.9 Teste de vazamento contra massa realista

Rodado nas duas pontas: sobre a resposta de `/api/classificacao` na suíte de
integração, e sobre o **HTML inteiro** da página no e2e, que é onde o estado de
hidratação do React apareceria. Mais o `npm run auditar` de 1.4, contra 2000
pessoas.

**Pendente:** repetir contra o ambiente publicado, com dado real, na véspera.

---

## Parte 2 — Checklist do SDD §6

| #   | item                                                   | situação                                    | evidência / quem resolve                                                                                                                                                                                     |
| --- | ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | HTTP/3 anunciado                                       | **pendente**                                | Depende do domínio. Comando em `deploy.md` §4. Se falhar, FL-02 e FL-07 caem para TCP e o risco é aceito por escrito aqui                                                                                    |
| 2.2 | Idempotência de FL-03 e FL-06 sob reenvio              | **fechado**                                 | 8 testes: reenvio devolve 200 e não 201, mesma chave com outro tempo é 409, mesma chave por outro Operador é 409. Exercitada sob concorrência em T18                                                         |
| 2.3 | Relógio do servidor, e o instante do Lançamento é dele | **fechado no código, pendente no ambiente** | Nenhum esquema de entrada aceita data; toda coluna de instante é `withTimezone`; nenhuma rota repassa `agora` — `tests/deploy.test.ts`. Falta conferir a sincronia contra `/api/saude` no ambiente publicado |
| 2.4 | Carga de FL-07 com 500 concorrentes                    | **fechado com ressalva**                    | `docs/relatorio-carga.md`: 200 req/s, p95 7,9 ms, zero 5xx em 101.917 leituras. Ressalva: sem borda e numa máquina só                                                                                        |
| 2.5 | Termo oficial **Cockpit**                              | **fechado**                                 | D-75 e T22. Conferido na leitura final: nenhuma tela escreve a palavra à mão — a única ocorrência visível vem de `nomeDoCockpit()`, que lê a constante                                                       |
| 2.6 | Ausência de campo pessoal em resposta pública          | **fechado**                                 | Parte 1                                                                                                                                                                                                      |

---

## Parte 3 — Prontidão operacional

### O que já está pronto

| item                                       | evidência                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Termo aprovado por escrito                 | `v1.0-2026-08-19`, registro em `docs/aprovacao-termo.md`. Sob rascunho o cadastro é impossível por construção |
| Prazo de retenção acordado e datado        | `docs/retencao.md`: vence em **04/11/2026, 00:00** em São Paulo                                               |
| Material de contingência gerado            | `npm run fichas` — ficha, termo impresso e folha de tempos, do mesmo termo que a tela (T20)                   |
| Relatório de pendências para o organizador | `GET /api/exportacao?tipo=pendencias` (T14), com sessão                                                       |
| Plano de resposta do dia                   | `docs/plano-do-dia.md`, uma página, para imprimir                                                             |

### O que falta, com dono e consequência

| #    | item                                                                                  | quem                       | se ninguém fizer                                                                                                             |
| ---- | ------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | **O domínio**                                                                         | organizador + time técnico | O QR de T07 fica provisório e **o material impresso precisa ser refeito**, não corrigido. É o item de maior prazo do projeto |
| 3.2  | Criar Vercel, Neon e UptimeRobot; publicar                                            | time técnico               | Não há evento                                                                                                                |
| 3.3  | Contas de Operador criadas e testadas por quem vai operar                             | time técnico               | Operador descobre a senha errada com a fila formada                                                                          |
| 3.4  | Sessão testada pela janela inteira                                                    | time técnico               | 16 h configuradas; sem ensaio, o risco é deslogar no meio do dia                                                             |
| 3.5  | Monitor apontado e **disparo testado**                                                | time técnico               | Alerta que ninguém viu chegar é alerta que não existe                                                                        |
| 3.6  | Snapshot manual do banco antes da primeira inscrição                                  | time técnico               | Sem ponto de retorno se algo apagar dado no dia                                                                              |
| 3.7  | Restauração de backup testada em homologação                                          | time técnico               | Backup não testado não é backup                                                                                              |
| 3.8  | Deploys congelados no dia; reversão distribuída                                       | responsável técnico        | Publicação às pressas no único dia sem segunda chance                                                                        |
| 3.9  | QR impresso e testado com **três leitores**                                           | time do evento             | Resíduo de RF-01; a fila no ponto do QR é contraindicador do PRD §7                                                          |
| 3.10 | **Ensaio da contingência**: 5 fichas preenchidas, digitadas, conferidas               | time do evento             | Procedimento nunca ensaiado falha na hora                                                                                    |
| 3.11 | Ensaio do expurgo total contra banco real                                             | time técnico               | T15 deixou aberto para não apagar a massa de T18                                                                             |
| 3.12 | Quem executa o expurgo saber que **apagar o banco não tira o site do ar**             | responsável técnico        | O termo prometeu as duas coisas (`deploy.md` §6)                                                                             |
| 3.19 | **Disparador de 1 a 3 minutos** contra `/api/saude`, com confirmação antes de alertar | time técnico               | O banco suspende em 5 min e um monitor de 5 min empata com ele; sem isso o primeiro do dia leva 503 (D-91)                   |
| 3.20 | **Aquecer o banco antes de abrir a fila**, e depois de cada intervalo longo           | responsável técnico        | Uma linha no plano do dia; sem ela o cold start cai sobre o participante, não sobre nós                                      |

### Decisões que são do organizador, não do código

| #    | decisão                                                                                                                                                                                                                                                                                                                                       | prazo              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 3.13 | ~~**Calibrar o limite de taxa.**~~ — **resolvido em 2026-09-01 (T23, D-90).** T18 mediu 30 aceitos e **170 recusados** em 200 cadastros do mesmo IP; os padrões passaram a 800 por janela e 2400 por hora, calibrados pelo pior caso porque não há garantia de Wi-Fi no local. Falta só **definir as variáveis nos dois ambientes da Vercel** | feito              |
| 3.14 | **A métrica de uso da busca (PRD §7, ≥ 30%) não é mensurável** neste desenho: a busca roda no navegador e não gasta rede (D-69). Ou cai do PRD, ou alguém aceita telemetria de navegador na página mais pública do evento                                                                                                                     | antes do evento    |
| 3.15 | **Rastro de autoria na inclusão de Tentativa (RF-24).** Hoje não existe: se alguém for incluído no Cockpit errado, não há como saber quem incluiu. Custo: um valor no enum, ajuste de constraint e uma migração                                                                                                                               | antes de publicar  |
| 3.16 | **O termo ainda diz "pista"** (`v1.0-2026-08-19`, seções `dados` e `publicacao`). Texto aprovado por escrito; versão nova nasce rascunho e **impede cadastro** até nova aprovação (D-18)                                                                                                                                                      | decisão consciente |

### Verificações que exigem gente e aparelho

| #    | item                                                                                 | requisito   |
| ---- | ------------------------------------------------------------------------------------ | ----------- |
| 3.17 | Cronometrar um lançamento completo com o supervisor: alvo ≤ 15 s                     | RNF-16      |
| 3.18 | Cinco pessoas de cada perfil cronometradas no cadastro                               | RNF-15      |
| 3.19 | Carga em 3G real, cache vazio, em aparelho                                           | RNF-04      |
| 3.20 | Classificação em 360 px de largura real, com o sobrenome mais longo da base          | RNF-18      |
| 3.21 | Abrir as três exportações no Excel pt-BR, inclusive um nome começando por `=`        | RF-34, D-60 |
| 3.22 | Confirmar os atalhos do painel com o supervisor (`Alt+1`/`Alt+2`, `F2`, `F3`, `Esc`) | D-54        |
| 3.23 | Disponibilidade observada durante a janela do evento                                 | RNF-05      |

---

## Riscos abertos, para aceite por escrito

Cada linha precisa de uma assinatura antes do dia, ou de uma ação que a remova.

| #   | risco                                                                                                                      | mitigação no dia                                                                                                                                                                                                                                                                                                        | aceito por |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| R-1 | **HTTP/3 pode não estar anunciado** e FL-02/FL-07 caem para TCP, ameaçando RNF-04 em rede móvel congestionada              | A página de cadastro tem orçamento de peso verificado; o cache de borda protege a Classificação                                                                                                                                                                                                                         | ______     |
| R-2 | **O limite de taxa pode recusar a fila** se a premissa de chegada de D-90 errar — ela não foi confirmada com quem organiza | Os valores foram calibrados em T23 sobre a medição de T18, com folga para o pior caso, e o alerta `cadastro_limitado` avisa na primeira recusa. A alavanca `RATE_LIMIT_ATIVO=false` continua existindo para o caso de a calibração ter errado, mas ela **desliga** o limite em vez de calibrá-lo (`plano-do-dia.md` §3) | ______     |
| R-3 | **Desempate do período offline** fica por arbitragem manual, pelo horário escrito à mão na folha de tempos                 | Procedimento em `contingencia.md`; a coluna existe na folha                                                                                                                                                                                                                                                             | ______     |
| R-4 | **Sem rastro de autoria na inclusão** de Tentativa (3.15)                                                                  | A trilha de RF-23 cobre gravação e correção de Tempo, que é o que decide pódio                                                                                                                                                                                                                                          | ______     |
| R-5 | **A carga foi medida sem borda e numa máquina só** — o número que decide RNF-01 sai do ambiente publicado                  | O piso medido é confortável: 3,7 ms de consulta e p95 de 7,9 ms sem cache nenhum                                                                                                                                                                                                                                        | ______     |
| R-6 | **Nenhum dos ensaios físicos foi feito** (3.10, 3.17 a 3.22)                                                               | Todos cabem numa tarde; precisam de data marcada                                                                                                                                                                                                                                                                        | ______     |

---

## Assinatura

Esta rodada auditou o que é código e mediu o que tem banco. **Não autoriza o
evento**: as Partes 2 e 3 pedem um ambiente publicado e uma tarde de ensaios.

|                      |                                  |
| -------------------- | -------------------------------- |
| Auditoria da Parte 1 | 2026-08-28                       |
| Responsável técnico  | _________________                |
| Próxima rodada       | quando existir domínio publicado |
