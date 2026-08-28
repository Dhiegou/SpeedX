# T19 — Deploy e infraestrutura

**Contexto SDD:** §4 (transporte) e §5 (modos de falha)
**Depende de:** T01, T16
**Bloqueia:** T18, T21
**Requisitos:** RNF-01, RNF-04, RNF-05, RF-23, RF-31

---

## Objetivo

Colocar em pé o ambiente que sustenta as decisões de transporte do SDD. Duas delas dependem inteiramente da infraestrutura e não do código: **HTTP/3 anunciado** e **relógio do servidor confiável**.

### O que já está decidido — 2026-08-25

**A aplicação vai para a Vercel, plano gratuito** (D-76). Isso encaminha três itens desta task sem trabalho: a borda anuncia HTTP/3 (§1) e comprime com Brotli, honra `s-maxage` e `stale-while-revalidate` (§3), e o deploy sai de commit com reversão em minutos (§6). Nenhum deles está **verificado** — §1 continua exigindo o `curl --http3` contra o domínio de verdade.

**Quatro coisas continuam abertas, e são elas que seguram T18 e T21:**

1. **Onde roda o Postgres.** A Vercel não hospeda o banco. Vale tudo o que §5 pede — TLS obrigatório, backup automático, restauração testada — mais duas questões que só existem por causa do ambiente sem servidor: **limite de conexões** visto de funções efêmeras, e **região**. A página da Classificação é `force-dynamic` (D-59): cada primeira pintura atravessa a distância entre a função e o banco, e a região padrão da Vercel não é São Paulo.
2. **O domínio.** Enquanto não existir, o QR de T07 é provisório (D-35).
3. **O monitor externo** de T16, com o teste real de disparo.
4. **O plano Hobby é para uso não comercial.** Se o evento é patrocinado, cobra inscrição ou carrega marca de terceiro, confirmar os termos antes — ou orçar o plano pago. A consequência de errar isso não é uma fatura, é o site sair do ar no dia.

**A data do evento é 24 de outubro de 2026** (PE-06), o que data o congelamento de deploys de §6 e o desligamento programado: **4 de novembro de 2026**, o mesmo instante em que a retenção vence.

## Escopo

### 1. Hospedagem com HTTP/3 (FL-02, FL-07)

O SDD justifica QUIC pelo cenário real: centenas de celulares na mesma célula, perda de pacote alta, bloqueio de cabeça de fila do TCP prejudicando RNF-04. **A hospedagem escolhida precisa anunciar HTTP/3.**

- Verificar com `curl --http3 -I https://<dominio>` e conferir o cabeçalho `alt-svc: h3=...`.
- Se a plataforma não anunciar HTTP/3, isso vira risco declarado: FL-02 e FL-07 caem para TCP e RNF-04 fica ameaçado. Registrar no checklist e decidir conscientemente.

### 2. TLS e domínio

- Certificado válido, HSTS, redirecionamento de HTTP para HTTPS.
- Domínio curto para o QR code (T07), com DNS de TTL adequado (FL-01).

### 3. Cache de borda (RNF-01)

- Configurar a borda para respeitar `s-maxage` e `stale-while-revalidate` de T12.
- Confirmar que a resposta pública é servida **da borda**, sem atingir a aplicação a cada leitura.
- Compressão Brotli habilitada.
- Garantir que rotas do painel e de exportação **nunca** sejam cacheadas (`no-store`).

### 4. Relógio do servidor (FL-10, RF-23, RF-31)

- Sincronização NTP ativa no host (ou garantia equivalente do provedor gerenciado), documentada.
- Confirmar que **todo** instante gravado (`inscrito_em`, `resolvido_em`, `lancamento.ocorrido_em`) vem do servidor — nunca do dispositivo do Operador. Verificado por leitura do código, conforme a restrição 1 do anexo.
- Fuso horário do banco e da aplicação em UTC, com conversão só na apresentação.

### 5. Banco de dados

- Instância gerenciada com TLS obrigatório (FL-09), pool de conexões dimensionado.
- **Backup automático** e, principalmente, um *snapshot manual* no início do evento.
- Testar a **restauração** antes do evento. Backup não testado não é backup.

### 6. Ambientes

- `producao` e `homologacao` com o mesmo formato de configuração.
- Segredos fora do repositório, injetados por variável de ambiente.
- Deploy reprodutível a partir de commit, com possibilidade de reverter em minutos. **Congelar deploys no dia do evento**, exceto correção crítica.
- **Desligamento programado:** o termo de consentimento promete que, 10 dias após o evento, o site sai do ar (D-22). Precisa haver um responsável, uma data e um procedimento — tirar do ar, não só apagar o banco. Executado junto com o expurgo de T15.

