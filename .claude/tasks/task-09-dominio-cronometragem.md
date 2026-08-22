# T09 — Domínio de Cronometragem (BC-02)

**Contexto SDD:** BC-02 · agregado raiz **Tentativa**
**Depende de:** T02, T08
**Bloqueia:** T10
**Requisitos:** RF-17, RF-21, RF-22, RF-23, RF-24, RF-25

---

## Objetivo

Implementar a máquina de estados da Tentativa e a trilha de autoria, com as invariantes garantidas sob concorrência de Operadores (RF-12).

## Máquina de estados (SDD BC-02)

```
Pendente ──lançar tempo──▶ Válida ──corrigir──▶ Válida
    │
    └──marcar ausência──▶ Ausente ──lançar tempo──▶ Válida
```

- Ausente **não retorna** a Pendente. Se a pessoa reaparecer e correr, o Operador lança o tempo direto e a Tentativa vai para Válida.
- Toda transição registra Operador e instante **do servidor** (RF-23, SDD FL-10).

## Escopo

### Casos de uso em `src/contexts/cronometragem/`

| Caso de uso | Regra |
|---|---|
| `registrarTempo(tentativaId, tempoMs, operador, chaveIdempotencia)` | Só a partir de Pendente ou Ausente. Grava `tempo_ms`, estado `valida`, `resolvido_em` = now() do servidor, `operador_id`. Insere `lancamento` tipo `registro`. |
| `corrigirTempo(tentativaId, tempoMs, operador, chave)` | Só a partir de Válida. Atualiza `tempo_ms`. Insere `lancamento` tipo `correcao` com anterior e novo. **`resolvido_em` NÃO é alterado** — o desempate de RF-31 usa o lançamento original. |
| `marcarAusente(tentativaId, operador, chave)` | Só a partir de Pendente. Estado `ausente`, `tempo_ms` permanece nulo. Insere `lancamento` tipo `ausencia`. |
| `adicionarTentativa(participanteId, pitch, operador)` | Cria Tentativa Pendente no outro Pitch, sem novo cadastro (RF-24). Viola `UNIQUE (participante_id, pitch)` se já existir — tratar como erro de negócio legível. |

### Regras transversais

1. **Concorrência (RF-12).** Toda transição usa `UPDATE ... WHERE id = ? AND estado = ?` (compare-and-set) ou `SELECT ... FOR UPDATE` na transação. Se zero linhas afetadas, o estado mudou entre a leitura e a escrita: retornar conflito legível ("outro operador já registrou este tempo"), nunca sobrescrever silenciosamente.
2. **RF-25.** Um segundo lançamento no mesmo Pitch é tratado como **correção**, nunca como novo registro. A unicidade está no banco (T02); o domínio traduz a violação em mensagem de negócio.
3. **Idempotência (FL-06).** Cada operação aceita chave de idempotência; repetição devolve o resultado anterior sem reexecutar.
4. **Tempo.** Recebido em milissegundos inteiros, convertido de `mm:ss.cc` pelo `parseTempo` compartilhado (T02). Validar faixa plausível (> 0 e < 100 minutos) e rejeitar fora dela com mensagem.
5. **Instante autoritativo.** Nenhum caso de uso aceita timestamp vindo do cliente. `now()` é sempre do servidor (SDD §5 — mitigação de divergência de relógio).

### Consultas de leitura do contexto

- `listarFila(pitch, { busca? })` — Tentativas Pendentes do Pitch, ordenadas por `inscrito_em` crescente (RF-14). Retorna nome, sobrenome e **últimos 4 dígitos do telefone** (RF-15) — a derivação dos 4 dígitos acontece aqui, no servidor.
- `historicoDaTentativa(tentativaId)` — lançamentos com autor e instante (RF-23).

## Critérios de aceitação

- [ ] Tempo de 1min 23s 45cent é aceito e reexibido idêntico (RF-17).
- [ ] Marcar ausente remove da Fila, mantém o cadastro e não produz linha na Classificação (RF-21).
- [ ] Corrigir um tempo substitui o valor e mantém `resolvido_em` original (RF-22 + RF-31).
- [ ] Consultar um lançamento revela operador e instante (RF-23).
- [ ] Participante inscrito só no Pitch 1 passa a constar na Fila do Pitch 2 mantendo **um único** registro pessoal (RF-24).
- [ ] Segundo lançamento no mesmo Pitch é bloqueado ou tratado como correção — nunca duplica (RF-25).
- [ ] Teste de concorrência: dois `registrarTempo` simultâneos na mesma Tentativa resultam em um sucesso e um conflito legível, sem perda de dado (RF-12).
- [ ] Repetir a mesma operação com a mesma chave de idempotência não gera segundo `lancamento`.

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `src/contexts/cronometragem/modelo.ts` | O vocabulário de BC-02 em tipos |
| `src/contexts/cronometragem/maquinaDeEstados.ts` | As transições como tabela, puras, sem banco |
| `src/contexts/cronometragem/lancamento.ts` | O motor das três transições: trava, transição, auditoria, idempotência |
| `src/contexts/cronometragem/adicionarTentativa.ts` | RF-24, com as duas recusas decididas pelo banco |
| `src/contexts/cronometragem/consultas.ts` | Fila, contagem de pendentes e trilha de auditoria |
| `src/contexts/cronometragem/servico.ts` | Composição: liga os casos de uso à conexão real (porta de entrada da T10) |
| `src/infra/idempotencia.ts` | O mecanismo de idempotência, mudado de casa |
| `tests/cronometragem.test.ts` | 35 testes |

