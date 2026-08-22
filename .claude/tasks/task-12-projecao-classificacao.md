# T12 — Projeção e endpoint da Classificação (BC-03)

**Contexto SDD:** BC-03 · fluxos FL-07, FL-08
**Depende de:** T02, T09
**Bloqueia:** T13, T18
**Requisitos:** RF-26 a RF-33, RNF-01, RNF-03, RNF-08, RNF-09

---

## Objetivo

Produzir e servir a ordenação pública das Tentativas Válidas como **modelo de leitura próprio**, não como consulta ao modelo transacional. Esta é a tarefa onde a privacidade deixa de ser convenção e vira propriedade estrutural: o modelo desta camada **não tem** os campos que não podem vazar.

## Escopo

### 1. Modelo de leitura (`src/contexts/classificacao/`)

Tipo único, fechado:

```ts
type LinhaClassificacao = {
  id: string          // id da Tentativa
  nomePublico: string // "Dhiego F."
  pitch: 1 | 2
  tempoMs: number
  registradoEm: string // ISO — usado só para desempate
}
```

- **Não existe** campo de e-mail, telefone, idade, sobrenome ou responsável neste tipo (RNF-08). O tipo é a garantia: acrescentar um desses campos exige alterar este arquivo deliberadamente.
- **Nome Público** é construído na fronteira, uma única vez, por `paraNomePublico(nome, sobrenome, { abreviarSobrenome })` (RNF-09, revisado em D-21): maior de idade sai por extenso, menor de 18 sai como `"{nome} {inicial}."`. A decisão vem de `deveAbreviarSobrenome(idade)`; a idade é lida aqui e **não** é copiada para o modelo de saída. Essa função vive neste contexto e é a única a tocar sobrenome.

### 2. Construção da projeção

- Fonte: Tentativas com estado `valida` (Ausentes e Pendentes nunca entram — RF-21).
- Ordenação: `tempo_ms` crescente, desempate por `resolvido_em` mais antigo (RF-31). Ordenação estável e determinística; terceiro critério `id` para eliminar qualquer ambiguidade residual.
- Consulta única com `SELECT` restrito às colunas necessárias — não trazer a linha inteira do participante para depois descartar campos. O que não é lido não pode vazar.

### 3. Endpoint `GET /api/classificacao`

- Público, sem autenticação (RF-26).
- Devolve o **documento completo** da projeção, em formato compacto (arrays posicionais ou chaves curtas), com o instante de geração.
- Dimensionamento esperado (SDD BC-03): ~4000 tentativas ≈ 200 KB, ~40 KB comprimidos. Verificar em T18 e registrar o número real.
- Cabeçalhos de cache: `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`.
  - Janela de revalidação de **15 segundos**, dentro do limite de 30 s de RNF-03.
  - O cache de borda absorve o pico; o banco não é atingido a cada leitura (SDD §5).
- Compressão habilitada (Brotli/gzip).
- `ETag` para revalidação barata no polling (FL-08).

### 4. Página em cache

A rota pública `/classificacao` (T13) é renderizada no servidor com o mesmo dado e a mesma janela de revalidação, para que a primeira pintura já traga a tabela — sem esperar requisição do cliente (RNF-01, RNF-04).

### 5. O que **não** fazer

- Não expor endpoint de busca por nome no servidor: busca e filtro rodam no dispositivo sobre o documento já recebido (SDD BC-03). Uma requisição por tecla digitada, com 2000 pessoas buscando, é o cenário capaz de derrubar o sistema.
- Não consultar o banco a partir do navegador (restrição 3).

## Critérios de aceitação

- [ ] O endpoint abre em sessão anônima (RF-26).
- [ ] A resposta contém **apenas** posição derivável, nome público, pitch, tempo e instante — nenhum outro campo (RF-27, RNF-08) — verificado por leitura do tipo e do serializador.
- [ ] Nenhum sobrenome completo de participante menor de 18 aparece em resposta pública (RNF-09) — teste que varre a resposta procurando sobrenomes de menores da massa de teste; e participante maior aparece por extenso.
- [ ] Participante com dois tempos gera duas linhas distintas (RF-28).
- [ ] Dois tempos idênticos aparecem sempre na mesma ordem, definida pelo lançamento mais antigo (RF-31) — teste determinístico repetido.
- [ ] Tentativas Ausentes e Pendentes não aparecem.
- [ ] Um tempo registrado no painel aparece na resposta pública em ≤ 30 s (RNF-03), cronometrado.
- [ ] Cabeçalhos de cache presentes e corretos; segunda requisição dentro da janela é servida pela borda (verificar cabeçalho de cache do provedor).

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `projecao.ts` | A fronteira: lê o banco, traduz para Nome Público, ordena — e compõe |
| `documento.ts` | O que atravessa a rede, e a etiqueta de revalidação |
| `app/api/classificacao/route.ts` | O endpoint público, com cache de borda e 304 |
| `tests/classificacao.test.ts` | 14 testes de projeção e privacidade |
| `tests/endpointClassificacao.test.ts` | 8 testes de borda |

