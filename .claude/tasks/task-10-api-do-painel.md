# T10 — API do painel do Operador

> **Aviso vindo de T08 (2026-08-23), para a busca de RF-16:** os índices
> `participante_nome_idx` e `participante_sobrenome_idx` **dependem** de
> `text_pattern_ops` para servir `LIKE 'prefixo%'`. Isso foi medido contra o
> Postgres nativo: em collation `Portuguese_Brazil.1252`, um btree comum não é
> usado nem com `enable_seqscan = off`. O PGlite roda em collation `C`, onde o
> btree comum funciona — ou seja, **a suíte não pega essa regressão**. Escreva a
> busca como `lower(coluna) like 'prefixo%'` e confirme o plano com `EXPLAIN`
> contra um Postgres de verdade antes de fechar a task. Ver D-45 no CONTEXT.md.

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
