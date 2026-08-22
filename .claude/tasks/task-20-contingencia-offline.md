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
