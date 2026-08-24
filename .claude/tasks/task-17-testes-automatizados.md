# T17 — Testes automatizados

**Contexto SDD:** transversal
**Depende de:** T04 em diante (acompanha cada tarefa)
**Bloqueia:** T21
**Requisitos:** as *Verificações* de cada RF/RNF do PRD §5 e §6

---

## Objetivo

Transformar cada linha de *Verificação* do PRD em teste executável. O PRD já escreveu a suíte: cada requisito traz o critério de verificação. Esta tarefa é a tradução literal disso.

## Estrutura

| Camada | Ferramenta | Cobre |
|---|---|---|
| Unidade | Vitest | domínio de Inscrição (T04), máquina de estados de Cronometragem (T09), `parseTempo`/`formatTempo`, `paraNomePublico` |
| Integração | Vitest + banco de teste | endpoints, transações, invariantes do banco, concorrência, idempotência |
| End-to-end | Playwright | fluxo de cadastro, fluxo de lançamento por teclado, classificação |

## Casos obrigatórios

### Inscrição
- Idades de fronteira: 12 (rejeita), 13, 17, 18, 19 — bloco de responsável presente só em 13 e 17 (RF-04, RF-05).
- Menor sem bloco completo rejeitado (RF-06).
- Idade corrigida de menor para maior descarta dados do responsável (RF-07).
- Envio sem aceite rejeitado (RF-08).
- Sem Pitch rejeita; um e dois Pitches aceitam (RF-03).
- **Requisição forjada fora do navegador** burlando toda validação de tela é rejeitada (RNF-13).
- Reenvio com mesma chave de idempotência não duplica (FL-03).
- Limite de taxa dispara 429 (RNF-12).

### Cronometragem
- `01:23.45` aceito e reexibido idêntico (RF-17).
- Nenhuma gravação sem etapa de confirmação (RF-18) — teste e2e.
- Cinco lançamentos consecutivos apenas com teclado (RF-19) — teste e2e sem eventos de mouse.
- Campos limpos e foco devolvido após gravar (RF-20).
- Ausente sai da Fila, permanece na exportação, não aparece na Classificação (RF-21).
- Correção substitui valor e reflete na Classificação (RF-22).
- Autor e instante consultáveis (RF-23).
- Adicionar Pitch mantém registro pessoal único (RF-24).
- Segundo lançamento no mesmo Pitch bloqueado ou tratado como correção (RF-25).
- **Concorrência:** dois operadores lançando ao mesmo tempo na mesma Pitch não se sobrescrevem (RF-12).

### Classificação
- Abre em sessão anônima (RF-26).
- Resposta contém exatamente os cinco campos e nada mais (RF-27).
- Dois tempos do mesmo participante geram duas linhas (RF-28).
- Filtro por Pitch renumera a partir de 1 (RF-29).
- Busca localiza e destaca (RF-30).
- Empate resolvido pelo lançamento mais antigo, de forma estável e repetível (RF-31).
- Indicador de atualização e botão manual (RF-32).
- Posições 1–100 visíveis; 101 alcançável (RF-33).
- **Teste de vazamento:** varrer toda resposta pública procurando e-mail, telefone, idade, nome de responsável e sobrenome de participante **menor de 18** da massa de teste — falha se encontrar qualquer um (RNF-08, RNF-09 revisado em D-21).

### Acesso e custódia
- Painel sem sessão bloqueado (RF-11).
- Exportação anônima negada (RF-35).
- Exportação contém todos os registros, inclusive ausentes (RF-34).
- Não existe caminho público de criação de conta (RNF-14).

## Regras da suíte

- Banco de teste real (não mock) para os testes de integração — as invariantes de T02 estão no banco e precisam ser exercitadas.
- Massa de teste determinística, com homônimos e acentos.
- Testes de concorrência executam requisições genuinamente paralelas.
- A suíte roda em CI a cada pull request (T01) e bloqueia merge.

