# T15 — Retenção e exclusão de dados

**Contexto SDD:** BC-05 Custódia de Dados
**Depende de:** T03, T14
**Bloqueia:** —
**Requisitos:** RNF-11, RF-09 (parte de retenção e exclusão)

---

## Objetivo

Fechar o ciclo de vida do dado pessoal. O sistema coleta dado de adolescente; o compromisso assumido no termo (T03) precisa de um procedimento real por trás, não de uma promessa.

## Escopo

### 1. Definir o prazo de retenção com o organizador

**Resolvido em 2026-08-19 (PE-02):** máximo de **10 dias após o evento**. Já declarado no termo (`v0.4`).

Falta registrar por escrito em `docs/retencao.md`: data-base (fim do evento, ainda dependente de PE-06), responsável pela execução e forma de confirmação.

**O termo assumiu dois compromissos que esta task precisa cumprir** (D-22):

- ao fim dos 10 dias, **o site sai do ar** — a classificação pública deixa de existir. Deixou de ser decisão de infraestrutura de T19 e virou promessa escrita ao participante;
- o pedido de exclusão pode chegar por e-mail (`dhiegodev@hotmail.com`) **fora do dia do evento**, não só presencialmente. O procedimento precisa atender os dois caminhos.

### 2. Procedimento de exclusão total

- Comando administrativo `npm run expurgar -- --confirmar` que apaga participantes, responsáveis, consentimentos, tentativas e lançamentos após o prazo.
- Exigir confirmação explícita e registrar a execução (o que foi apagado, quantas linhas, quando, por quem).
- Decidir e documentar o que sobrevive ao expurgo: **agregados anônimos** (contagem de participantes, distribuição de tempos, classificação com nome público) podem ser preservados se o organizador quiser histórico. Isso precisa estar declarado no termo.

### 3. Exclusão individual sob solicitação

- Procedimento para atender pedido de exclusão de um participante específico, feito por qualquer um dos canais declarados no termo: e-mail `dhiegodev@hotmail.com` ou, durante o evento, o ponto de inscrição.
- Ao excluir um Participante, suas Tentativas saem também — e, portanto, a linha some da Classificação.
- **Encaminhar o pedido a quem recebeu o telefone** (FIAP e a escolinha de D-22), porque o termo promete isso e nós não apagamos a cópia deles.
- Registrar a solicitação e o atendimento.

### 4. Higiene contínua

- Expurgo automático de `chave_idempotencia` com mais de 48 h.
- Expurgo de sessões expiradas.
- Logs de aplicação com retenção curta e sem dado pessoal (garantido em T05).

### 5. Documentação para o organizador

Uma página em linguagem simples: o que está guardado, por quanto tempo, como pedir exclusão, quem executa.

## Critérios de aceitação

- [ ] Prazo de retenção acordado e registrado por escrito (RNF-11).
- [ ] Comando de expurgo executado em ambiente de teste remove 100% dos dados pessoais e deixa registro da operação.
- [ ] Exclusão individual remove o participante, suas tentativas e sua linha na Classificação.
- [ ] O texto de T03 descreve exatamente o prazo e o canal implementados aqui — sem divergência entre o prometido e o executável.
- [ ] Chaves de idempotência antigas são expurgadas automaticamente.

---

## Resultado da execução — 2026-08-24

| Arquivo | Papel |
|---|---|
| `src/contexts/custodia/retencao.ts` | O prazo: leitura da data do evento, vencimento no fuso do evento |
| `src/contexts/custodia/expurgo.ts` | Expurgo total, exclusão individual, resumo anônimo, higiene composta |
| `src/infra/higiene.ts` | Chaves de idempotência e marcas de limite; a varredura automática |
| `scripts/expurgar.ts` | `npm run expurgar` — ensaio, expurgo, exclusão, faxina |
| `src/shared/argumentos.ts` | Analisador de `--chave valor`, extraído de `criar-operador.ts` |
| `docs/retencao.md` | O procedimento escrito, em linguagem simples e em passo a passo |
| `tests/retencao.test.ts` | 20 testes |

### Medido contra o banco real (PostgreSQL 18, massa de 2000)

| | resultado |
|---|---|
| Ensaio do expurgo total | 2.000 participantes · 2.973 tentativas · 151 menores |
| Exclusão individual | 1 participante e 2 tentativas fora; base foi a 1.999 / 2.971 |
| Busca por e-mail | acha com caixa trocada (`PARTICIPANTE7@…`) |
| Recusa por prazo | recusou com 30 dias restantes, como devia |
| Sem terminal | cancelou em vez de apagar |

### O prazo mora em dois lugares e um teste os amarra

`DIAS_DE_RETENCAO` é código; "10 dias" é texto do termo aceito por quem se
inscreve. São arquivos diferentes e nada os liga a não ser um teste que lê a
seção `retencao` do termo e procura o número lá dentro. Sem ele, mudar a
constante é quebrar uma promessa em silêncio.

### O comando não tem valor padrão para a data do evento

A tentação é `hoje - 10 dias`. Isso ancora o prazo no dia em que alguém lembrou
de rodar o comando, e não no dia contra o qual a promessa foi feita — quem
esquecer por duas semanas terá guardado 24 dias e achado que cumpriu.

