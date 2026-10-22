# PRD — Número de inscrição: a pessoa se acha entre homônimos

**Data:** 2026-10-21. **Faltam 3 dias para o evento.**
**Contexto SDD:** BC-01 Inscrição, BC-03 Classificação
**Origem:** com 2000 participantes, dois "Dhiego Ferreira" na classificação são indistinguíveis. Entre menores é pior, porque RNF-09 abrevia o sobrenome e "João S." colide com facilidade
**Este PRD tem migração.** É o primeiro em três semanas, e a §2 explica por que não dá para evitar

---

## 1. O que se constrói

Cada Participante recebe um **número sequencial** na inscrição: 0001, 0002, e assim por diante.

| onde                | o quê                                              |
| ------------------- | -------------------------------------------------- |
| Tela de confirmação | o número, em destaque, como a informação principal |
| Classificação       | **buscável, não exibido**. Ver §3                  |
| Painel              | buscável também. Ganho operacional, ver §4         |
| Exportação          | coluna própria                                     |

---

## 2. Por que é coluna no banco, e não derivado

A tentação é calcular o número pela ordem de `inscritoEm`, o que evitaria a migração.

**Não funciona, e o motivo é a LGPD.** O termo promete exclusão a pedido, a qualquer momento. Se alguém exercer esse direito e a numeração for derivada da ordem, **todos os inscritos depois dela mudam de número**. Quem anotou 0847 passa a ser 0846, e o número que a pessoa guardou deixa de valer.

Um identificador que muda não é identificador. Então: coluna, com sequência do Postgres.

**Invariantes:**

- atribuído no `insert`, nunca depois
- único, e **nunca reaproveitado**. Número de quem foi excluído fica vago para sempre
- estável: nada no sistema reatribui número
- inteiro no banco; os zeros à esquerda são formatação de exibição

**Sobre a migração.** `docs/deploy.md` §3 avisa: migração exige a string **direta** do Neon, sem `-pooler`. PgBouncer em modo transação não repassa o que uma migração precisa. Rodar pela string errada falha no meio, e o meio de uma migração é o pior lugar para falhar.

A tabela tem pouquíssimas linhas hoje, então a migração em si é trivial. O cuidado é com a string.

---

## 3. A decisão de não exibir, e o que ela não faz

**Não exibir na tabela está certo**, e por um motivo concreto: a classificação tem quatro colunas e nenhuma pode ser cortada em 360px (RNF-18). Uma quinta coluna aperta a tela de quem está na arquibancada.

**Mas não exibir não é não transmitir, e isso precisa estar claro.**

A busca da classificação roda **inteiramente no navegador**, sobre o documento já baixado. Isso é decisão estrutural do SDD: uma requisição por tecla digitada, com 2000 pessoas buscando ao mesmo tempo, é o cenário que derruba o sistema.

Para o navegador buscar por número, **o número precisa estar no documento**. Ele vai estar no JSON de `/api/classificacao`, visível para quem abrir as ferramentas do navegador.

**Isso é aceitável, e não muda o risco de privacidade.** O número é arbitrário, não deriva de nada pessoal, e está ao lado de um nome que já é público por decisão do termo. Não revela idade, telefone nem e-mail. O que ele acrescenta ao documento é a ordem de inscrição, e o total já é exibido na tela.

O que **não** se deve fazer é prometer a alguém que o número é privado. Ele não é.

**Como funciona na prática:** a pessoa digita 0847 na busca, a linha dela é destacada, e ela vê a própria posição. O número nunca aparece na tabela, mas a busca o encontra.

A busca hoje destaca em vez de esconder, mantendo as posições vizinhas em volta (RF-30). **Esse comportamento fica.** Buscar por número cai no mesmo caminho da busca por nome.

Não há ambiguidade entre os dois tipos de busca: o validador de nome aceita só letras, espaço, hífen e apóstrofo, então nenhum nome contém dígito.

---

## 4. O painel também ganha a busca por número

Não estava no pedido, e é o item de melhor retorno deste PRD.

Hoje o Operador acha a pessoa digitando o nome, e homônimo é exatamente o caso em que isso custa tempo: aparecem dois, e ele confere pelos quatro últimos dígitos do telefone antes de lançar.

