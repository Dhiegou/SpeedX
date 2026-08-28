# A suíte de testes

Como o PRD vira teste executável, o que cada camada cobre e o que só se verifica
com gente (T17).

**O PRD já escreveu esta suíte.** Cada RF e RNF traz a linha _Verificação_; a
T17 é a tradução literal disso, mais um mecanismo que percebe quando a tradução
deixa de existir.

---

## 1. As camadas

| Camada        | Ferramenta      | Onde                 | Cobre                                                                |
| ------------- | --------------- | -------------------- | -------------------------------------------------------------------- |
| Unidade       | Vitest          | `src/**/*.test.ts`   | domínio puro: idades, tempo, nome público, termo, log, métricas      |
| Integração    | Vitest + PGlite | `tests/**/*.test.ts` | endpoints, transações, constraints, concorrência, idempotência       |
| Ponta a ponta | Playwright      | `e2e/**/*.spec.ts`   | o que só existe num navegador: teclado, confirmação, largura de tela |

```
npm run test          # unidade e integração
npm run test:watch    # o mesmo, contínuo
npm run test:e2e      # ponta a ponta (precisa de Postgres de pé)
npm run test:e2e:ui   # o mesmo, com o inspetor do Playwright
```

**Medido:** 609 testes de unidade e integração em ~100 s. O critério de T17 é
dez minutos; a folga existe para que ninguém aprenda a pular a suíte.

---

## 2. Banco de teste real, e não mock

Os testes de integração rodam contra **PGlite** — o Postgres compilado para
WebAssembly —, com as mesmas migrações que vão para produção.

A razão é o princípio de D-05: as invariantes mais caras deste sistema moram em
constraints do banco. Um Participante com idade 12, uma Tentativa Válida sem
tempo, dois tempos no mesmo Cockpit — nada disso é recusado por código de
aplicação, e sim pelo motor. Testar contra mock verificaria a existência do
mock.

**Limite conhecido:** PGlite não serve para medir desempenho. É outro processo,
sem disco próprio, e o plano de execução dele não é o do Postgres de verdade
(D-52). Número de desempenho sai do banco real, em T18.

---

## 3. Os testes de ponta a ponta

Existem para três requisitos que **só** um navegador responde:

- **RF-18** — nenhuma gravação sem a etapa de confirmação;
- **RF-19** — cinco lançamentos consecutivos apenas com teclado;
- **RNF-18** — 360 px sem rolagem horizontal.

O resto da suíte cobre domínio, endpoint e banco muito mais rápido, e por isso o
e2e é curto de propósito. Uma suíte de ponta a ponta que demora é uma suíte que
se aprende a pular.

### Como RF-19 é de fato verificado

A forma preguiçosa seria não chamar `click()` e confiar. Em vez disso, um script
injetado antes da página carregar conta os eventos de ponteiro; ao fim dos cinco
lançamentos o teste exige **zero**. Um `click()` distraído acrescentado daqui a
seis meses cai nessa contagem.

**`click` não entra na conta, e a distinção custou uma execução para aparecer.**
A primeira versão contava `click` junto e acusou seis eventos numa execução em
que o mouse não foi tocado: `Enter` num botão focado **ativa** o botão, e o
navegador emite um `click` com `isTrusted` verdadeiro. `click` não é evento de
mouse — é evento de ativação, e o teclado o dispara por desenho. Contá-lo
tornaria RF-19 impossível de passar justamente operando por teclado.

O que denuncia o ponteiro são `pointerdown`, `mousedown` e `mouseup`, que só
existem quando há um ponteiro — mais um `click` com `detail` maior que zero,
porque ativação por teclado traz `detail` zero.

### O banco do e2e

**Banco próprio, `speedx_e2e`, recriado do zero a cada execução.** O e2e apaga e
reescreve tudo: apontá-lo para o banco de desenvolvimento faria a massa de 2000
que T18 vai medir sumir na primeira execução distraída.

O nome sai da própria `DATABASE_URL`, com o banco trocado — herda host, porta e
credencial sem uma segunda variável para alguém esquecer de configurar.

**Um privilégio a conceder, uma vez.** O papel da aplicação pode criar tabela e
esquema, não banco — e é assim que deve ser, porque é o mesmo papel que vai para
produção. Numa máquina nova:

```
psql -U postgres -c 'alter role "speedx" createdb'
```

A partir daí a suíte se vira sozinha. No CI o serviço de Postgres já sobe com
superusuário, e nada disso é necessário.

> **Tentativa descartada, registrada para não se repetir:** isolar por _esquema_
> com `search_path`, o que dispensaria o privilégio. Não funciona — o SQL gerado
> pelo drizzle-kit é qualificado com `public`, então as migrações ignoram o
> `search_path`. Reescrever o SQL em tempo de execução resolveria e trocaria a
> coisa que mais importa aqui, que é exercitar as migrações exatas de produção.

---

## 4. Rastreabilidade: o teste que vigia os outros

`tests/rastreabilidade.test.ts` lê o `PRD.md`, extrai os 53 códigos de requisito
e varre os **nomes** de todos os testes — inclusive os de ponta a ponta —
procurando cada um.

Ele falha quando um requisito não é citado por nenhum teste nem consta do
registro de verificação manual com justificativa escrita.

Três detalhes que o tornam útil em vez de decorativo:

