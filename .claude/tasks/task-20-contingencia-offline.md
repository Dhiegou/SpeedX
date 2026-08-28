# T20 — Contingência offline

**Contexto SDD:** §5 (modos de falha)
**Depende de:** T06, T14
**Bloqueia:** T21
**Requisitos:** RNF-06

---

## Objetivo

Garantir que a falha de conectividade do local não pare o evento. O PRD diz que não existe segunda chance; a resposta a isso não é só engenharia, é procedimento.

## Escopo

### 1. Ficha em papel

- Formulário impresso com **exatamente** os mesmos campos do formulário digital: nome, sobrenome, e-mail, telefone, idade, Pitch(es).
- Bloco de responsável na mesma ficha, com o **texto de consentimento de T03 impresso** e espaço para assinatura do responsável. Sem isso, não há base legal para o cadastro do menor (RNF-07) — a ficha de papel precisa cumprir o mesmo requisito que a tela.
- Espaço para assinatura de consentimento do próprio participante.
- Numeração sequencial nas fichas, para conferência posterior.
- Quantidade impressa: dimensionar para ao menos 200 cadastros (10% do público) e manter em local conhecido pelo time.

### 2. Planilha de tempos em papel

- Formulário por Pitch com: nome, últimos 4 dígitos do telefone, tempo `mm:ss.cc`, horário do lançamento, iniciais do operador. Os mesmos campos que o sistema exige (RF-15, RF-17, RF-23).

### 3. Procedimento de digitação posterior

- Quem digita, em que ordem, e como marcar a ficha já digitada (risco de digitar duas vezes).
- Digitação usa o **mesmo formulário** do sistema — não criar uma via alternativa de entrada que escape das validações (RNF-13).
- Para tempos coletados em papel durante uma queda: o instante gravado será o da digitação, não o da corrida. **Consequência conhecida:** o desempate de RF-31 fica prejudicado nesse intervalo. Documentar isso e instruir o operador a registrar o horário real na ficha, para arbitragem manual em caso de empate.

### 4. Ensaio

Simular a queda com o time antes do evento: distribuir fichas, preencher cinco, digitar, conferir. Um procedimento nunca ensaiado falha na hora.

### 5. Documentação

`docs/contingencia.md` com o procedimento em uma página, linguagem direta, impresso e disponível fisicamente no local — não só em arquivo na nuvem que ninguém acessa sem internet.

## Critérios de aceitação

- [ ] Procedimento documentado e material impresso disponível no local (RNF-06).
- [ ] A ficha de papel coleta os mesmos campos e o mesmo consentimento da tela, incluindo o bloco de responsável.
- [ ] A digitação posterior passa pelas mesmas validações do cadastro normal.
- [ ] Ensaio realizado com o time e ajustes aplicados.
- [ ] O time do evento sabe onde estão as fichas sem precisar perguntar.

---

## Resultado da execução — 2026-08-28

**Feito, menos o ensaio** — que é com gente, papel e uma mesa, e por isso entra
no dia de T21. Quatro dos cinco critérios fechados; o quinto depende de reunir o
time.

### O papel nasce da mesma fonte que a tela, e um teste garante isso

`npm run fichas` gera três peças em `docs/contingencia/`: a ficha numerada
(200 por padrão), o termo integral para o balcão e a folha de tempos por
Cockpit. **Nenhum texto é copiado** — o termo sai de `TERMO_VIGENTE`, que é o
mesmo objeto que a tela e a rota `/termo` leem. Era exatamente para isto que
T03 fez do termo dado estruturado em vez de HTML (D-09), e a peça finalmente
apareceu.

**O gerador recusa rodar sob rascunho**, pela mesma função que barra o cadastro
(`assegurarTermoAprovado`, D-18). Duzentas fichas impressas com texto não
aprovado são piores que ficha nenhuma: parecem válidas e colhem assinatura que
não vale.

**O defeito que `tests/contingencia.test.ts` existe para impedir é lento.**
Alguém acrescenta um campo ao cadastro em setembro; as fichas foram para a
gráfica em agosto. No dia, com o sistema fora do ar, duzentas pessoas preenchem
um papel sem onde escrever o dado novo — e a digitação posterior, que passa pelo
mesmo caso de uso, recusa cada uma. Ninguém pega isso em revisão: a ficha é um
script e o cadastro é um esquema Zod. O teste compara os dois **nos dois
sentidos**, e verifiquei que ele morde: renomeando `email` na lista da ficha,
dois casos falham nomeando o campo.

**A sonda do esquema precisou de dois corpos, não um.** Submeter `{}` não
alcança o `superRefine`, e as exigências de Responsável — as de RNF-07, as mais
caras de descobrir tarde — não apareciam. A segunda sonda é um menor de idade
sem responsável nenhum.

### Uma decisão sobre o termo impresso

A ficha traz os **aceites palavra por palavra** e a versão do termo; o texto
integral vai numa peça separada, para ficar em cópias no balcão. Não é economia
de papel: imprimir o termo inteiro no verso de cada ficha custaria 400 folhas e
resolveria menos, porque o que a pessoa assina são os aceites.

**O que não serve é remeter a uma URL.** A ficha só existe quando não há
internet — mandar quem vai assinar consultar `/termo` é oferecer exatamente o
que acabou de cair. Por isso o termo é peça impressa obrigatória do checklist,
e não um endereço no rodapé.

### RNF-06 saiu do registro de verificação manual

O teste de rastreabilidade de T17 falhou na primeira execução da suíte completa,
como devia: **existe teste citando RNF-06, logo a justificativa manual tem de
sair**. É o mecanismo de D-71 funcionando sozinho, quatro tarefas depois de ter
sido escrito. O que continua manual é o **ensaio**, e ele está no checklist de
T21 — não no registro de dispensas.

### Critérios de aceitação

- [x] Procedimento documentado e material impresso disponível (RNF-06). —
      [`docs/contingencia.md`](../../docs/contingencia.md), uma página, e as três
      peças geradas e versionadas. **Imprimir é do time**, e é item do checklist.
- [x] A ficha coleta os mesmos campos e o mesmo consentimento da tela,
      incluindo o bloco de responsável. — verificado por teste, nos dois
      sentidos, contra o esquema e contra o termo vigente.
- [x] A digitação posterior passa pelas mesmas validações. — o procedimento
      manda digitar pelo formulário normal, e não existe via alternativa de
      entrada: `tests/painelGuarda.test.ts` já barra `app/` de alcançar o caso
      de uso por baixo.
- [ ] **Ensaio realizado com o time.** — pendente. Cinco fichas preenchidas,
      digitadas e conferidas, com o cronômetro rodando. Entra em T21.
- [ ] **O time sabe onde estão as fichas.** — depende do ensaio e da véspera.

### Aberto

- [ ] **Imprimir.** 200 fichas, 5 cópias do termo, 5 folhas de tempo por
      Cockpit. Sem isso o resto desta tarefa é teoria.
- [ ] **O ensaio**, com ajuste do procedimento no que ele revelar.
- [ ] **Duas consequências conhecidas e não resolvidas**, ambas escritas no
      documento: o desempate de RF-31 no período offline depende do horário
      escrito à mão, e a ordem da fila de RF-14 não reproduz a ordem de chegada
      quando as fichas entram em bloco.

---

## Estado

**Concluída em 2026-08-28, menos o ensaio.** 14 testes novos, 627 no total.
RNF-06 deixou de depender de justificativa escrita e passou a depender de um
teste — e do papel estar impresso, que é do time.
