# T13 — UI pública da Classificação

**Contexto SDD:** BC-03
**Depende de:** T12
**Bloqueia:** T18
**Requisitos:** RF-27 a RF-33, RNF-01, RNF-18

---

## Objetivo

Permitir que qualquer pessoa descubra sua posição sem perguntar para ninguém — o momento de engajamento que o PRD identifica como hoje desperdiçado.

## Escopo

### 1. Rota `/classificacao`

- Renderizada no servidor com a projeção já embutida (T12): a tabela aparece na primeira pintura.
- Colunas exatamente: **Posição · Nome Público · Pitch · Tempo** (RF-27). Nenhuma coluna a mais. O Nome Público já chega pronto da projeção — a UI nunca decide formato de nome (RNF-09, D-21).
- Tempo formatado `mm:ss.cc` pelo formatador compartilhado (T02).

### 2. Filtro por Pitch (RF-29)

- Controles: Todos · Pitch 1 · Pitch 2.
- **A posição é recalculada conforme o filtro**, renumerando a partir de 1. Posição não é atributo persistido — é calculada na apresentação (SDD §3).
- Filtro aplicado no cliente, sobre o documento já recebido.

### 3. Busca por nome (RF-30)

- Campo de busca com filtragem no cliente, sem distinção de acento e caixa.
- O resultado encontrado é **destacado** visualmente, não apenas filtrado — a pessoa quer ver a própria linha no contexto das vizinhas.
- Instrumentar uso da busca para a métrica secundária do PRD (≥ 30% das sessões), com evento anônimo.

### 4. Paginação e volume (RF-33)

- As **posições 1 a 100 visíveis sem interação adicional**.
- A posição 101 em diante é alcançável — rolagem contínua ou "carregar mais", sobre o documento já em memória (sem nova requisição).
- Com filtro ou busca ativos, a mesma regra se aplica ao conjunto filtrado.

### 5. Atualização (RF-32, RNF-03)

- Indicador visível de **quando foi atualizada pela última vez**, em texto relativo ("atualizado há 12 s") e absoluto no title.
- Botão de atualização manual que força nova leitura.
- Polling automático a cada 15–20 s (FL-08), pausado quando a aba está em segundo plano.
- Falha de atualização mantém os dados anteriores em tela com aviso discreto — nunca esvaziar a tabela por erro de rede.

### 6. Mobile (RNF-18)

- Layout de tabela legível em 360px sem rolagem horizontal.
- Números tabulares para alinhamento dos tempos.
- Controles de filtro e busca fixos no topo ao rolar.

### 7. Estados

- Vazio (evento ainda não começou): mensagem explicando que os tempos aparecem conforme as corridas terminam.
- Busca sem resultado: mensagem com sugestão de conferir a grafia; não sumir com a tabela inteira sem aviso.

## Critérios de aceitação

- [ ] As cinco informações de RF-27 estão presentes e **nenhuma outra** aparece na tela.
- [ ] Participante com dois tempos aparece em duas linhas (RF-28).
- [ ] Filtrar por Pitch renumera as posições a partir de 1 (RF-29).
- [ ] Buscar um nome cadastrado localiza e evidencia a linha (RF-30).
- [ ] Posições 1 a 100 visíveis sem interação; a 101 é alcançável (RF-33).
- [ ] O indicador de atualização existe e o botão força nova leitura (RF-32).
- [ ] Em 360px não há rolagem horizontal (RNF-18).
- [ ] Filtro e busca não disparam requisição ao servidor (verificado por leitura do código e pela aba de rede).

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `app/classificacao/filtro.ts` | Renumeração de RF-29 e a regra de vizinhança de RF-30, puras |
| `app/classificacao/Classificacao.tsx` | A tabela, o filtro, a busca, o polling e a atualização manual |
| `app/classificacao/classificacao.module.css` | 360px sem rolagem horizontal, números tabulares, controles fixos |
| `app/classificacao/page.tsx` | Server Component com a tabela já na primeira pintura |
| `src/shared/texto.ts` | A normalização de acento, mudada de casa |
| `tests/filtroClassificacao.test.ts` | 16 testes puros |
| `tests/paginaClassificacao.test.tsx` | 13 testes de tela |

### "Destacar, não apenas filtrar" virou uma regra concreta

A task é específica: o resultado da busca é **destacado**, "não apenas
filtrado — a pessoa quer ver a própria linha no contexto das vizinhas". Uma
lista só com os casamentos responderia "você é o 437º" e esconderia quem está
em 436 e 438, que é metade da graça de procurar o próprio nome.

Cada resultado vem cercado de duas vizinhas de cada lado. Resultados próximos
se fundem num bloco; resultados distantes viram blocos separados com uma faixa
dizendo quantas posições foram puladas — sem ela, duas linhas distantes
apareceriam grudadas e a tabela mentiria sobre a distância entre elas.