Como PE-06 ainda não fechou, não existe data para colocar como padrão. **Isso é
uma vantagem, não um obstáculo:** um padrão aqui seria um palpite com poder de
apagar a base.

Pelo mesmo motivo, `lerDiaDoEvento` recusa `2026-02-31` em vez de aceitar o que
`new Date` faria com ela — virar 3 de março, calado, e tirar dois dias de guarda
de todo mundo.

### Três travas, e nenhuma é redundante

1. **Ensaio por padrão.** Sem `--confirmar`, conta e mostra.
2. **Recusa antes do vencimento.** Apagar cedo protege mais em tese; na prática
   o caso não é o organizador zeloso, é um dedo trocado na data na semana do
   evento. `--antecipar` existe para quem de fato quer.
3. **A palavra `APAGAR` digitada por extenso.** E **fim de entrada é "não"**:
   sem terminal, o `readline` fecha sem chamar a resposta. Sem tratamento, a
   promessa ficava pendurada; com tratamento descuidado, o silêncio viraria
   consentimento. Só uma das duas leituras é segura.

### O que sobrevive: números, e a classificação não é um deles

O escopo permitia preservar "agregados anônimos … classificação com nome
público, se o organizador quiser histórico". **Não foi preservada.** O termo
autoriza guardar "apenas números que não identificam ninguém", e nome
identifica — inclusive o nome público de menor, que já sinaliza a faixa etária
(D-21). Histórico com nomes precisa de um termo aceito para isso, não de uma
exceção no expurgo.

O que fica é `resumoAnonimo`: contagens, melhor tempo, mediana e pior por Pitch.
E não volta para tabela nenhuma — sai no terminal e no log. O teste varre os
**valores** do documento e falha se qualquer texto que não seja o instante de
geração aparecer ali.

### A higiene é oportunista porque não há agendador

Não existe `cron` neste sistema, e um que só existisse num provedor viraria
dívida no dia da migração (PE-05 continua aberta). O gatilho é `consultarEfeito`
— toda escrita idempotente passa por lá, e é ela que cria as linhas que precisam
sumir. Um relógio de módulo deixa passar uma varredura por hora, por processo, e
ela **não é aguardada**: se a faxina falhar, sai uma linha de log e o cadastro da
pessoa segue. O contrário seria trocar um problema invisível por um visível.

Efeito colateral que valia a pena: `RATE_LIMIT_JANELA_SEGUNDOS` e
`LOGIN_JANELA_SEGUNDOS` ganharam teto em `env.ts`. Sem isso, uma janela
configurada acima de 48 h faria a faxina apagar contagem que o limite ainda
usaria — um limite de taxa que se desarma sozinho e ninguém percebe.

### Critérios de aceitação

- [x] Prazo de retenção acordado e registrado por escrito (RNF-11). — `docs/retencao.md`, com responsável, canal, prazo de atendimento e forma de confirmação. A **data-base** continua vazia porque PE-06 não fechou, e a linha está marcada como tal.
- [x] Comando de expurgo remove 100% dos dados pessoais e deixa registro. — conferido contando as oito tabelas depois, todas em zero, e com o comprovante impresso. A cascata (Responsável, Consentimento, Lançamento) tem teste próprio, que é o que denuncia uma migração futura que perca o `on delete cascade`.
- [x] Exclusão individual remove o participante, suas tentativas e sua linha na Classificação. — verificado contra o banco real: 2.000 → 1.999 e 2.973 → 2.971. A linha some da página pública em menos de um minuto, somando o memo de 5 s da projeção ao cache de borda de 15 s e à tolerância de 30 s.
- [x] O texto de T03 descreve exatamente o prazo e o canal implementados. — o teste lê a seção `retencao` do termo e procura `DIAS_DE_RETENCAO` lá dentro; o canal de e-mail e o presencial estão os dois no procedimento.
- [x] Chaves de idempotência antigas são expurgadas automaticamente. — varredura oportunista de uma hora, com teste que prova que a segunda e a terceira chamadas na mesma hora **não** rodam, e outro que prova que a falha da faxina não derruba a requisição.

### Aberto

- [x] ~~**A data do evento** (PE-06)~~ — **resolvida em 2026-08-25: 24 de outubro de 2026.** `docs/retencao.md` §2 já traz a data-base e o vencimento (04/11/2026, 00:00 em São Paulo). O comando continua exigindo `--evento 2026-10-24` escrito à mão: a data existir não a torna valor padrão (D-63).
- [ ] **Tirar o site do ar** ao fim do prazo. O passo 5 do procedimento está escrito e depende de onde a aplicação vai morar (PE-05, T19). Apagar o banco não cumpre sozinho a promessa do termo.
- [ ] **O expurgo total nunca rodou contra o banco real** — só o ensaio, e a suíte contra Postgres via PGlite. Rodar de verdade apagaria a massa de 2000 que T18 ainda vai medir. Entra no ensaio geral de T21.

## Estado

**Concluída em 2026-08-24.** 20 testes novos, 557 no total. Fecha a Custódia
(BC-05) e o ciclo de vida do dado pessoal. Restam apenas as tarefas de qualidade
e operação, T16 a T21.
