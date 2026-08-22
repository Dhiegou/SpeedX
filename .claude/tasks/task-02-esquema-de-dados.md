# T02 — Esquema de dados e migrações

**Contexto SDD:** transversal (persistência dos BC-01, BC-02, BC-04, BC-05)
**Depende de:** T01
**Bloqueia:** T04, T08, T09, T12, T14
**Requisitos:** RF-23, RF-25, RNF-02

---

## Objetivo

Modelar a persistência de forma que as invariantes de domínio mais caras sejam garantidas pelo próprio banco, não apenas pela camada de aplicação. Concorrência de Operadores (RF-12) torna verificação em aplicação insuficiente por si só.

## Tabelas

### `participante`
`id` uuid pk · `nome` text · `sobrenome` text · `email` text · `telefone` text · `idade` int · `criado_em` timestamptz default now()

- `idade >= 13` como CHECK constraint (RF-04).
- `telefone` armazenado normalizado (somente dígitos); os últimos 4 dígitos são derivados na leitura, nunca persistidos em coluna separada.

### `responsavel`
`id` uuid pk · `participante_id` uuid unique fk → participante · `nome` text · `sobrenome` text · `telefone` text

- Relação 1:1. Existe **somente** quando `participante.idade < 18` (RF-05, RF-07).

### `consentimento`
`id` uuid pk · `participante_id` uuid unique fk · `versao_termo` text · `aceite_participante` bool not null · `aceite_responsavel` bool · `registrado_em` timestamptz default now()

- `versao_termo` referencia a versão publicada em T03: o texto aceito precisa ser reconstituível anos depois.

### `tentativa`
`id` uuid pk · `participante_id` uuid fk · `pitch` smallint · `estado` enum(`pendente`,`valida`,`ausente`) · `tempo_ms` int null · `inscrito_em` timestamptz · `resolvido_em` timestamptz null · `operador_id` uuid null fk

- **`UNIQUE (participante_id, pitch)`** — impõe RF-25 no banco.
- `CHECK (pitch IN (1,2))`.
- `CHECK ((estado = 'valida') = (tempo_ms IS NOT NULL))` — impõe a invariante "Válida sempre possui Tempo; Pendente e Ausente nunca possuem" (SDD BC-02).
- `CHECK (tempo_ms > 0)`.

### `lancamento` (trilha de auditoria — append-only)
`id` uuid pk · `tentativa_id` uuid fk · `tipo` enum(`registro`,`correcao`,`ausencia`) · `tempo_ms_anterior` int null · `tempo_ms_novo` int null · `operador_id` uuid fk · `ocorrido_em` timestamptz default now()

- Nunca sofre UPDATE nem DELETE (RF-23). Correção gera nova linha, não altera a anterior.
- `ocorrido_em` é **sempre o relógio do servidor** — nunca valor enviado pelo cliente (SDD FL-10).

### `operador`
`id` uuid pk · `usuario` text unique · `nome` text · `senha_hash` text · `ativo` bool default true · `criado_em` timestamptz

- Sem coluna nem fluxo de auto-cadastro (RNF-14).

### `chave_idempotencia`
`chave` text pk · `escopo` text · `resposta` jsonb · `criado_em` timestamptz

- Suporte a FL-03 e FL-06 do SDD. TTL de expurgo definido em T15.

## Índices

| Índice | Serve a |
|---|---|
| `tentativa (pitch, estado, inscrito_em)` | Fila do painel, ordenada por inscrição (RF-14) |
| `tentativa (estado, tempo_ms, resolvido_em)` | Projeção da Classificação com desempate (RF-31) |
| `participante (nome, sobrenome)` — trigram ou lower() | Busca no painel (RF-16) |
| `lancamento (tentativa_id, ocorrido_em)` | Consulta de autoria (RF-23) |

## Armazenamento de Tempo

Inteiro em **milissegundos** (SDD §3). Entrada e exibição em `mm:ss.cc`. As funções `parseTempo` e `formatTempo` vivem em `src/shared/tempo.ts` e são as **únicas** conversões do sistema — nenhum outro módulo formata tempo manualmente.

## Escopo

1. Escrever o esquema em Drizzle e gerar a migração inicial.
2. Escrever `src/shared/tempo.ts` com `parseTempo` / `formatTempo` e testes de ida e volta.
3. Script de seed para desenvolvimento: massa de 2000 participantes e 4000 tentativas (usado em T18).
4. Documentar no README como rodar e reverter migrações.

## Critérios de aceitação

- [x] Inserir duas tentativas com mesmo `participante_id` e mesmo `pitch` é rejeitado pelo banco (RF-25).
- [x] Inserir tentativa com `estado='valida'` e `tempo_ms` nulo é rejeitado.
- [x] Inserir tentativa com `estado='pendente'` e `tempo_ms` preenchido é rejeitado.
- [x] Inserir participante com idade 12 é rejeitado (RF-04).
- [x] `formatTempo(parseTempo("01:23.45")) === "01:23.45"` e `parseTempo("01:23.45") === 83450` (RF-17).
- [x] Seed de 2000 participantes roda e a Fila de um Pitch carrega usando índice (verificado com `EXPLAIN`).

## Resultado da execução — 2026-08-18

**Banco de teste:** sem Docker e sem Postgres na máquina, os testes rodam contra **PGlite** — Postgres compilado para WebAssembly, no processo. É o mesmo motor de constraints, então as invariantes são verificadas de verdade, e a suíte roda em qualquer máquina e no CI sem serviço externo. Produção usa `pg` contra Postgres gerenciado.

**79 testes passando**, sendo 27 de constraints do esquema, 15 de formatação de Tempo, 9 da massa de desenvolvimento e 4 de escala.

**Um defeito de esquema encontrado pelo teste, não pela revisão.** A constraint de autoria estava escrita como uma conjunção:

```sql
(estado = 'pendente') = (operador_id is null and resolvido_em is null)
```

Com `estado='valida'`, `operador_id` nulo e `resolvido_em` preenchido, os dois lados avaliam `false`, a igualdade passa, e o banco aceitava **uma Tentativa resolvida sem autoria** — exatamente o que RF-23 existe para impedir. Substituída por duas condições independentes (`tentativa_autoria_coerente_com_estado` e `tentativa_resolucao_coerente_com_estado`).

**Dois ajustes de desempenho:**
- O índice de busca precisou de `text_pattern_ops`: um btree comum sobre `lower(nome)` não serve para `LIKE 'jo%'` fora da collation C, e o planejador caía em varredura sequencial. Sem isso, o índice existiria e nunca seria usado.
- O seed passou a inserir em lotes de 500, com UUID gerado no cliente. Linha a linha custava ~100 ms por participante — mais de três minutos só para montar a base antes de qualquer medição de T18. Caiu para segundos.

**Limitação registrada.** A busca por nome cobre **prefixo**, não trecho no meio. Atende o uso real do painel (o Operador digita as primeiras letras). Busca por infixo exigiria a extensão `pg_trgm`; decisão adiada para T10, quando o provedor estiver escolhido (PE-05).

**Não verificado ainda:** nada foi executado contra um Postgres gerenciado real. `npm run db:migrate` e `npm run db:seed` estão escritos e tipados, mas só rodam quando houver `DATABASE_URL` de verdade — o que depende da pendência PE-05.