Nenhuma dependência nova. Nenhuma migração — o esquema de T02 já previa tudo.

### Quatro decisões

1. **A idempotência mudou de casa** (D-46). Estava dentro de Inscrição desde T05, e Cronometragem não pode importar Inscrição. Foi para `src/infra/idempotencia.ts`, ao lado do limite de taxa que fez o mesmo caminho em T08 por motivo idêntico. `submeterInscricao` foi refatorado para usá-la; os 40 testes de T05/T06 continuam passando sem alteração.

2. **A máquina de estados é uma tabela, não uma sequência de `if`** (D-47). Seis linhas de dado descrevem de onde para onde uma Tentativa anda, com três atributos por transição: se exige Tempo, que tipo de Lançamento gera e **se carimba `resolvido_em`**. O terceiro é a regra mais fácil de quebrar sem perceber, e agora ela é uma coluna que um teste lê.

3. **`SELECT ... FOR UPDATE` em vez do compare-and-set** que a task sugeria como alternativa (D-48). A correção precisa do valor anterior para a trilha de RF-23, e lê-lo antes sem travar reabriria exatamente a janela que o compare-and-set fecha.

4. **Segundo registro é recusado, não convertido em correção** (D-49). RF-25 admite "bloqueada ou tratada como correção". Converter em silêncio apagaria um Tempo medido sem ninguém confirmar. A recusa devolve o Tempo que já está lá, e é isso que permite ao painel de T11 perguntar "já existe 01:23.45 lançado por Marina — deseja corrigir?", satisfazendo RF-18 no mesmo movimento.

### Uma lacuna assumida, não escondida

**Não fica registrado quem incluiu uma Tentativa por RF-24.** A constraint `tentativa_autoria_coerente_com_estado` exige `operador_id` nulo enquanto o estado é `pendente` — ninguém agiu sobre a Tentativa ainda —, e o enum `tipo_lancamento` não tem valor para "inclusão". RF-23 cobre gravação e alteração de **Tempo**, e incluir uma Tentativa vazia não é nenhuma das duas, então isto está dentro do requisito. Se o organizador quiser o rastro, custa um valor no enum e uma migração. Anotado para T21.

### O que a suíte não consegue provar, e foi provado à mão

O teste de concorrência roda sobre PGlite, que tem **uma conexão só**: o `Promise.all` serializa e o lock nunca é disputado de verdade. O resultado observado é o certo, mas pela razão errada.

Verificado à parte, com **dois pools separados contra o PostgreSQL 18.6 nativo** — o cenário de dois tablets no mesmo Pitch:

```
duracao total: 200 ms
conexao A: aplicado
conexao B: transicao_recusada — Esta tentativa já tem um tempo registrado.
                                Para trocar o valor, use a correção.
tempo gravado: 83450
linhas de auditoria: 1
```

Mesma limitação de família que D-45: o PGlite prova regra, não prova concorrência nem plano de execução.

### D-45 fechado do lado da Fila

O aviso deixado no cabeçalho desta task pela sessão anterior mandava conferir o `EXPLAIN` da busca contra Postgres real. Feito, com 2000 participantes e 2973 tentativas:

```
Bitmap Heap Scan on participante
  -> BitmapOr
       -> Bitmap Index Scan on participante_nome_idx
       -> Bitmap Index Scan on participante_sobrenome_idx
```

Os dois índices `text_pattern_ops` são usados, junto com `tentativa_fila_idx` para o recorte de Pitch e estado. 77 buffers para uma busca por prefixo. A forma `lower(coluna) like 'prefixo%'` está correta e está comentada em `consultas.ts` para não ser trocada por `ilike` sem querer.

Observação sem ação: a Fila **sem** busca faz `Seq Scan` em `participante` para o hash join (2000 linhas, 28 buffers). O planejador prefere hash a nested loop nessa proporção, e a conta fecha. Vale reavaliar em T18 se a massa crescer.

### Critérios de aceitação

- [x] Tempo de 1min 23s 45cent é aceito e reexibido idêntico (RF-17). — `parseTempo('01:23.45')` → 83450 → `formatTempo` → `01:23.45`.
- [x] Marcar ausente remove da Fila, mantém o cadastro e não produz linha na Classificação (RF-21).
- [x] Corrigir um tempo substitui o valor e mantém `resolvido_em` original (RF-22 + RF-31). — a correção acontece uma hora depois no teste, e o instante não se move.
- [x] Consultar um lançamento revela operador e instante (RF-23). — com o **nome** do Operador, não só o UUID: quem media contestação no dia não consulta tabela de operadores.
- [x] Participante inscrito só no Pitch 1 passa a constar na Fila do Pitch 2 mantendo um único registro pessoal (RF-24).
- [x] Segundo lançamento no mesmo Pitch é bloqueado — nunca duplica (RF-25).
- [x] Dois `registrarTempo` simultâneos: um sucesso, um conflito legível, sem perda de dado (RF-12). — na suíte pelo resultado; contra Postgres real pelo mecanismo.
- [x] Repetir a mesma operação com a mesma chave não gera segundo `lancamento`. — e a mesma chave com outro tempo, ou por outro Operador, é conflito.

## Estado

**Concluída em 2026-08-23.** 35 testes novos, 389 no total. Desbloqueia **T10** (API do painel), que agora tem casos de uso, consultas e uma porta de entrada em `servico.ts`.