## Critérios de aceitação

- [ ] Existe ao menos um teste nomeado por requisito, referenciando o código do requisito no nome do teste (ex.: `RF-07 — idade corrigida descarta responsável`).
- [ ] Toda *Verificação* do PRD §5 tem teste correspondente, ou justificativa registrada quando só puder ser verificada manualmente (ex.: RNF-15, teste cronometrado com pessoas).
- [ ] O teste de vazamento de dado pessoal roda em CI.
- [ ] A suíte completa roda em menos de 10 minutos.

---

## Resultado da execução — 2026-08-24

| Arquivo | Papel |
| --- | --- |
| `tests/rastreabilidade.test.ts` | Lê o PRD, varre os nomes de teste, exige justificativa escrita para o que sobra |
| `playwright.config.ts` | Dois projetos: desktop e celular de 360 px |
| `e2e/apoio/preparar.ts` | Banco próprio do e2e, recriado do zero |
| `e2e/apoio/dados.ts` | Massa nomeada: cinco pendentes, uma menor, uma adulta classificada |
| `e2e/painel.spec.ts` | RF-11, RF-18, RF-19, RF-20 — com vigia de ponteiro |
| `e2e/cadastro.spec.ts` | RF-02, RF-03, RF-05, RF-07, RF-08, RF-10 |
| `e2e/classificacao.spec.ts` | RF-26, RF-27, RF-30 e o teste de vazamento |
| `e2e/telaPequena.spec.ts` | RNF-18, em 360 px |
| `docs/testes.md` | O mapa da suíte e o que só se verifica com gente |

### A T17 não era escrever testes; era provar que eles existem

O PRD já tinha escrito a suíte — cada RF e RNF traz a linha *Verificação*, e a
maior parte já estava coberta desde T04. O que não existia era **algo que
percebesse a ausência**: um requisito entra no PRD, ninguém escreve o teste, e
nada no mundo reclama até a auditoria de T21 achar o buraco tarde.

`rastreabilidade.test.ts` é esse algo, e ele pagou por si na primeira execução:

- **recusou duas justificativas minhas.** Eu havia registrado RF-01 e RF-09 como
  verificação manual. Os dois já tinham teste — a parte automatizável de cada um
  —, e o resíduo (escanear com três leitores, assinatura do organizador) é item
  de checklist, não ausência de teste. A trava que recusa justificativa para
  requisito coberto existe justamente para o registro não virar depósito de
  dispensas que ninguém revisita;
- **apontou RNF-18 como o único requisito de fato descoberto** entre os 53.

### RNF-18 deixou de depender de aparelho

Era um dos critérios que o projeto vinha carregando como "precisa de celular".
Não precisa: 360 px é uma largura, e um navegador sabe ser 360 px de largura. O
que depende de aparelho é o toque, a rede e a leitura sob sol — esses continuam
em T21.

O teste mede a sobra de largura do documento e, quando falha, **nomeia o
elemento que estourou**. Uma captura de tela exigiria alguém para olhar, e
ninguém olha na terça depois do deploy.

### O banco do e2e: duas tentativas descartadas antes da que ficou

1. **Criar `speedx_e2e` com o papel da aplicação.** "Permissão negada ao criar
   banco de dados" — e está certo assim: é o mesmo papel que vai para produção,
   e ele não deve poder criar banco.
2. **Isolar por esquema, com `search_path`**, para não precisar de privilégio
   nenhum. Morreu em `CREATE TYPE "public"."estado_tentativa"`: o SQL gerado
   pelo drizzle-kit é **qualificado com `public`**, então as migrações ignoram o
   `search_path`. Reescrever o SQL em execução resolveria e trocaria a coisa que
   mais importa — exercitar as migrações exatas de produção — por conveniência.

Ficou o banco separado, com um privilégio a conceder uma vez, e a mensagem de
erro diz isso por extenso para quem esbarrar nela daqui a seis meses. No CI o
serviço de Postgres já sobe com superusuário e nada disso é necessário.

