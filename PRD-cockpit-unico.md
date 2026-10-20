# PRD — Um Cockpit, melhor volta: a escolha de Cockpit sai do sistema

**Data:** 2026-10-19. **Faltam 5 dias para o evento.**
**Decisão:** do organizador, tomada hoje
**Contexto SDD:** BC-01 Inscrição, BC-02 Cronometragem, BC-03 Classificação
**Requisitos afetados:** RF-03, RF-24, RF-25, RF-29. Premissa P-03

---

## 1. A mudança, e o que ela não é

O evento passa a ter **um Cockpit só**. Cada piloto corre **três voltas** nele, e vale a melhor.

**As três voltas acontecem no simulador e o sistema nunca fica sabendo delas.** O Operador lê a melhor volta na tela do simulador e digita **esse número**, exatamente como digita um tempo hoje.

Isso é o que torna a mudança viável a cinco dias: **para o banco, continua sendo uma pessoa, uma Tentativa, um tempo.** Nada no modelo de dados precisa mudar. O que sai é a escolha de Cockpit, que deixou de existir no mundo real.

Se em algum momento a decisão virar "o Operador digita as três voltas e o sistema escolhe a melhor", **este PRD não serve**: aquilo é mudança de esquema, de fila e de painel, e o lançamento deixa de caber nos 15 segundos de RNF-16.

---

## 2. A decisão estrutural: a coluna `cockpit` fica, e vale sempre 1

**Não há migração neste trabalho.** A coluna `tentativa.cockpit` permanece, e toda Tentativa nasce com o valor `1`.

Três razões, em ordem de peso:

**O constraint existente vira exatamente a regra nova.** `tentativa_participante_cockpit_unica` é único em `(participante_id, cockpit)`. Com `cockpit` sempre `1`, ele passa a significar **uma Tentativa por participante**, que é precisamente o que o evento agora exige. A regra mais importante do domínio continua garantida pelo banco, sem uma linha de SQL nova.

**`check (cockpit in (1, 2))` continua passando** com o valor 1. Nada a alterar.

**Migração contra produção a cinco dias é risco que não se compra por elegância.** O `deploy.md` §3 documenta que migração exige a string direta, não a do pooler, e o meio de uma migração é o pior lugar para falhar.

**O custo, declarado:** o banco fica com uma coluna que não significa mais nada. Isso é dívida, e tem de ficar escrito como decisão consciente, não como esquecimento. Depois do evento, se o projeto continuar, ela sai numa migração feita com calma.

---

## 3. O que sai, superfície por superfície

### 3.1 Formulário de inscrição (`/`)

Sai a seção inteira **"Cockpits"**, com as caixas `Cockpit 1` e `Cockpit 2` e o texto "Escolha um ou os dois. Dá para correr nos dois."

A inscrição passa a criar **uma Tentativa, com `cockpit: 1`**, sem perguntar nada. O esquema Zod perde o campo `cockpits` e sua validação (ao menos um, sem repetição, dentro de 1 e 2).

Isso encerra **RF-03**.

### 3.2 Classificação (`/classificacao`)

Saem as três abas **Todos · Cockpit 1 · Cockpit 2** e o filtro por Cockpit em `filtro.ts`. Sai a coluna de Cockpit da tabela e o rótulo embutido na linha.

A busca por nome, o pódio, a paginação e o destaque **ficam como estão**.

Isso encerra **RF-29**. A posição deixa de ser relativa a filtro, porque não há mais filtro que a renumere.

### 3.3 Painel (`/painel`)

Saem as duas abas de Cockpit, o atalho `Alt+1` / `Alt+2`, a segunda fila e a linha de ajuda que os anuncia.

Sai também a inclusão de Tentativa em Cockpit adicional: em `Painel.tsx`, o `.filter((n) => !p.tentativas.some((t) => t.cockpit === n))` sempre devolveria lista vazia, porque a pessoa já tem a única Tentativa possível. **Remover explicitamente**, em vez de deixar um botão que nunca aparece.

Isso encerra **RF-24**.

**O que não muda, e é o ponto:** buscar, selecionar, digitar o tempo e confirmar. O lançamento continua sendo um número, e RNF-16 continua valendo sem nova medição.

### 3.4 Vocabulário

`src/shared/vocabulario.ts` perde `ambas` e `emAmbas`, que existem só para a frase "nos dois". O comentário do arquivo afirma "tem dois cockpits" e precisa acompanhar.

`nomeDoCockpit()` provavelmente deixa de ter uso. Se sobrar algum, mantenha; se não, saia.

### 3.5 Exportação

A coluna de Cockpit no CSV **pode ficar**, com valor 1, ou sair. Preferir sair: uma coluna constante num relatório confunde quem lê depois do evento. É decisão de baixo risco em qualquer direção.

---

## 4. Papel e contingência

**Este é o item com prazo, porque papel não se corrige depois de impresso.**

