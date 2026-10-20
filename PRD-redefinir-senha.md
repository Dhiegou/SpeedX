# PRD — Redefinir senha de Operador, e ver o que se digita no login

**Data:** 2026-10-20. **Faltam 4 dias para o evento.**
**Contexto SDD:** BC-04 Identidade e Acesso
**Requisitos:** RNF-14, RNF-16, RNF-18
**Escopo:** dois itens independentes. Podem entrar separados

---

## 1. Por que agora

As contas dos Operadores vão ser criadas esta semana, e cada pessoa testa a sua antes do dia. É nesse teste que as duas lacunas aparecem.

**Não existe redefinir senha.** Só `--desativar` e `--destravar`. Hoje, Operador que esquece a senha não tem conserto: a saída é criar uma segunda conta e deixar a primeira órfã no banco. A lacuna já está registrada em `o-que-falta-para-voce.md`.

**O campo de senha não tem como mostrar o que foi digitado.** A senha tem no mínimo 12 caracteres, o login acontece num tablet com a fila se formando, e **o limite é de 10 tentativas recusadas por janela**. Três erros de digitação num campo cego já comem um terço da cota, e quem erra não sabe se errou a senha ou a tecla.

Os dois são aditivos e não mexem em regra existente. Mas tocam a porta de entrada do painel, que é o caminho crítico do Operador no dia.

---

## 2. Item 1 · `--redefinir-senha`

### 2.1 O comando

```
npm run criar-operador -- --redefinir-senha marina
```

Mesma forma dos irmãos que já existem (`--desativar`, `--destravar`), no mesmo script, com o mesmo prompt oculto. A senha **não entra por argumento**, pelo motivo que o próprio arquivo já documenta: argumento aparece no histórico do shell e na lista de processos.

Reusa o que existe: `validarForcaDaSenha` e `gerarHash` de `senha.ts`, com o mínimo de 12 caracteres.

Se o usuário não existir, recusar dizendo isso. Não criar conta por engano.

### 2.2 A armadilha: redefinir sem destravar não resolve nada

**Quem esquece a senha quase sempre já tentou até travar.** O limite é `LOGIN_TENTATIVAS_POR_JANELA=10`, por IP e por usuário, e ele **conta a falha**. A pessoa que errou dez vezes está bloqueada pela janela inteira.

Se `--redefinir-senha` trocar só o hash, a pessoa continua sem entrar, agora com a senha certa, e ninguém entende por quê. No dia do evento isso vira um chamado com a fila parada.

**Redefinir deve destravar junto.** `destravarLogin` já existe e é exatamente isto. Na prática as duas operações andam sempre juntas, e separá-las só cria um jeito de errar.

A saída do comando deve dizer as duas coisas que fez, não só uma.

### 2.3 A decisão: as sessões ativas caem

**Redefinir senha encerra todas as sessões do Operador.** A tabela `sessao` tem `encerradaEm` exatamente para isso, e o esquema documenta que a sessão mora no banco, em vez de num cookie autocontido, justamente para comprar revogação.

Por que esse é o padrão certo, e não o contrário:

- **No caso comum não custa nada.** Quem esqueceu a senha não está logado; é por isso que está pedindo a redefinição.
- **No caso raro é o que salva.** Se a redefinição acontece porque a senha vazou, deixar a sessão viva anula a redefinição inteira.

Custo quando atrapalha: o Operador precisa entrar de novo no tablet, o que leva segundos. Aceitável, e preferível ao inverso.

**Não criar uma opção para manter as sessões.** Quatro dias antes do evento, uma alavanca a mais é uma forma a mais de errar sob pressão.

### 2.4 Registro

A operação precisa deixar rastro no log, como as outras de identidade, **sem a senha e sem o hash**. Quem redefiniu, para quem, e quando.

---

## 3. Item 2 · Mostrar a senha no login

### 3.1 O que é

Um botão ao lado do campo de senha em `/painel/login`, que alterna entre esconder e mostrar o que foi digitado.

**Começa sempre escondido**, em toda abertura de página. O estado não é lembrado entre visitas: nem cookie, nem armazenamento de navegador. Mostrar senha é decisão para aquele momento, não preferência a guardar.

### 3.2 O botão é texto, não ícone

O projeto proíbe ícone baixado e biblioteca de ícones (RNF-04, e o sistema visual repete isso). Então **nada de ícone de olho vindo de pacote**.

Use texto: **Mostrar** e **Ocultar**. É mais leve, é mais claro, e funciona em leitor de tela sem rótulo extra.

### 3.3 O que não pode quebrar

