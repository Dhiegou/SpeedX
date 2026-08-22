# T04 — Domínio de Inscrição (BC-01)

**Contexto SDD:** BC-01 Inscrição
**Depende de:** T02, T03
**Bloqueia:** T05
**Requisitos:** RF-02 a RF-08, RNF-07, RNF-13, RNF-17

---

## Objetivo

Implementar a regra de negócio da Inscrição como código de domínio puro, independente de HTTP e de banco. Conforme o SDD, a regra dominante aqui é jurídica: a idade é o discriminador que decide qual conjunto de obrigações se aplica ao registro.

## Escopo

### 1. Esquema de validação (Zod), em `src/contexts/inscricao/schema.ts`

Campos obrigatórios (RF-02): `nome`, `sobrenome`, `email`, `telefone`, `idade`, `pitches`.

| Campo | Regra | Mensagem |
|---|---|---|
| nome / sobrenome | não vazio, 2–60 chars, letras/acentos/espaço/hífen/apóstrofo | específica por campo (RNF-17) |
| email | formato válido, ≤ 254 chars, normalizado para minúsculas | idem |
| telefone | 10–11 dígitos após remover máscara | idem |
| idade | inteiro, **13 a 99** — abaixo de 13 rejeita com mensagem explicativa (RF-04) | idem |
| pitches | array não vazio, subconjunto de `[1,2]`, sem repetição (RF-03) | idem |
| consentimento | booleano, obrigatoriamente `true` (RF-08) | idem |
| aceiteCompartilhamento | booleano, `true` ou `false` — **opcional** (D-23). Recusa é valor legítimo e é gravada como `false` | idem |

### 2. Refinamento condicional por idade (RF-05, RF-06, RF-07)

Modelar como **união discriminada**, não como campos opcionais soltos:

```ts
type Inscricao =
  | { tipo: 'adulto';  /* idade >= 18, sem responsavel */ }
  | { tipo: 'menor';   /* 13 <= idade < 18, responsavel obrigatório + aceiteResponsavel */ }
```

- O parser decide o ramo pela idade, **ignorando o que o cliente enviou**. Se `idade >= 18`, qualquer campo de responsável presente na entrada é **descartado** e não chega ao repositório (RF-07) — o descarte é consequência do tipo, não de um `delete` defensivo.
- Se `13 <= idade < 18`: `responsavel.nome`, `responsavel.sobrenome`, `responsavel.telefone` e `aceiteResponsavel === true` são obrigatórios; ausência de qualquer um rejeita a inscrição inteira (RF-06, RNF-07).

### 3. Caso de uso `registrarInscricao`

Transação única que:
1. valida a entrada com o esquema acima (revalidação servidor — RNF-13);
2. cria `participante`;
3. cria `responsavel` **somente** no ramo `menor`;
4. cria `consentimento` com a versão vigente do termo (T03), gravando também `aceite_compartilhamento`;
5. cria uma `tentativa` **Pendente** por Pitch declarado, com `inscrito_em` = relógio do servidor (SDD BC-02: a Tentativa nasce Pendente na Inscrição);
6. retorna o resumo de confirmação: nome registrado e Pitches escolhidos (RF-10).

Falha em qualquer passo desfaz tudo: não pode existir Participante sem Consentimento nem sem Tentativa.

### 4. Erros

Retornar erro estruturado `{ campo, codigo, mensagem }`, nunca string única (RNF-17). Cada regra de validação tem código próprio.

## Critérios de aceitação

- [x] Idade 12 rejeitada com mensagem explicativa; idade 13 aceita (RF-04). — código `idade_minima`, mensagem cita os 13 anos. Idade abaixo do mínimo **não** cobra dados de responsável junto, para a mensagem não sugerir que preencher resolveria.
- [x] Enviar sem Pitch rejeitado; com um Pitch aceito; com dois Pitches aceito e gera duas Tentativas Pendentes (RF-03). — inclui recusa de pista inexistente e de repetição.
- [x] Cadastro de menor sem qualquer campo do responsável, ou sem `aceiteResponsavel`, é rejeitado (RF-06). — um caso por campo, com o erro apontando `responsavel.nome`, `responsavel.sobrenome`, `responsavel.telefone`.
- [x] Entrada com `idade: 18` + bloco de responsável preenchido grava participante **sem** linha em `responsavel` (RF-07). — verificado no domínio (o tipo `adulto` não tem onde guardar) e no banco.
- [x] Envio com `consentimento: false` é rejeitado (RF-08).
- [x] Envio com `aceiteCompartilhamento: false` é **aceito**, e a recusa fica gravada (D-23) — o oposto do critério anterior, e é o teste que impede o opcional de virar obrigatório. Ausência do campo também grava recusa, nunca autorização.
- [x] Erro forçado na criação da Tentativa não deixa Participante órfão no banco (transação). — a falha é forçada por gatilho no próprio Postgres, não por mock, e o teste cobre também o ramo do menor (Responsável desfeito) e a inscrição seguinte, que precisa voltar a funcionar.
- [x] O resultado de sucesso contém exatamente o nome e os Pitches enviados (RF-10). — devolve também a versão do termo aceita, que é o que a auditoria precisa.
- [x] Testes cobrem as idades de fronteira 12, 13, 17, 18 e 19.

## Estado

**Concluída em 2026-08-19.** `schema.ts` (validação e união discriminada), `erros.ts` (erro estruturado por campo), `registrarInscricao.ts` (validação + transação). 61 testes novos: 41 de regra pura e 20 contra Postgres real.

Duas escolhas registradas no `CONTEXT.md` (D-25 e D-26): o guard do termo roda dentro de `registrarInscricao`, e não só no endpoint de T05; e os códigos de erro são declarados por regra, em vez de derivados do código do Zod.

**Para T05:** o endpoint chama `registrarInscricao(db(), await request.json())` e traduz `InscricaoInvalidaError` em resposta 422 com a lista de `{ campo, codigo, mensagem }`. Nenhuma validação precisa ser reescrita lá.
