# Deploy e infraestrutura

Onde este sistema roda, o que precisa ser verdade no ambiente para o código
funcionar, e como conferir cada uma dessas coisas (T19, RNF-01, RNF-04, RNF-05,
RF-23, RF-31).

**O que separa este documento do resto:** quase tudo aqui é uma promessa que o
repositório não consegue cumprir sozinho. O código diz `s-maxage=15`; quem
respeita é a borda. O código grava `resolvido_em` com `defaultNow()`; quem
garante que esse relógio está certo é o provedor. Cada seção termina com **como
verificar** — porque uma promessa de infraestrutura que ninguém conferiu é uma
suposição com aparência de decisão.

---

## 1. O desenho

```
  celular do participante
          │  HTTPS (HTTP/3 quando o aparelho aceita)
          ▼
  ┌───────────────────┐        cache de borda: /api/classificacao, 15 s
  │   Vercel (gru1)   │        no-store: painel, exportação, saúde, métricas
  │  Next.js 16, Node │
  └─────────┬─────────┘
            │  TLS, string do pooler
            ▼
  ┌───────────────────┐
  │  Neon — Postgres  │        aws-sa-east-1 (São Paulo)
  │  PgBouncer + PG18 │        backup automático + snapshot manual no dia
  └───────────────────┘

  UptimeRobot ──► GET /api/saude, a cada 5 min ──► e-mail
```

| peça      | escolha                | onde está decidido |
| --------- | ---------------------- | ------------------ |
| aplicação | Vercel, plano Hobby    | D-76               |
| região    | `gru1` — São Paulo     | D-79               |
| banco     | Neon, `aws-sa-east-1`  | D-79               |
| conexões  | pooler do provedor     | D-80               |
| monitor   | UptimeRobot, gratuito  | D-82               |
| domínio   | **em aberto** — ver §9 | PE-05              |

---

## 2. Variáveis de ambiente em produção

A lista completa, com o porquê de cada uma, está em [`.env.example`](../.env.example);
a validação está em `src/shared/env.ts` e falha no boot, nomeando a variável.
O que muda **em produção**:

| variável         | valor                                                                |
| ---------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`   | string do **pooler** do Neon (host com `-pooler`), `sslmode=require` |
| `SESSION_SECRET` | 48 bytes de `openssl rand -base64 48`, distinto do de homologação    |
| `APP_URL`        | a URL pública final — é ela que vira o QR (RF-01)                    |
| `NODE_ENV`       | `production` — é o que liga `rejectUnauthorized` no TLS              |
| `DB_POOL_MAX`    | `5`, o padrão. Só mexer com número de T18 na mão                     |
| `APP_VERSION`    | **não definir.** O commit publicado preenche sozinho (§6)            |

Segredos não entram no repositório e não entram em `vercel.json`: vivem nas
variáveis de ambiente do projeto na Vercel, marcadas para produção. O
`.gitignore` já barra `.env`.

---

## 3. Postgres: o pooler é o assunto, não o pool

**O problema não existe em servidor de longa duração e é a regra em função
efêmera.** Cada instância que a plataforma acorda abre o próprio pool. Trinta
instâncias no pico de cadastro, a dez conexões cada, pedem trezentas conexões a
um Postgres gratuito que oferece cem — e o que o participante vê não é
lentidão, é `too many clients already`.

Baixar `DB_POOL_MAX` para 1 não resolve: transforma concorrência em fila dentro
do processo e a página da Classificação é `force-dynamic` (D-59). **Quem resolve
é o pooler:** a função fala com o PgBouncer do provedor, que multiplexa milhares
de clientes sobre poucas conexões reais. Por isso a `DATABASE_URL` de produção é
a string do pooler, e `DB_POOL_MAX=5` é só o teto por instância.

**A migração é a exceção, e é uma pegadinha cara.** PgBouncer em modo transação
não repassa comando que precisa de estado de sessão. `npm run db:migrate` deve
receber a string **direta** do Neon (host sem `-pooler`), à mão, na hora de
migrar:

```bash
DATABASE_URL="postgresql://...@ep-xxx.sa-east-1.aws.neon.tech/speedx?sslmode=require" npm run db:migrate
```

### Região

`aws-sa-east-1` (São Paulo), a mesma cidade de `gru1`. Não é preferência: a
Classificação é `force-dynamic`, então **cada primeira pintura atravessa a
distância entre função e banco**. Função em Washington com banco em São Paulo
custa ~120 ms de ida e volta por consulta, e RNF-01 mede exatamente isso.

### TLS

Obrigatório (FL-09). `src/db/index.ts` liga `rejectUnauthorized: true` quando
`NODE_ENV=production` — certificado inválido derruba a conexão em vez de
aceitar em silêncio.

### Backup e restauração

- **Automático:** o Neon mantém histórico de restauração no plano gratuito. Isso
  é o piso, não o plano.
- **Snapshot manual no início do evento**, antes da primeira inscrição. É o
  ponto para o qual se volta se algo apagar dado no meio do dia.
- **Restauração testada em homologação antes de 24/10.** Backup não testado não
  é backup — a hora de descobrir que a restauração pede um parâmetro que
  ninguém tem não é às 11h de sábado.

### Como verificar

```bash
# TLS exigido e versão do servidor
psql "$DATABASE_URL" -c "show ssl; select version();"