### 7. Plano de resposta no dia

Documento curto (uma página) com: quem é acionado, como reverter, como acessar log, como rodar o expurgo de emergência do cache, telefone das pessoas relevantes.

## Critérios de aceitação

- [ ] `curl --http3 -I` confirma HTTP/3 anunciado — ou o risco está registrado e aceito por escrito.
- [ ] Requisição repetida a `/api/classificacao` retorna `HIT` de cache de borda dentro da janela.
- [ ] Rotas do painel e exportação retornam `no-store`.
- [ ] Sincronia de relógio do servidor verificada e documentada.
- [ ] Nenhum timestamp gravado vem do cliente (verificado por leitura do código).
- [ ] Restauração de backup testada com sucesso em homologação.
- [ ] Plano de resposta escrito e distribuído ao time do evento.

---

## Resultado da execução — 2026-08-27

**Parcialmente concluída, e a parte que falta não é código.** Tudo o que o
repositório consegue decidir, decidir com teste e documentar está feito. O que
resta são sete verificações que exigem um domínio publicado e uma conta criada
— estão no checklist de [`docs/deploy.md`](../../docs/deploy.md) §8, cada uma
com o comando que a executa.

**Decidido nesta sessão, com o usuário:** o Postgres é o **Neon, região
`aws-sa-east-1`** (D-79); o monitor é o **UptimeRobot gratuito** (D-82); o
**domínio continua sem existir**, e é hoje o item de maior prazo do projeto.

### O assunto de deploy sem servidor não é o pool, é o pooler

O item 5 pedia "pool de conexões dimensionado", e a leitura óbvia — escolher um
número — é a errada. Cada instância de função abre o **próprio** pool. Trinta
instâncias no pico de cadastro, a dez conexões cada, pedem trezentas conexões a
um Postgres gratuito que oferece cem, e o que o participante vê não é lentidão:
é `too many clients already`.

Baixar o número para 1 troca um problema por outro — a Classificação é
`force-dynamic` (D-59) e uma instância atende mais de uma requisição por vez, de
modo que um pool de um transforma concorrência em fila dentro do processo.
**Quem resolve é o pooler do provedor** (D-80): `DB_POOL_MAX=5` por instância,
`DATABASE_URL` apontando para o PgBouncer do Neon, e `idleTimeoutMillis` caindo
de 30 s para 10 s, porque conexão ociosa segurada por instância congelada é
assento que o pooler não pode dar a mais ninguém.

**A pegadinha que sobra está escrita em dois lugares:** `npm run db:migrate`
precisa da string **direta**, porque PgBouncer em modo transação não repassa
comando que dependa de estado de sessão. Uma migração feita pela string do
pooler falha no meio — e o meio de uma migração é o pior lugar para falhar.

### Três promessas que agora quebram alto em vez de quebrar caladas

`tests/deploy.test.ts` (11 casos) vigia o que uma revisão humana não pega:

1. **Uma rota nova sem `no-store`.** O teste aceita o cabeçalho próprio ou o
   herdado de `_apoio.ts` — e, porque aceita a herança, verifica também o elo:
   se `SEM_CACHE` virar outra coisa, seis rotas do painel mudam de
   comportamento sem que nenhuma delas mencione cache no próprio arquivo.
2. **Um campo de instante aceito do cliente.** Bastaria um `dataHora` num
   esquema Zod para o relógio de um tablet passar a decidir o desempate de
   RF-31, e **nenhum teste de comportamento pegaria**: o comportamento não muda,
   muda de quem é o relógio. O teste recusa `z.date`, `z.iso`, `.datetime()` e
   `coerce.date` nos esquemas de entrada, exige `withTimezone: true` em toda
   coluna de instante, e proíbe qualquer rota de repassar `agora`.
3. **A região do código e a do documento discordando.** `gru1` só faz sentido
   colado a `sa-east-1`; se um mudar sem o outro, a Classificação passa a
   atravessar o continente a cada primeira pintura e nada reclama.

### A versão publicada deixou de depender de alguém lembrar

`APP_VERSION` era uma variável para preencher à mão a cada deploy — ou seja,
uma variável destinada a ficar desatualizada. Agora ela sai de
`VERCEL_GIT_COMMIT_SHA`, que a plataforma já define, com sete caracteres: é o
que se lê em voz alta ao telefone e o que o `git log --oneline` mostra do outro
lado. Preenchida à mão, ela ainda vence — para o ambiente sem plataforma de
deploy.

