# T10 — API do painel do Operador

> **Aviso vindo de T08 (2026-08-23), para a busca de RF-16:** os índices
> `participante_nome_idx` e `participante_sobrenome_idx` **dependem** de
> `text_pattern_ops` para servir `LIKE 'prefixo%'`. Isso foi medido contra o
> Postgres nativo: em collation `Portuguese_Brazil.1252`, um btree comum não é
> usado nem com `enable_seqscan = off`. O PGlite roda em collation `C`, onde o
> btree comum funciona — ou seja, **a suíte não pega essa regressão**.
>
> **Atendido em 2026-08-23, por outro caminho:** medi as duas formas contra os
> 2000 participantes reais antes de escolher. Prefixo com índice custa 77
> buffers; trecho **sem** índice custa 73 — nesta escala o índice não compra
> nada. A busca ficou por trecho e acento-insensível, que é o que RF-16 pede.
> Os índices continuam declarados e testados. Ver D-50 no CONTEXT.md.

**Contexto SDD:** BC-02 · fluxos FL-05, FL-06
**Depende de:** T08, T09
**Bloqueia:** T11
**Requisitos:** RF-12 a RF-16, RF-21 a RF-25

---

## Objetivo

Expor os casos de uso de Cronometragem ao painel, com autenticação obrigatória e latência baixa o suficiente para sustentar ~3 lançamentos por minuto durante 10 horas (PRD P4).

## Endpoints

Todos sob `/api/painel/*`, todos exigindo sessão válida (T08); sem sessão, 401.

| Método e rota | Função | Requisito |
|---|---|---|
| `GET /fila?pitch=1&busca=` | Tentativas Pendentes do Pitch, ordenadas por inscrição; `busca` filtra por nome parcial **dentro do Pitch** | RF-13, RF-14, RF-16 |
| `POST /tempo` | `{ tentativaId, tempo, chave }` — registra | RF-17, RF-18, RF-23 |
| `PATCH /tempo` | `{ tentativaId, tempo, chave }` — corrige | RF-22 |
| `POST /ausencia` | `{ tentativaId, chave }` | RF-21 |
| `POST /tentativa` | `{ participanteId, pitch }` — adiciona Pitch extra | RF-24 |
| `GET /participante?busca=` | Busca global (fora da Fila) para localizar quem já foi lançado ou está ausente — necessário para RF-22 e RF-24 | RF-22, RF-24 |
| `GET /tentativa/:id/historico` | Lançamentos com autor e instante | RF-23 |

## Regras

1. **Projeção da Fila.** Cada item traz: `tentativaId`, `nome`, `sobrenome`, `ultimos4Telefone`, `inscritoEm`. **Nunca** e-mail, idade, telefone completo ou dado de responsável — o painel só precisa distinguir homônimos (RF-15).
2. **Busca (RF-16).** Correspondência parcial, sem distinção de acento e de caixa. "jo" encontra "João" e "Jonas". Executada no servidor, sobre índice (T02). Limite de resultados (ex.: 50) com indicação de que há mais.
3. **Idempotência (FL-06).** Escritas exigem chave; reenvio devolve o resultado anterior.
4. **Concorrência (RF-12).** Conflito de estado retorna 409 com mensagem pronta para exibição ("Tempo já registrado por {operador} às {hora}").
5. **Sem cache.** Respostas do painel são `no-store`. O Operador não pode ver Fila obsoleta.
6. **Cabeçalho de instante do servidor** na resposta da Fila, para a UI exibir defasagem se houver.
7. Validar `pitch ∈ {1,2}` e todo corpo com Zod no servidor.

## Critérios de aceitação

- [ ] Requisição sem sessão a qualquer rota retorna 401 (RF-11).
- [ ] A Fila padrão não contém Tentativas já lançadas nem ausentes, e respeita a ordem de inscrição (RF-14).
- [ ] Alternar `pitch` altera a lista retornada (RF-13).
- [ ] Cada item traz nome, sobrenome e os últimos 4 dígitos do telefone, e nada além do necessário (RF-15) — verificado por leitura do serializador.
- [ ] Busca parcial retorna correspondências dentro do Pitch selecionado (RF-16).
- [ ] Dois operadores lançando na mesma Pitch simultaneamente não sobrescrevem lançamentos um do outro (RF-12) — teste com requisições paralelas.
- [ ] Nenhuma resposta do painel expõe e-mail ou telefone completo em rota não autenticada (não existe rota do painel não autenticada).

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `src/contexts/cronometragem/busca.ts` | Normalização de acento e padrão de `LIKE`, num lugar só |
| `src/contexts/cronometragem/schema.ts` | A forma dos comandos que chegam pela rede (Zod) |
| `app/api/painel/_apoio.ts` | O que toda rota repete: `no-store`, corpo, erro, registro |
| `app/api/painel/_traduzir.ts` | Situação do domínio → status HTTP, com `switch` exaustivo |
| `app/api/painel/fila/route.ts` | `GET` — a visão de trabalho (RF-13, RF-14, RF-16) |
| `app/api/painel/tempo/route.ts` | `POST` registra, `PATCH` corrige (RF-17, RF-22) |
| `app/api/painel/ausencia/route.ts` | `POST` (RF-21) |
| `app/api/painel/tentativa/route.ts` | `POST` — Pitch adicional (RF-24) |
| `app/api/painel/participante/route.ts` | `GET` — busca global fora da Fila (RF-22, RF-24) |
| `app/api/painel/tentativa/[id]/historico/route.ts` | `GET` — a trilha (RF-23) |
| `tests/endpointCronometragem.test.ts` | 28 testes |

