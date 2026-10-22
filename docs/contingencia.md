# Contingência — quando a internet cai, e não há papel

**Decidido em 21/10/2026: não haverá material impresso neste evento** (D-113).

Até esse dia, esta página descrevia o plano B em papel de T20 (RNF-06): fichas
numeradas para o cadastro, folha de tempos para o Cockpit e digitação depois.
Esse plano saiu, e **ninguém deve procurar ficha no dia**. O procedimento antigo
continua no histórico do git deste arquivo, e `npm run fichas` continua gerando
o material, para um próximo evento.

---

## O que a decisão custa

O papel existia para um cenário nomeado: **a internet cai no local**. Sem ele,
esse cenário não tem plano B:

- **Cadastro.** Quem não tem sinal no próprio celular não consegue se inscrever
  até a rede voltar.
- **Lançamento de tempo.** Se o painel do Operador perder a conexão durante a
  corrida, não há onde anotar o tempo. O painel guarda **o lançamento em curso**
  e o reenvia sem duplicar quando a rede volta (FL-06), mas guarda só um.

É decisão do organizador, registrada. O que esta página faz é dizer o que fazer
quando acontecer, para ninguém perder tempo procurando um procedimento que não
existe.

---

## Quando a internet cai

### 1. Avise, não espere

Quem percebe fala em voz alta com o ponto de inscrição e com o Cockpit. Não
confira, não teste, não tente reiniciar nada antes de avisar.

### 2. Pause a fila do Cockpit

**Não deixe ninguém correr sem conseguir lançar.** Uma volta corrida sem
lançamento é um tempo que se perde, e não há onde anotá-lo. Quem está na vez
espera a rede voltar.

Se o Operador estava no meio de um lançamento, **não cancele**: o painel mostra
o erro com o botão Repetir, e o tempo digitado continua ali.

### 3. Confira antes de retomar

Quando a rede voltar, abra `/api/saude`. Se responder `ok`, retome a fila. Se o
painel mostrava Repetir, aperte Repetir primeiro.

### 4. Quem decide estender a pausa é o organizador

Se a queda for longa, a decisão de esperar, adiar ou encerrar é de quem
organiza (ver [`plano-do-dia.md`](plano-do-dia.md), "Quem é acionado").
