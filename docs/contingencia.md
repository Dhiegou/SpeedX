# Contingência offline — o evento não para

**Imprima esta página e deixe junto das fichas** (T20, RNF-06).

Se a internet cair, o cadastro continua no papel e as corridas continuam sendo
cronometradas. O sistema entra depois. O que não pode acontecer é a fila parar
enquanto alguém tenta descobrir o que fazer.

---

## Antes do evento — checar uma vez

- [ ] **Fichas impressas**, ao menos 200 (`docs/contingencia/ficha-inscricao.html`)
- [ ] **Termo integral impresso**, 5 cópias, no balcão (`termo-impresso.html`)
- [ ] **Folhas de tempo**, 5 por Cockpit (`planilha-tempos.html`)
- [ ] **Canetas** — mais do que parece necessário
- [ ] Fichas e folhas guardadas em **um lugar só**, e o time inteiro sabe qual
- [ ] Ensaio feito: cinco fichas preenchidas, digitadas e conferidas

O material sai de `npm run fichas`. Abrir no navegador, Ctrl+P, A4, sem
cabeçalho nem rodapé do navegador.

---

## Quando a internet cai

### 1. Avise, não espere

Quem percebe fala em voz alta com o ponto de inscrição e com os dois Cockpits.
Não confira, não teste, não tente reiniciar nada antes de avisar. O procedimento
custa nada e desfazer custa nada; a fila parada custa o evento.

### 2. Inscrição passa para a ficha

- Uma ficha por pessoa, **na ordem numérica**. Não pule número.
- Escreva em letra de forma. Um e-mail ilegível é um cadastro perdido.
- **Menos de 18 anos: o bloco do responsável é obrigatório**, com assinatura.
  Sem ele, o cadastro não pode ser digitado — o sistema recusa, e está certo.
- Antes de assinar, ofereça o termo impresso. Ele está no balcão.
- Ficha preenchida vai para a **pilha de pendentes**, virada para baixo.

### 3. Tempos passam para a folha

Uma folha por Cockpit, uma linha por corrida.

**Escreva o horário real da corrida.** Quando esses tempos forem digitados, o
sistema vai registrar a hora da digitação, não a da corrida — e o desempate por
ordem de lançamento fica prejudicado nesse intervalo (RF-31). Se dois tempos
empatarem, é o horário escrito à mão que decide. Sem ele não há como arbitrar.

### 4. Quando a internet volta

**Não digite nada antes de conferir se o sistema está de pé.** Abra
`/api/saude`: se responder `ok`, pode começar.

---

## Digitação posterior

**Quem digita:** uma pessoa só, do começo ao fim, sem revezar. Duas pessoas na
mesma pilha é a receita para cadastro duplicado.

**Por onde:** pelo **formulário normal do sistema**, o mesmo que o participante
usaria. Não existe via alternativa de entrada, e é de propósito: a validação que
protege o cadastro de campo mal preenchido é a mesma que precisa proteger a
digitação (RNF-13).

**Em que ordem:** pela numeração das fichas, da menor para a maior. Depois as
folhas de tempo, na ordem das corridas.

**Como marcar:** ao terminar uma ficha, preencha o rodapé dela — nome de quem
digitou, data, hora — e marque `conferido`. **Ficha sem rodapé preenchido é
ficha não digitada.** Passe-a para a pilha de prontas, virada para baixo.

**Se o sistema recusar uma ficha:** separe-a numa terceira pilha e siga. Recusa
comum é idade de menor sem bloco de responsável assinado, e-mail ilegível ou
telefone com dígitos faltando. Resolva as separadas no fim, com calma, não no
meio da digitação.

**Ao terminar:** confira que a última ficha da pilha de prontas tem o número da
última ficha usada. Número faltando é ficha perdida, e é melhor descobrir na
mesma noite.

---

## O que este procedimento não resolve

- **O desempate do período offline** (RF-31). O sistema grava a hora da
  digitação. Empates daquele intervalo se resolvem pelo horário escrito na folha
  de tempo, à mão, por decisão de quem organiza.
- **A ordem de inscrição na fila** (RF-14). Fichas digitadas em bloco entram no
  sistema com carimbos próximos, então a fila do painel não reproduz a ordem em
  que as pessoas chegaram. Use a numeração da ficha para saber quem veio antes.
- **Cadastro duplicado** de quem preencheu ficha e depois se cadastrou sozinho
  quando a internet voltou. O sistema recusa e-mail repetido, então o segundo
  cadastro é o que falha — se acontecer, é sinal de que a ficha já foi digitada.

---

## Uma decisão que é de quem organiza, não de quem digita

Se a queda for longa e as fichas acabarem, **o evento continua**: anote os dados
em papel comum, com os mesmos campos, e transcreva para uma ficha numerada
depois. O que **não** pode faltar em nenhuma hipótese é a assinatura do termo —
sem ela não existe base legal para o cadastro, e o dado não pode ser digitado
nem guardado.