# a que distância o banco está da função: rode de dentro da aplicação publicada
curl -s https://<dominio>/api/saude | jq .banco.latenciaMs   # esperado: < 30 ms
```

---

## 4. Borda, cache e compressão

O que o código promete e a borda precisa honrar:

| rota                     | `Cache-Control`                                  |
| ------------------------ | ------------------------------------------------ |
| `GET /api/classificacao` | `public, s-maxage=15, stale-while-revalidate=30` |
| todo o resto             | `no-store`                                       |

`tests/deploy.test.ts` vigia essa tabela: se alguém acrescentar uma rota de API
sem `no-store`, a suíte falha nomeando o arquivo. É a única forma de a promessa
sobreviver a uma rota nova escrita com pressa no dia 23 de outubro.

### Como verificar, contra o domínio publicado

```bash
# HTTP/3 anunciado (FL-02, FL-07) — o cabeçalho alt-svc traz h3
curl -sI https://<dominio>/ | grep -i alt-svc

# a segunda chamada dentro de 15 s tem de vir da borda
curl -sI https://<dominio>/api/classificacao | grep -iE 'x-vercel-cache|age|cache-control'
# esperado: MISS na primeira, HIT na segunda

# Brotli
curl -sI -H 'Accept-Encoding: br' https://<dominio>/ | grep -i content-encoding

# o painel nunca em cache
curl -sI https://<dominio>/api/metricas | grep -i cache-control   # no-store

# HSTS presente (só em produção, por decisão de código)
curl -sI https://<dominio>/ | grep -i strict-transport-security
```

**Os cabeçalhos de segurança já foram conferidos**, contra o artefato de
produção rodando localmente (`next build && next start` com
`NODE_ENV=production`): `frame-ancestors 'none'`, `X-Frame-Options`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy` e
`Strict-Transport-Security: max-age=15552000; includeSubDomains` saem em toda
resposta. O que a publicação ainda tem de mostrar é o **redirecionamento** de
HTTP para HTTPS, que é da plataforma.

**Se o `alt-svc` não aparecer**, HTTP/3 não está no ar e FL-02/FL-07 caem para
TCP. Isso não bloqueia o evento, mas vira risco declarado no checklist de T21:
com centenas de celulares na mesma célula, o bloqueio de cabeça de fila do TCP
é o que ameaça RNF-04.

---

## 5. Relógio (FL-10, RF-23, RF-31)

**Todo instante gravado vem do servidor.** Não é disciplina, é ausência de
caminho: nenhum esquema Zod da API tem campo de data, e as colunas de instante
nascem de `defaultNow()` ou de um `new Date()` do processo. O Operador não tem
como enviar um horário mesmo que queira — e é isso que impede que o relógio
errado de um tablet decida um desempate de RF-31.

`tests/deploy.test.ts` verifica as duas metades: que nenhum esquema de entrada
aceita data, e que toda coluna de instante é `withTimezone: true`.

- **Fuso:** tudo em UTC no banco e na aplicação; a conversão para
  `America/Sao_Paulo` acontece só na apresentação (`src/shared/tempo.ts`, D-78).
- **Sincronia do host:** garantida pelo provedor — não há máquina nossa para
  rodar NTP. O que resta é conferir, e há por onde: `GET /api/saude` devolve
  `instante` do relógio do servidor, o mesmo que carimba `resolvido_em`.

```bash
# diferença entre o relógio do servidor e o de quem confere
curl -s https://<dominio>/api/saude | jq -r .instante ; date -u +%Y-%m-%dT%H:%M:%SZ
# tolerância: 2 s. Acima disso, abrir chamado antes do evento
```