Também entraram `consultas.buscarParticipantes`, `formatHoraDoEvento` em
`shared/tempo.ts`, e um campo a mais na recusa do domínio — autor e instante do
Tempo que já existe, sem os quais o 409 de RF-12 não teria o que dizer.

### A decisão que a T02 tinha adiado para cá

A T02 deixou escrito que a busca no meio do nome "exigiria a extensão `pg_trgm`,
decisão adiada para T10, quando o provedor de banco estiver escolhido (PE-05)".
Está escolhido, e a medição contra os 2000 participantes reais desempatou:

| forma | custo |
|---|---|
| prefixo, usando os índices `text_pattern_ops` | 77 buffers |
| trecho, sem índice nenhum | **73 buffers** |

Nesta escala o índice não compra nada — economiza duas páginas de índice e paga
as outras vinte e oito no heap de qualquer jeito. `pg_trgm` seria uma extensão a
instalar e um índice GIN a manter para ganhar nada mensurável.

E **677 dos 2000 nomes têm acento** (34%), então acento-insensibilidade não era
detalhe: sem ela, um terço da massa fica inalcançável para quem digita sem
acento — que é como se digita com pressa, em tablet. Resolvido com `translate()`,
função de núcleo que roda igual no PGlite e no Postgres nativo, em vez de
`unaccent`, que é extensão e não é `IMMUTABLE` sem embrulho.

**Efeito colateral honesto:** a Fila deixou de usar `participante_nome_idx` e
`participante_sobrenome_idx`. Eles ficam, porque removê-los custa uma migração
para ganhar nada e são o remédio imediato se a massa crescer uma ordem de
grandeza. O aviso de D-45 no cabeçalho desta task foi atendido de outra forma:
não pela forma da consulta, mas por medir antes de escolher.

### Três decisões de borda

1. **A guarda é repetida em cada rota, não embrulhada** (D-51). Um `withAuth`
   envolvendo o handler faria a proteção sumir do arquivo que ela protege, e
   `tests/painelGuarda.test.ts` deixaria de conseguir afirmar qualquer coisa
   lendo a rota. Duas linhas repetidas compram uma verificação estrutural que
   cobre as rotas que a T11 ainda vai criar.

2. **`POST /tentativa` não pede chave de idempotência** (D-52). A unicidade
   `(participante_id, pitch)` no banco já torna a operação idempotente por
   construção: o reenvio esbarra na constraint e volta como `409`, que é a mesma
   informação que uma chave devolveria.

3. **Verbos separados para registrar e corrigir.** São transições distintas na
   máquina de estados, com trilhas de auditoria distintas. Um `POST` que às
   vezes corrige seria exatamente a sobrescrita silenciosa que D-49 recusou.

### Um teste meu que era instável, e o que ele ensinou

O teste de RF-15 assertava que a string `34` — a idade — não aparecia no corpo.
Dois dígitos colidem por acaso com UUIDs e com ISO 8601: ele passou quando rodei
o arquivo sozinho e reprovou na suíte completa, conforme o sorteio dos
identificadores. Trocado pela asserção de chaves, que já era exaustiva. Um teste
que reprova conforme o UUID que calhou é pior que teste nenhum.

### Critérios de aceitação

- [x] Requisição sem sessão a qualquer rota retorna 401 (RF-11). — as sete rotas, no mesmo teste, conferindo também que nada foi escrito.
- [x] A Fila padrão não contém Tentativas já lançadas nem ausentes, e respeita a ordem de inscrição (RF-14).
- [x] Alternar `pitch` altera a lista retornada (RF-13).
- [x] Cada item traz nome, sobrenome e os últimos 4 dígitos, e nada além (RF-15). — verificado pelas **chaves** do objeto serializado, que é exaustivo, mais a ausência do e-mail e do telefone completo no corpo cru.
- [x] Busca parcial retorna correspondências dentro do Pitch selecionado (RF-16). — e `joao` acha `João`, e `neto` acha `Assumpção Neto`.
- [x] Dois operadores lançando simultaneamente não se sobrescrevem (RF-12). — requisições paralelas: um 201, um 409, uma linha de auditoria.
- [x] Nenhuma resposta do painel expõe e-mail ou telefone completo em rota não autenticada. — não existe rota do painel não autenticada, e o teste estrutural falha se alguém criar uma.

## Estado

**Concluída em 2026-08-23.** 28 testes novos, 430 no total. Desbloqueia **T11**
(UI do painel), que agora tem sete endpoints, mensagens de conflito prontas para
exibição e o cabeçalho de instante do servidor.