Com o número, a pessoa chega e diz "sou o 847". **Uma busca, um resultado, sem conferência.** RNF-16 dá 15 segundos para o lançamento inteiro, e isso devolve alguns.

---

## 5. Orçamento, que precisa ser medido

O documento público ganha um campo por linha. Com 2000 participantes, a estimativa grosseira é 8 a 10 KB bruto, talvez 4 KB comprimidos, sobre uma base que era de 14 KB gzip para 3227 linhas.

**Não aceite a estimativa.** Rode `npm run orcamento` e o de carga antes e depois, e registre os dois números. RNF-01 é o requisito em jogo.

Se o custo surpreender, há saída: transmitir o número **apenas nas linhas cujo nome público se repete**, que são as únicas onde ele serve para alguma coisa. Fica como plano B, não como primeira tentativa.

---

## 6. Fora de escopo

| item                                        | por quê                                                                                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enviar o número por e-mail ou WhatsApp      | Gratuito de qualquer provedor dá 100 a 300 e-mails por dia, contra 2000 participantes. E sem domínio verificado a entrega é ruim. A tela de confirmação entrega melhor |
| Exibir o número na tabela                   | Decisão tomada: aperta 360px                                                                                                                                           |
| Mudar o termo                               | Número de inscrição não é dado pessoal novo e não muda finalidade declarada. **Nenhuma versão nova**                                                                   |
| Qualquer coisa em papel                     | **Decidido em 21/10: não haverá material impresso.** Ver §6.1                                                                                                          |
| Numerar o que já existe de forma retroativa | Há um participante de teste em produção, que deveria ser apagado de qualquer modo                                                                                      |

---

### 6.1 A decisão de não imprimir, e o que ela custa

O material de contingência existia para um cenário nomeado: **a internet cai no local e o cadastro para.** Sem papel, esse cenário não tem plano B, e o mesmo vale para o painel: se ele cair durante a corrida, não há onde anotar tempo.

Isso é decisão do organizador, e está registrada. O que **não** pode ficar é a documentação descrevendo um procedimento que não existe: `docs/plano-do-dia.md` e `docs/contingencia.md` mandam pegar fichas que ninguém vai imprimir. Alguém lendo isso sob pressão no dia perde tempo procurando.

**Atualizar os dois documentos faz parte deste trabalho.** O código que gera as fichas fica onde está: removê-lo a três dias é risco sem retorno, e ele volta a ser útil num próximo evento.

## 7. Critérios de aceitação

- [ ] Coluna criada por migração, com sequência, única e não reaproveitável
- [ ] Migração rodada com a string **direta** do Neon, não a do pooler
- [ ] Número atribuído no `insert`, e nenhum caminho de código o reatribui
- [ ] Tela de confirmação mostra o número em destaque, com quatro dígitos
- [ ] Classificação: número **no documento**, buscável, **não renderizado**
- [ ] Buscar por número destaca a linha e mantém as vizinhas (RF-30)
- [ ] Busca do painel aceita número
- [ ] Exportação com a coluna
- [ ] `npm run orcamento` antes e depois, com os dois números registrados
- [ ] Teste: excluir um participante **não** muda o número de ninguém
- [ ] `npm test` e `npm run check` limpos
- [ ] `plano-do-dia.md` e `contingencia.md` sem mandar usar papel
- [ ] `CONTEXT.md` com as decisões numeradas: o número não é derivado, e não haverá papel

---

## 8. O risco

**Este é o primeiro PRD com migração em três semanas, e chega a três dias do evento.** A migração em si é pequena, mas o caminho tem uma armadilha documentada: a string do pooler.

O segundo risco é mais sutil. **Um número que muda é pior que número nenhum**, porque a pessoa confia nele. O teste de exclusão do critério de aceitação existe por isso, e não é formalidade: é a prova de que a escolha de coluna em vez de ordem derivada foi implementada de verdade.

Se o tempo apertar no dia, o que não pode faltar é o número na confirmação e a busca na classificação. O painel, a exportação e o papel são ganho, não requisito.
