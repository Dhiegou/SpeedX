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