---

## 6. Ambientes e deploy

- **`producao`** e **`homologacao`** são dois ambientes do mesmo projeto na
  Vercel, com o mesmo formato de configuração e **bancos distintos**. Um
  `SESSION_SECRET` compartilhado faria uma sessão de homologação valer em
  produção.
- **Deploy sai de commit** em `main`, com histórico de publicações e reversão em
  um clique. O identificador do commit vira `APP_VERSION` sozinho, pela
  `VERCEL_GIT_COMMIT_SHA`, e sai em `GET /api/saude` — é assim que se responde
  "qual código está no ar agora" sem entrar na máquina.
- **Congelamento no dia 24/10:** nenhum deploy entre a abertura e o fim do
  evento, exceto correção crítica com duas pessoas de acordo. O que existe para
  o dia é a reversão, não a publicação.
- **Alavancas que não exigem deploy**, e é por isso que elas existem:
  `RATE_LIMIT_ATIVO=false` desliga o limite de cadastro se ele começar a recusar
  gente de verdade (T05), e a reversão volta a versão anterior em minutos.
  Mudar variável de ambiente na Vercel exige _redeploy_ da última publicação —
  o que é reversão, não código novo.

### Desligamento programado — 4 de novembro de 2026

O termo de consentimento promete que o site sai do ar dez dias depois do evento
(D-22). **Sair do ar é diferente de apagar o banco**, e as duas coisas
acontecem no mesmo dia:

1. `npm run expurgar --evento 2026-10-24` — o expurgo de T15, com o
   procedimento inteiro em [`retencao.md`](retencao.md).
2. Remover o domínio do projeto e desativar a publicação na Vercel.
3. Apagar o projeto no Neon (o backup automático vai junto — é o ponto).
4. Desligar o monitor do UptimeRobot, para não alertar sobre um site que
   deveria estar fora do ar.

**Responsável:** o time técnico do projeto. **Data:** 04/11/2026, o mesmo
instante em que a retenção vence.

---

## 7. Monitor externo

**UptimeRobot, plano gratuito** (D-82), apontado para `GET /api/saude`, com
alerta por e-mail para ao menos duas pessoas.

**O intervalo do plano gratuito é de 5 minutos, e o documento de monitoramento
pede 60 segundos.** A diferença é real e fica registrada: uma queda pode passar
até cinco minutos sem alerta. Para uma janela de evento de um dia com gente no
local olhando o painel, é aceitável — quem descobre uma queda em menos de cinco
minutos, no dia, é o Operador na frente da fila, não o monitor. O monitor existe
para o resto: a madrugada anterior, a hora do almoço, o intervalo em que
ninguém está olhando.

Detalhes das três superfícies de observação em
[`monitoramento.md`](monitoramento.md).

---

## 8. Checklist de verificação

Os critérios de aceitação de T19, na ordem em que dá para executá-los. Os
quatro primeiros exigem o domínio publicado.

- [ ] `curl -sI https://<dominio>/ | grep -i alt-svc` traz `h3` — ou o risco
      está registrado por escrito no checklist de T21
- [ ] `/api/classificacao` responde `HIT` na segunda chamada dentro de 15 s
- [ ] `/api/painel/*`, `/api/exportacao`, `/api/metricas` e `/api/saude`
      respondem `no-store`
- [ ] `strict-transport-security` presente; HTTP redireciona para HTTPS
- [ ] `instante` de `/api/saude` bate com um relógio de referência (2 s)
- [ ] nenhum instante gravado vem do cliente — verificado por
      `tests/deploy.test.ts`, e por leitura de `src/db/schema.ts`
- [ ] restauração de backup testada em homologação, com data anotada aqui:
      `____/____/2026`
- [ ] [`plano-do-dia.md`](plano-do-dia.md) impresso e com os telefones
      preenchidos

---

## 9. O que ainda não tem resposta

1. **O domínio.** Enquanto não existir, o QR de `docs/qr/inscricao.svg` é
   provisório (D-35) e os quatro primeiros itens do checklist não têm contra o
   que rodar. **É o item de maior prazo de todos**: QR impresso precisa de folga
   antes de 24/10, e uma URL de comprimento diferente muda o número de módulos
   do código — ou seja, o material impresso precisa ser refeito, não corrigido.
2. **A data do teste de restauração.** Sem ela, o backup é uma suposição.
3. **Os telefones do plano do dia**, que só o time do evento tem.