`modelo.ts` e `nomePublico.ts` já existiam desde T02/T03 e não precisaram mudar —
o tipo fechado e a função de fronteira eram exatamente o que faltava implementar
em volta.

### O dimensionamento real, medido

A task pedia verificar em T18 o número estimado pelo SDD (~200 KB, ~40 KB
comprimidos). Deu para medir agora, contra o PostgreSQL local com a massa
completa:

| | valor |
|---|---|
| Tentativas Válidas | 2.422 |
| Documento bruto | **62,7 KB** |
| gzip | **10,9 KB** |
| brotli | 9,3 KB |
| Por linha | 26,5 bytes |
| Consulta | **5,3 ms** |

Extrapolando para as 4.000 tentativas do pior caso: ~106 KB brutos, ~18 KB
comprimidos — menos da metade do que o SDD supôs. O formato posicional é a
razão: `["Marina Costa",1,83450]` contra o mesmo dado com chaves repetidas
4.000 vezes.

**Cuidado com um número:** a primeira medição acusou 405 ms de "consulta". Era
partida do `tsx` e abertura de conexão, não a consulta. O `EXPLAIN ANALYZE`
contra o servidor dá 5,3 ms.

### Um índice de T02 que a medição mostrou não ser usado

`tentativa_classificacao_idx`, criado em T02 sobre `(tempo_ms, resolvido_em)`
"para cobrir a leitura da projeção", **não é usado**. O plano é varredura
sequencial mais hash join mais quicksort, 76 buffers, 5,3 ms — e está certo:
a projeção lê 2.422 de 2.973 linhas, 81% da tabela, e nessa seletividade um
índice só acrescenta indireção.

É o segundo índice do projeto na mesma situação (D-50 encontrou os de nome). O
padrão é o mesmo: **T02 criou índices por raciocínio, e a medição em escala real
mostra que nesta escala eles não pagam.** Ficam, porque removê-los custa
migração para ganhar nada e são o remédio se a massa crescer. Registrado em
D-56 para que T18 reavalie com número, não com intuição.

### As três camadas que fazem RNF-08 ser estrutural

1. o `select` nomeia as colunas — e-mail, telefone e dados de Responsável não
   são lidos, e o que não é lido não pode vazar;
2. a **idade é lida e morre na função**: decide o formato do nome e não tem
   campo no modelo de saída;
3. o sobrenome entra em `paraNomePublico` e sai transformado.

O teste que mais importa não confere nenhuma delas: ele semeia 250 participantes
com proporção realista de menores, serializa o documento que iria para a rede e
**varre procurando o sobrenome de cada menor**. Se a projeção parar de abreviar
por qualquer motivo — uma coluna a mais, uma refatoração no `map` —, ele falha.

### Duas decisões sobre o que **não** vai na rede

O modelo interno tem `id` e `registradoEm`; o documento transmitido não (D-57).

- o `id` é um UUID de 36 caracteres que a tela não usa: a ordem do array já é a
  classificação. São 144 KB economizados em 4.000 linhas;
- o `registradoEm` serve ao desempate, que o servidor já resolveu ao ordenar.
  Publicá-lo diria a que horas uma pessoa nomeada esteve num lugar — e para os
  menores de 18 isso é a mesma exposição que RNF-09 existe para evitar, por
  outra porta.

### Critérios de aceitação

- [x] O endpoint abre em sessão anônima (RF-26). — sem cookie, sem cabeçalho.
- [x] A resposta contém apenas nome público, pitch e tempo (RF-27, RNF-08). — cada linha tem exatamente três valores, e o teste confere o corpo cru.
- [x] Nenhum sobrenome completo de menor aparece em resposta pública (RNF-09). — varredura sobre a massa semeada; maior aparece por extenso.
- [x] Participante com dois tempos gera duas linhas distintas (RF-28).
- [x] Dois tempos idênticos aparecem sempre na mesma ordem (RF-31). — projeção repetida seis vezes, mesma saída; terceiro critério (`id`) elimina a ambiguidade residual.
- [x] Tentativas Ausentes e Pendentes não aparecem.
- [x] Cabeçalhos de cache presentes e corretos. — `public, s-maxage=15, stale-while-revalidate=30`, `Vary`, `ETag`, e o 304 na revalidação.
- [ ] **Segunda requisição servida pela borda** — depende de borda de verdade, e a hospedagem não existe (PE-05). Fica para T19.
- [ ] **Um tempo aparece na classificação em ≤ 30 s (RNF-03), cronometrado.** A janela de cache é de 15 s, com margem deliberada para a consulta, a rede e o polling de T13 — mas o número de ponta a ponta só sai com o sistema no ar.

## Estado

**Concluída em 2026-08-23**, com dois critérios abertos que dependem de
hospedagem (PE-05). 22 testes novos, 480 no total. Desbloqueia **T13** (a página
pública) e **T18** (teste de carga), que agora tem um documento real para medir.