| regra                                                             | por quê                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `<button type="button">`                                          | Sem `type`, o botão submete o formulário e tenta logar com a senha incompleta           |
| `autoComplete="current-password"` fica no input, nos dois estados | Trocar o `type` já confunde gerenciador de senha; tirar o `autoComplete` junto piora    |
| Alvo de toque de 44px                                             | RNF-18. O login acontece em tablet                                                      |
| `var(--foco)` no anel de foco                                     | O painel é operado por teclado, e `login.module.css` já usa o anel comum em dois pontos |
| Nenhuma cor literal no módulo CSS                                 | `tests/sistemaVisual.test.ts` recusa, e é teste, não convenção                          |
| O estado precisa ser anunciado                                    | `aria-pressed`, ou o texto do botão mudando, que já é anúncio suficiente                |

### 3.4 O que o botão não pode fazer

**Não mexer na mensagem de erro.** O formulário hoje responde "Usuário ou senha incorretos", sem distinguir os dois, e não valida tamanho de senha na tela. Isso é deliberado: validar "senha muito curta" contaria a quem sonda qual é o mínimo do painel. O botão de mostrar não muda nada disso.

**Não aparecer em outro lugar.** O campo de senha existe só aqui. Nada de levar o mesmo controle para o formulário de inscrição, que não tem senha.

### 3.5 Vale lembrar do ambiente

O Operador faz login num balcão, com gente em volta. Mostrar a senha na tela é exposição real, e é por isso que o padrão é escondido e o estado não é lembrado.

Ainda assim o botão compensa: com 12 caracteres mínimos, um campo cego e dez tentativas até travar, o risco de ficar de fora é maior que o de alguém ler por cima do ombro em um clique deliberado.

---

## 4. Item 3 · Verificar e registrar como a senha é guardada

A pergunta que originou este item: a senha é criptografada, dá para invadir o painel, e alguém consegue mudar o tempo de um piloto?

**Li o código antes de escrever esta seção, e o que está lá é forte.** Por isso a tarefa aqui é **verificar e deixar registrado**, não construir segurança nova. Mexer em autenticação a quatro dias do evento, num código que já está correto, é trocar risco conhecido por risco desconhecido.

### 4.1 O que já existe, e o agente precisa confirmar

**A senha nunca é guardada.** O que vai para o banco é um hash `scrypt`, que é função de mão única: não existe caminho de volta. Nem quem lê o banco inteiro recupera a senha.

| item                  | o que está no código                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| Algoritmo             | `scrypt`, N=2^16, r=8, p=1                                                     |
| Custo por conferência | 64 MiB de memória, cerca de 0,2 s                                              |
| Sal                   | 16 bytes aleatórios, por senha                                                 |
| Comparação            | `timingSafeEqual`, tempo constante                                             |
| Parâmetros            | guardados junto do hash, para trocar o custo depois sem invalidar o que existe |
| Tamanho mínimo        | 12 caracteres                                                                  |

Scrypt é caro em memória de propósito. Os 64 MiB por tentativa são irrelevantes para meia dúzia de logins por dia e inviabilizam quem tenta adivinhar em escala.

**Duas defesas que vão além do hash**, e que valem ser confirmadas porque é incomum alguém se dar ao trabalho:

O login gasta **o mesmo tempo para usuário que existe e para usuário que não existe**, usando um hash-fachada (`gastarTempoDeConferencia`). Sem isso, um relógio enumeraria quais contas existem, porque "não existe" responde em microssegundos e "senha errada" em 200 ms.

A sessão **não guarda o token**: guarda o HMAC dele. O cookie leva 32 bytes aleatórios, é `httpOnly`, `Secure` em produção, `SameSite=Lax` e usa o prefixo `__Host-`, que o navegador impõe. Quem lê a tabela `sessao` não consegue forjar um cookie.

### 4.2 Quem consegue mudar o tempo de um piloto

Esta parte merece resposta honesta, porque a proteção é diferente para cada caso.

**De fora, ninguém.** Toda rota de escrita do painel passa por `exigirOperadorNaApi`, e a auditoria de 17/10 confirmou contra o ambiente publicado: nove rotas responderam 401 sem cookie. Nenhuma consulta parte do navegador do participante, que é restrição estrutural do SDD.

**De dentro, o Operador autenticado consegue, e isso é de propósito.** RF-22 existe para corrigir um tempo digitado errado, o que vai acontecer num evento com gente digitando sob pressão.

A proteção nesse caso não é impedir, é **registrar**. Cada lançamento e cada correção grava em `lancamento`: quem fez, quando, o valor anterior e o novo. O instante é o do relógio do servidor, nunca o do dispositivo. Uma correção não apaga nada, acrescenta uma linha.

