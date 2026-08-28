# T22 — Renomear `pitch` para `cockpit` no código e no banco

**Contexto SDD:** §3 (linguagem ubíqua) · alcança BC-01, BC-02, BC-03 e BC-05
**Depende de:** D-75 (o termo oficial é Cockpit)
**Bloqueia:** —
**Requisitos:** nenhum novo. É dívida de linguagem, não de comportamento.

---

## Objetivo

Fazer o identificador interno dizer a mesma palavra que a tela.

Em 2026-08-25 o organizador fechou PE-01: o termo é **Cockpit**, porque o evento
é de simulador e não existe pista física. A troca da palavra visível custou duas
linhas (D-31 pagou por si), e a decisão registrada naquele momento foi **manter
`pitch` como identificador interno** — coluna, campo de API, tipo de domínio —
para não gastar uma migração com algo que ninguém lê.

O usuário discordou no mesmo dia, e tinha razão. O argumento que decide não é o
custo da migração; é quem lê o nome da coluna. Quem depura às sete da noite do
dia 24 de outubro, com a fila parada, lê `tentativa.pitch` numa tela e "Cockpit
2" na outra e precisa parar para confirmar que são a mesma coisa. Duas palavras
para o mesmo conceito é exatamente o que a linguagem ubíqua existe para impedir
(SDD §3) — e é barato agora, seis semanas antes, com a base ainda sendo massa de
teste.

## Escopo

### 1. Banco

- Coluna `tentativa.pitch` → `tentativa.cockpit`.
- Constraint `tentativa_participante_pitch_unica` → `..._cockpit_unica` (RF-25).
- Constraint `tentativa_pitch_valido` → `tentativa_cockpit_valido`.
- Migração por **`RENAME`**, nunca por `DROP` + `ADD`.

### 2. Código

- Tipos `Pitch`, `FiltroDePitch`, `SituacaoDoPitch`, `ResumoDePitch`.
- Campos `pitch` e `pitches` em modelos, contratos, esquemas Zod e serializadores.
- Parâmetro de consulta `?pitch=` e corpo `{ pitch }` das rotas do painel.
- Funções e estado de interface: `setPitch`, `trocarPitch`, `alternarPitch`,
  `incluirNoPitch`, `filaDoPitch`, `pitchInicial`.
- Classe CSS `.pitch` da tabela da Classificação.

### 3. O que **não** entra

- **O texto do termo de consentimento.** `v1.0-2026-08-19` está aprovada por
  escrito (D-17, `docs/aprovacao-termo.md`) e diz "a pista, o tempo e o horário".
  Mudar o texto é mudar a versão, e versão nova nasce rascunho — sob rascunho
  nenhum consentimento pode ser registrado (D-18). Fica para uma decisão do
  organizador, não para uma varredura.
- **O PRD.** É o documento de requisitos, escrito antes; ele diz "pista" e o SDD
  §3 já registra a divergência. Reescrevê-lo apagaria a origem da confusão.
- **O histórico das tasks e das sessões.** São registros datados.
- **As migrações já aplicadas** (`0000` a `0003`). História não se reescreve.

## Critérios de aceitação

- [ ] Nenhuma ocorrência de `pitch` em `src/`, `app/`, `tests/`, `e2e/` ou
      `scripts/`, fora das migrações antigas.
- [ ] A migração renomeia, e a base de 2971 Tentativas sobrevive à aplicação.
- [ ] `drizzle-kit generate` não encontra diferença entre o esquema e o snapshot.
- [ ] Suíte inteira verde, incluindo o e2e, sem alterar nenhuma asserção de
      comportamento — só de nome.

---

## Resultado da execução — 2026-08-25

**Feito.** 66 arquivos, 594 testes de unidade e integração e 19 de ponta a ponta,
todos verdes. `npm run check` limpo.

### A varredura cega acertou o código e errou a prosa

Quatro substituições (`pitches`→`cockpits`, `Pitches`→`Cockpits`, `pitch`→
`cockpit`, `Pitch`→`Cockpit`) resolveram 66 arquivos e o `tsc` passou de
primeira. O que ela não sabia fazer foi distinguir **a palavra usada** da
**palavra citada**: o comentário de `vocabulario.ts` que contava a história da
decisão virou "não era escolha entre 'Cockpit' e 'Pista'", que não quer dizer
nada. Foi preciso devolver "Pitch" onde a palavra antiga era o assunto da frase.

**Vale para qualquer renomeação em massa:** o compilador confere os
identificadores e não confere o texto. A revisão que importa é a dos comentários.

### Três mensagens que o participante lê e que ninguém tinha achado

`src/contexts/inscricao/schema.ts` recusava o cadastro com "Escolha pelo menos
uma **pista**.", "**Pista** inválida: as opções são 1 e 2." e "Cada **pista**
pode ser escolhida uma vez só." — copy de T04, escrita fora do vocabulário.

Elas escaparam da auditoria de D-75 porque aquela busca procurava por "Pitch", e
estas usavam a **outra** palavra errada. Só apareceram aqui porque a renomeação
obrigou a varrer "pista" também. As três passaram a ler `COCKPIT.singular`, e com
isso o formulário de inscrição deixou de ter palavra escrita à mão.

### A migração precisou ser escrita à mão, e o motivo é uma pergunta

`drizzle-kit generate` **recusa rodar** sem terminal interativo quando detecta
uma coluna que sumiu e outra que apareceu: ele pergunta se é renomeação ou
substituição. A pergunta não tem resposta automática, e as duas respostas não se
parecem — uma preserva 2971 Tentativas, a outra apaga a coluna inteira.

Escrevi o SQL (`0004_renomeia_pitch_para_cockpit.sql`) com três `RENAME` e montei
o snapshot a partir do `0003`. A conferência não foi leitura: rodar
`drizzle-kit generate` de novo devolveu **"No schema changes, nothing to
migrate"**, que é o programa dizendo que o snapshot escrito à mão descreve
exatamente o esquema do código. A suíte recria o banco a partir das migrações a
cada execução, então os 594 testes verdes são a prova de que a cadeia aplica.

`tentativa_fila_idx` não aparece na migração de propósito: o nome do índice não
carrega a palavra, e a coluna indexada acompanha o `RENAME` sozinha.

### Critérios de aceitação

- [x] Nenhuma ocorrência de `pitch` fora das migrações antigas.
- [x] Migração por `RENAME`; a base de 2971 Tentativas sobreviveu (`db:migrate`
      aplicado no banco de desenvolvimento, com a massa de 2000 intacta).
- [x] `drizzle-kit generate`: "No schema changes, nothing to migrate".
- [x] 594 + 19 testes verdes, sem alterar asserção de comportamento.

### Aberto

- [ ] **O termo de consentimento ainda diz "pista"** (`v1.0-2026-08-19`, seções
      `dados` e `publicacao`). Não é dívida técnica: é texto aprovado por
      escrito, e a versão nova nasce rascunho, o que **impede cadastro** até
      alguém aprovar (D-18). Decisão do organizador, com custo de uma aprovação.
- [ ] **O PRD continua dizendo "pista"**, de propósito. Se um dia for reescrito,
      conferir `tests/rastreabilidade.test.ts`, que lê o arquivo.

---

## Estado

**Concluída em 2026-08-25.** O código, o banco, o SDD e o README falam uma
palavra só. Sobra o texto do termo, que depende de aprovação, não de código.
