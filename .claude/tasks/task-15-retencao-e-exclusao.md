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