Então a resposta certa à pergunta é: **contra estranho, prevenção; contra Operador, prestação de contas.** Esse é o modelo correto aqui, e é deliberado.

### 4.3 Os limites, que também precisam ficar escritos

Segurança sem limite declarado é promessa vazia. Quatro coisas que o sistema **não** faz:

- **Não há segundo fator.** Uma senha forte é o que separa o painel de quem a descobrir.
- **A sessão dura 16 horas sem uso.** Escolhido para cobrir a jornada do evento. Tablet perdido com sessão aberta é acesso ao painel até alguém encerrar a sessão no banco.
- **Quem tem a `DATABASE_URL` tem tudo.** É a fronteira real de confiança: cria Operador, lê a base inteira, muda o que quiser. O próprio `--redefinir-senha` deste PRD é autorizado por isso e por nada mais.
- **O limite de 10 tentativas é por janela, por IP e por usuário.** Freia força bruta, não elimina.

Nenhum desses é defeito a corrigir nesta semana. São escolhas, e o valor de escrevê-las é que ninguém descobre no dia achando que era outra coisa.

### 4.4 O que o agente faz aqui

- Confirmar cada linha da tabela de 4.1 contra o código, e corrigir esta seção se algo divergir
- Confirmar que `--redefinir-senha` usa `gerarHash`, e **não** escreve a senha em log, em erro ou em qualquer lugar
- Registrar o resumo em `docs/`, em linguagem que o organizador entenda, para a pergunta ter resposta escrita na próxima vez
- **Não alterar parâmetro de scrypt, atributo de cookie, duração de sessão nem limite de tentativas**

---

## 5. Fora de escopo

| item                                                    | por quê                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tela de administração de contas                         | RNF-14: não existe criação de conta pelo sistema, e isso não muda                        |
| Redefinição pelo próprio Operador, por e-mail ou link   | Exigiria rota pública de recuperação, que é superfície nova numa semana que não comporta |
| Medidor de força de senha no login                      | O login confere senha existente; força se valida na criação                              |
| Mostrar senha em qualquer outra tela                    | Só existe campo de senha no login                                                        |
| Qualquer mudança em como a sessão é criada ou conferida | Área sensível, sem motivo para tocar                                                     |

---

## 6. Critérios de aceitação

- [ ] `npm run criar-operador -- --redefinir-senha <usuario>` troca a senha, com prompt oculto e mínimo de 12
- [ ] Usuário inexistente é recusado com mensagem clara, sem criar conta
- [ ] A redefinição **destrava** o login do usuário na mesma operação
- [ ] A redefinição **encerra as sessões ativas** daquele Operador
- [ ] A saída do comando diz as três coisas que fez
- [ ] Log sem senha e sem hash
- [ ] O login tem botão Mostrar/Ocultar, em texto, começando escondido
- [ ] O estado não sobrevive a um recarregamento, e não é guardado em lugar nenhum
- [ ] `type="button"`, 44px, `var(--foco)`, nenhuma cor literal
- [ ] A mensagem de erro do login continua idêntica
- [ ] Teste do caminho completo: redefinir, confirmar que a senha velha não entra, que a nova entra, e que a sessão anterior morreu
- [ ] `npm run check`, `npm test` e `npm run orcamento` limpos
- [ ] `o-que-falta-para-voce.md` sem a lacuna de redefinição
- [ ] Tabela de 4.1 conferida linha a linha contra o código
- [ ] Confirmado que a redefinição não escreve a senha em log nem em mensagem de erro
- [ ] Resumo de segurança escrito em `docs/`, em linguagem para o organizador
- [ ] Nenhum parâmetro de scrypt, cookie, sessão ou limite de tentativas alterado
- [ ] `CONTEXT.md` com a decisão numerada

---

## 7. O risco

**O item 1 mexe em autenticação, que é onde erro silencioso custa mais caro.** Um defeito aqui não aparece em tela: aparece como alguém que não consegue entrar, ou pior, como alguém que entra quando não devia.

O caminho completo precisa de teste automatizado, não de conferência manual. Em particular: **a senha velha tem que parar de funcionar.** É o teste óbvio e o mais fácil de esquecer.

**O item 2 é interface e tem risco baixo, com uma exceção:** o botão sem `type="button"` submete o formulário. É o defeito mais comum desse controle, e ele se manifesta como um login que falha sozinho ao clicar em Mostrar.

Os dois são aditivos. Se o tempo apertar, **o item 1 é o que tem consequência operacional** e deve ir primeiro: sem ele, Operador que esquece a senha vira conta duplicada no dia do evento.