| peça | o que muda |
|---|---|
| `ficha-inscricao.html` | sai o campo **"Vou correr em"** (`CAMPO_COCKPITS` em `ficha.ts`) |
| `planilha-tempos.html` | deixa de ser "5 por Cockpit" e vira uma folha única. A coluna de tempo passa a se chamar **melhor volta** |
| `termo-impresso.html` | **não muda** |
| QR e banner | **não mudam** |

**Se as 200 fichas já foram impressas, elas estão erradas e precisam ser refeitas.** Confirmar antes de qualquer outra coisa deste PRD.

O **termo não muda e não precisa de versão nova.** O texto da v1.1 diz "registramos o resultado da sua corrida: a pista, o tempo e o horário do registro", sem mencionar escolha entre dois cockpits nem número de voltas. Continua verdadeiro. Isso evita o caminho caro de versão nova, que nasceria rascunho e bloquearia cadastro até nova aprovação (D-18).

---

## 5. Três armadilhas

### 5.1 O teste de rastreabilidade conta os requisitos

`tests/rastreabilidade.test.ts` afirma **exatamente 35 RF e 18 RNF** no PRD, e verifica que cada requisito tem teste e que não há justificativa órfã.

Encerrar RF-03, RF-24 e RF-29 muda essa contagem. **Atualizar o número é parte do trabalho, e tem de ser deliberado**, com o motivo escrito junto.

O que **não** se faz: mexer no número só para a suíte passar. Esse teste existe para pegar exatamente esse tipo de deriva.

**RF-25 não morre, muda de texto:** de "mais de um tempo por participante por pista" para "mais de um tempo por participante". A regra continua, e continua garantida pelo mesmo constraint.

### 5.2 O e2e já está vermelho

O job de ponta a ponta falha desde 14/10, e a causa foi investigada em 17/10. Esta mudança mexe justamente nas telas que ele exercita: a seleção de Cockpit no cadastro e as abas do painel.

**Cuidado para não confundir o vermelho novo com o antigo.** Antes de começar, saiba qual é a falha que já existia.

### 5.3 A massa de teste cria dois Cockpits

`src/db/seed.ts` sorteia entre um e dois Cockpits por participante. Precisa gerar uma Tentativa com `cockpit: 1` por pessoa, senão a base de desenvolvimento deixa de representar o evento.

Os arquivos em `perf/` também referenciam Cockpits.

---

## 6. Fora de escopo

| item | por quê |
|---|---|
| Qualquer migração de banco | §2. A coluna fica e vale 1 |
| Registrar as três voltas no sistema | A decisão é digitar só a melhor |
| Versão nova do termo | O texto atual continua verdadeiro |
| QR, banner, `APP_URL` | Não são afetados |
| Cold start, plano do Neon, e2e vermelho | Trabalhos próprios, já em andamento |
| Modelar a competição "com IA e sem IA" | Deixa de existir no sistema, já que não há mais dois Cockpits a comparar |

---

## 7. Critérios de aceitação

- [ ] O formulário não pergunta Cockpit, e a inscrição cria uma Tentativa com `cockpit: 1`
- [ ] A Classificação não tem abas nem coluna de Cockpit; busca, pódio e paginação intactos
- [ ] O painel não tem abas, `Alt+1`/`Alt+2` nem inclusão em Cockpit adicional
- [ ] Ficha de papel sem o campo de Cockpit; planilha de tempos única, com a coluna "melhor volta"
- [ ] **Nenhuma migração foi criada**, e `npm run db:migrate` não é chamado
- [ ] PRD atualizado: RF-03, RF-24 e RF-29 encerrados, RF-25 reescrito, P-03 derrubada
- [ ] `tests/rastreabilidade.test.ts` com a contagem nova e o motivo escrito
- [ ] `src/db/seed.ts` gerando uma Tentativa por pessoa
- [ ] `npm run check`, `npm test` e `npm run orcamento` limpos
- [ ] `CONTEXT.md` com a decisão numerada, incluindo a dívida da coluna que fica
- [ ] Um cadastro de ponta a ponta feito à mão: inscrever, lançar tempo, ver na Classificação

---

## 8. O risco

**A cinco dias do evento, esta é a mudança mais perigosa do projeto**, e não pelo tamanho. É pequena. É perigosa porque toca as três telas que o evento usa, e porque chega depois de o sistema ter sido verificado.

O relatório de prontidão de 17/10 vale para o código de 17/10. **Depois deste trabalho, ele precisa ser refeito**, ao menos nos blocos 1 e 2.

Dois modos de falha a vigiar:

**Remover demais.** A tentação é limpar tudo que menciona Cockpit. A coluna fica, o constraint fica, e o valor 1 fica. Quem apagar a coluna cria uma migração que este PRD proíbe.

**Deixar um caminho morto.** Um botão que nunca aparece, uma aba com um item só, uma coluna constante no CSV. Cada um desses é algo que alguém vai encontrar no dia e tentar entender sob pressão.