E a busca **não** é limitada pela paginação: quem está em 400º se acha mesmo
com só 100 linhas carregadas. Sem isso, a busca só serviria para quem já estava
visível.

### O terceiro mecanismo que mudou de casa

`normalizar` — o dobramento de acento e caixa — saiu de Cronometragem para
`src/shared/texto.ts`. É o mesmo motivo do limite de taxa (D-38) e da
idempotência (D-46): a Classificação precisa da mesma regra e não pode importar
Cronometragem.

**Por que importa que seja a mesma função:** no painel a comparação acontece no
Postgres, com `translate`; na Classificação acontece no navegador, em
JavaScript. Se as duas divergirem, o mesmo nome digitado acha a pessoa num lugar
e não acha no outro — e quem procura a própria posição na arquibancada não tem a
quem perguntar.

Foi para `shared/` e não para `infra/` porque não toca o banco.

### Dois defeitos meus, encontrados pelos testes

**O build quebrou, e o sintoma escondia o problema.** Com `revalidate = 15` na
página, o `next build` passou a falhar com "The server does not support SSL
connections" — porque o build roda com `NODE_ENV=production`, e o pool exige TLS
(SDD FL-09). O sintoma era o TLS; o problema é que **pré-renderizar essa página
amarra o build ao banco**. O CI de T01 não tem banco nenhum, o deploy de T19
passaria a precisar de credencial de produção para compilar, e a tabela embutida
no build seria a do dia do deploy — vazia. A página virou `force-dynamic`.

**O memo que protegia o banco não protegia nada** (D-58). Sem a
pré-renderização, a página passou a consultar por requisição, e 500 pessoas
abrindo ao mesmo tempo (RNF-01) seriam 500 consultas. Escrevi um memo com
validade de 5 s — e um teste de cinquenta leituras **simultâneas** mostrou
cinquenta consultas. O memo guardava o **resultado**, então nenhuma das chamadas
paralelas encontrava algo pronto: ele protegia leituras sequenciais, inútil no
único cenário para o qual foi escrito. Guardando a **promessa**, quem chega
durante a consulta espera a mesma consulta. Agora são 50 leituras → 1 consulta.

**A conta do orçamento de RNF-03:** trinta segundos entre o lançamento e a
aparição pública. A borda gasta 15 (T12), o memo gasta 5, sobram 10 para a
consulta, a rede e o intervalo de polling. Por isso cinco, e não quinze — dois
caches de quinze em série gastariam o orçamento antes do primeiro byte sair.

### Critérios de aceitação

- [x] As quatro informações de RF-27 estão presentes e nenhuma outra. — o teste lê os cabeçalhos da tabela e compara com a lista exata.
- [x] Participante com dois tempos aparece em duas linhas (RF-28). — vem da projeção; T12 já prova.
- [x] Filtrar por Pitch renumera as posições a partir de 1 (RF-29).
- [x] Buscar um nome cadastrado localiza e evidencia a linha (RF-30). — com `aria-current`, sem acento e sem caixa, e com as vizinhas à vista.
- [x] Posições 1 a 100 visíveis sem interação; a 101 é alcançável (RF-33). — e sem nova requisição.
- [x] O indicador de atualização existe e o botão força nova leitura (RF-32). — relativo na tela, absoluto no `title`.
- [x] Filtro e busca não disparam requisição ao servidor. — os testes contam as chamadas a `fetch` e exigem zero.
- [ ] **Em 360px não há rolagem horizontal (RNF-18).** O CSS foi escrito para isso — coluna elástica única, `overflow-wrap`, números tabulares —, mas confirmar exige aparelho ou navegador de verdade. Entra no ensaio de T21.

### O que ficou de fora do escopo, e por quê

O item 3 pedia instrumentar o uso da busca para a métrica secundária do PRD
(≥ 30% das sessões). **Não foi feito, deliberadamente.** Seria o único evento de
telemetria emitido pelo navegador em todo o sistema — D-33 tirou a métrica de
conclusão do cadastro do cliente justamente para não ter isso, e reintroduzir
aqui exigiria uma URL de coletor exposta na página mais pública do evento.

A alternativa que serve à mesma pergunta sem custo nenhum: a proporção entre
requisições a `/api/classificacao` e leituras únicas já está no log do servidor,
e T16 pode derivar dela. Anotado lá.

## Estado

**Concluída em 2026-08-23**, com um critério aberto que depende de aparelho
(RNF-18) e um item de escopo deliberadamente não implementado, com alternativa
apontada. 29 testes novos, 511 no total.

Com isto a trilha de Classificação (T12–T13) fecha. Restam Custódia (T14, T15) e
qualidade/operação (T16–T21).