### HSTS com prazo, e o motivo é a data de desligamento

O manual manda dois anos com `preload`. O manual pressupõe um site que continua
existindo, e este não continua: o termo promete que sai do ar em 04/11/2026
(D-22). Entrar na lista de pré-carga é fácil e sair leva meses — deixaríamos um
domínio morto marcado nos navegadores do mundo, e quem o registrasse depois
herdaria a marca. **180 dias, sem `preload`** (D-81): cobre a vida do site com
folga e vence sozinho.

### O deploy sai de commit, e o commit estava incompleto

O item 6 pede "deploy reprodutível a partir de commit". Conferindo isso, uma
alteração em `app/api/exportacao/route.ts` **não apareceu no `git status`**.

O `.gitignore` de T14 traz um bloco contra vazamento de base — nenhum CSV,
nenhum dump, nenhuma pasta de exportação. Duas linhas eram `exportacao/` e
`exportacoes/`, e padrão de gitignore sem barra inicial casa em **qualquer**
nível: `app/api/exportacao/` entrava junto. **A rota de exportação de T14 nunca
esteve no repositório.** Arquivo no disco, suíte verde, build compilando,
`git status` limpo — e um clone produziria um sistema sem `/api/exportacao`.

A correção é uma barra (`/exportacao/`). O que fica é o teste: `git status
--ignored` sobre `app`, `src`, `tests`, `e2e` e `scripts` tem de vir
vazio. Conferi que ele falha remontando o padrão largo, e a mensagem nomeia o
diretório.

**Vale além deste defeito:** arquivo não rastreado é invisível para todas as
ferramentas que este projeto usa para se vigiar. Lint, tipos, testes, build e a
rastreabilidade de T17 leem o disco, e o disco estava certo (D-83).

### Critérios de aceitação

- [ ] `curl --http3 -I` confirma HTTP/3 anunciado. — **depende do domínio.**
      Comando escrito em `docs/deploy.md` §4; o risco a declarar, se falhar,
      está redigido lá e entra em T21.
- [ ] `/api/classificacao` devolve `HIT` dentro da janela. — **depende do
      domínio.** O que o código promete (`s-maxage=15`,
      `stale-while-revalidate=30`) tem teste; quem honra é a borda.
- [x] Rotas do painel e exportação retornam `no-store`. — verificado por
      `tests/deploy.test.ts`, no cabeçalho próprio e no herdado.
- [ ] Sincronia de relógio do servidor verificada e documentada. —
      **documentada** (`docs/deploy.md` §5, com o comando de conferência contra
      `/api/saude`); a **verificação** quer o ambiente publicado.
- [x] Nenhum timestamp gravado vem do cliente. — verificado por leitura, como a
      restrição 1 do anexo exige, e agora também por teste.
- [ ] Restauração de backup testada em homologação. — **pendente**, com a linha
      de data esperando no checklist. Backup não testado não é backup.
- [x] Plano de resposta escrito. — [`docs/plano-do-dia.md`](../../docs/plano-do-dia.md),
      uma página, para imprimir. **Distribuí-lo é de T21**, e os telefones
      continuam em branco porque só o time do evento os tem.

### Aberto

- [ ] **O domínio.** Sem ele, quatro dos sete critérios não têm contra o que
      rodar e o QR de T07 segue provisório (D-35). É o item de maior prazo:
      material impresso precisa de folga antes de 24/10, e uma URL de
      comprimento diferente muda o número de módulos do código — o QR se
      refaz, não se corrige.
- [ ] **Criar as contas e publicar.** Vercel, Neon e UptimeRobot estão
      escolhidos; nenhum está de pé.
- [ ] **Homologação com banco próprio**, e um `SESSION_SECRET` distinto do de
      produção.
- [ ] **T18 mede o que aqui foi só dimensionado:** `DB_POOL_MAX=5`,
      `maxDuration=60` da exportação e a latência real entre `gru1` e
      `sa-east-1`.

---

## Estado

**Parcial em 2026-08-27.** O código, a configuração e os dois documentos de
operação estão prontos, com 15 testes novos (12 de deploy, 3 de ambiente) e um
defeito de dois meses corrigido: a rota de exportação de T14, que o `.gitignore`
mantinha fora do repositório sem que nada reclamasse (D-83). O que
falta é infraestrutura contratada e um domínio — nenhum dos dois se resolve
daqui, e os dois seguram T18 e T21.