### Três defeitos meus que a primeira execução do e2e revelou

Nenhum era do produto; os três eram do teste, e os três valem registro porque
são armadilhas que se repetem.

**1. A busca da Fila é do servidor.** Eu digitava e apertava Enter em seguida; o
Enter seleciona `itens[indice]` da lista **em memória naquele instante**, que
ainda era a anterior. O teste selecionava outra pessoa e falhava dizendo que o
campo de tempo de Alice não existia — quando o que existia era o campo de tempo
de outra. Esperar a linha certa aparecer não bastaria: ela aparece enquanto a
lista antiga ainda está lá. O que prova que o filtro chegou é a **quantidade**.

**2. Gravar limpa a busca — é metade do que RF-20 pede.** Meu laço digitava o
termo uma vez e esperava a Fila continuar filtrada nas cinco voltas. A sequência
real é redigitar a cada lançamento, e escrevê-la de outro jeito testaria um
fluxo que não existe. O teste passou a conferir o campo vazio a cada volta, o
que **fortaleceu** a cobertura de RF-20.

**3. `click` não é evento de mouse.** O vigia de ponteiro acusou seis eventos
numa execução em que o mouse não foi tocado: `Enter` num botão focado **ativa**
o botão, e o navegador emite um `click` com `isTrusted` verdadeiro. Contá-lo
tornaria RF-19 impossível de passar justamente operando por teclado. O que
denuncia o ponteiro são `pointerdown`, `mousedown` e `mouseup` — mais um
`click` com `detail` maior que zero, porque ativação por teclado traz zero.

### Medições

| | resultado |
| --- | --- |
| Unidade e integração | **594 testes em 79 s** (critério: 10 min) |
| Ponta a ponta | **19 testes em 42 s**, um worker, em série |
| Requisitos do PRD | 53 — 48 com teste que os cita, 4 com justificativa escrita |
| Navegador | só Chromium; três motores triplicariam o tempo pelas mesmas perguntas |

### Critérios de aceitação

- [x] Existe ao menos um teste nomeado por requisito, citando o código no nome. — e agora isso é **verificado por teste**, não por leitura: `rastreabilidade.test.ts` falha se um requisito ficar descoberto.
- [x] Toda *Verificação* do PRD §5 tem teste, ou justificativa registrada. — quatro justificativas (RNF-04, RNF-05, RNF-06, RNF-15), todas com o porquê por extenso e todas no checklist de T21. O teste recusa justificativa curta, órfã ou obsoleta.
- [x] O teste de vazamento roda em CI. — nas duas pontas: sobre a resposta de `/api/classificacao` na suíte de integração, e sobre o **HTML inteiro** da página no e2e, que é onde o estado de hidratação do React apareceria.
- [x] A suíte completa roda em menos de 10 minutos. — 79 s de unidade e integração, mais 42 s de e2e num job separado.

### Aberto

- [ ] **RNF-04, RNF-05, RNF-06 e RNF-15** continuam dependendo de rede real, do dia do evento, de T20 e de gente com cronômetro. As justificativas estão em `rastreabilidade.test.ts`, onde o teste as obriga a existir, e todas no checklist de T21.
- [ ] **O e2e roda contra `next dev`.** Contra o artefato de produção seria mais fiel e mais lento; a diferença que importa para RF-18, RF-19 e RNF-18 é nenhuma. Reavaliar em T19, quando existir um alvo publicado para apontar.
- [ ] **Um privilégio a conceder em máquina nova:** `alter role speedx createdb`. Nesta máquina o banco foi criado à mão, então a suíte roda mas não se recria sozinha.

## Estado

**Concluída em 2026-08-24.** 5 testes de rastreabilidade e 19 de ponta a ponta;
613 no total (594 + 19). Desbloqueia **T21**, que agora tem a lista de
verificações manuais escrita e mantida por um teste.