- **Conta o nome do teste, não o arquivo.** Um comentário citando RF-22 faria o
  requisito parecer coberto sem nenhuma asserção. O que vale é o título que
  aparece no relatório quando o teste falha — porque é ele que diz a quem está
  consertando **qual promessa do produto** acabou de quebrar.
- **Uma justificativa manual não sobrevive à automação.** Assim que alguém
  escreve um teste citando o código, o registro tem de perder a linha. Sem isso
  o registro vira depósito de dispensas, e a auditoria de T21 leria "verificado
  à mão" sobre algo que a suíte já verifica em três segundos.
- **Justificativa curta é recusada.** Menos de 80 caracteres não explica nada.

---

## 4.1. Os testes que vigiam a infraestrutura

`tests/deploy.test.ts` (T19) cobre três promessas de ambiente que **quebram
caladas**, e é o único arquivo da suíte que lê código-fonte em vez de executá-lo:

- **Cache.** Nenhuma rota fora da Classificação pode ser cacheável, e toda rota
  precisa de `no-store` — próprio ou herdado de `app/api/painel/_apoio.ts`.
  Porque aceita a herança, o teste verifica também o elo: se `SEM_CACHE` virar
  outra coisa, seis rotas mudam de comportamento sem mencionar cache.
- **Relógio.** Nenhum esquema Zod de entrada aceita data, toda coluna de instante
  é `withTimezone: true`, nenhuma rota repassa `agora`. **Um teste de
  comportamento não pegaria isto:** com um campo `dataHora` na API o
  comportamento continua o mesmo — o que muda é de quem é o relógio que decide o
  desempate de RF-31.
- **Região.** `vercel.json` e `docs/deploy.md` têm de continuar concordando.
  A escolha de `gru1` só faz sentido colada à do banco (D-79).

O resto de T19 — HTTP/3, `HIT` de borda, sincronia de relógio, restauração de
backup — não é verificável daqui e mora no checklist de
[`deploy.md`](deploy.md) §8, com o comando ao lado de cada linha.

---

## 5. O que não se verifica por código

Cinco requisitos, todos no checklist de T21. As justificativas por extenso estão
em `tests/rastreabilidade.test.ts`, onde o teste as obriga a existir.

| Requisito | Por que é manual                                                                                                                                             | Onde fecha |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| RNF-04    | Carga em 3G com limitação de rede real. A conta de T13 mostrou que o critério não fecha nem com página vazia; precisa ser reescrito contra um perfil nomeado | T18, T21   |
| RNF-05    | "Monitoramento contínuo no dia" — disponibilidade durante a janela só se observa no evento; o monitor externo depende de PE-05                               | T19, T21   |
| RNF-06    | Contingência offline com material impresso: é o escopo de T20, e a verificação é o ensaio com papel                                                          | T20, T21   |
| RNF-15    | Cronometrar cinco pessoas em cada perfil                                                                                                                     | T21        |

**Dois saíram desta lista em T17**, e valem como exemplo do que a automação
alcança:

- **RNF-18** era "depende de aparelho". Não dependia: 360 px é uma largura, e um
  navegador sabe ser 360 px. O que depende de aparelho é o toque, a rede e a
  leitura sob sol — esses continuam em T21.
- **RF-01 e RF-09** estavam prestes a entrar como manuais. A parte automatizável
  de cada um já tinha teste (`entrada.test.ts`, `qr.test.ts`,
  `consentimento.test.ts`); o resíduo é escanear com três leitores e a
  assinatura do organizador, que são itens de checklist, não ausência de teste.
  Foi o próprio teste de rastreabilidade que recusou as justificativas.

---

## 6. O teste de vazamento

O caso que a T17 nomeia em separado, e o único que roda nas duas pontas:

- em integração, sobre a resposta de `/api/classificacao` (`classificacao.test.ts`);
- em ponta a ponta, sobre o **HTML inteiro** da página (`e2e/classificacao.spec.ts`).

A segunda existe porque RNF-08 e RNF-09 não são propriedades de uma função — são
propriedades de tudo o que chega ao navegador, incluindo o estado que o React
embute na página para hidratar a tabela sem uma segunda ida ao servidor. Um teste
de unidade sobre `paraNomePublico` prova que a função abrevia; não prova que
ninguém pôs o telefone num atributo `data-` três meses depois.

A massa de ensaio tem uma menor de idade e uma adulta classificada de propósito.
O teste exige que o sobrenome completo da menor **não** apareça e que o da adulta
**apareça** — sem esse contraponto, uma página que não carregasse passaria em
todas as ausências.

---

## 7. Regras da suíte

- **Nomeie o teste pelo requisito.** `RF-07 — idade corrigida descarta
responsável`. O teste de rastreabilidade depende disso, e quem lê uma falha no
  CI descobre em um segundo qual promessa quebrou.
- **Massa determinística.** O seed tem semente fixa, com homônimos e acentos de
  propósito. A massa do e2e tem nomes inventados e distintos — um teste que busca
  "Ana" e encontra três falha na terça e passa na quarta.
- **Concorrência com requisições genuinamente paralelas.** `Promise.all` sobre
  duas chamadas, não duas chamadas em sequência: a janela entre o SELECT e o
  INSERT só aparece quando as duas correm juntas (D-05).
- **A suíte roda em CI a cada pull request** e bloqueia o merge. O e2e é um job
  separado, com Postgres 18 de verdade como serviço.
