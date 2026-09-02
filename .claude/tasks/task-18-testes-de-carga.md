# T18 — Testes de carga e desempenho

**Contexto SDD:** BC-03 principalmente · fluxos FL-02, FL-07
**Depende de:** T13, T16, T19
**Bloqueia:** T21
**Requisitos:** RNF-01, RNF-02, RNF-03, RNF-04

---

## Objetivo

Provar antes do evento que o sistema aguenta o pico, em vez de descobrir no dia. O perfil de carga é atípico: escrita esparsa o dia inteiro e leitura massiva concentrada em poucas horas.

## Escopo

### 1. Massa de dados (RNF-02)

Popular ambiente de homologação com **2000 participantes e 4000 tentativas** (seed de T02), com distribuição realista: homônimos, acentos, menores de idade, ausentes, tempos empatados.

### 2. Teste de leitura da Classificação (RNF-01)

- Ferramenta: k6 ou Artillery.
- Cenário: **500 requisições concorrentes** a `/classificacao` e `/api/classificacao`, sustentadas por 5 minutos.
- Critério: p95 ≤ 2 s. Medir também p99.
- Medir **taxa de acerto do cache de borda** — se a maioria das requisições chegar ao banco, a estratégia de T12 não está funcionando e é isso que precisa ser corrigido, não o dimensionamento do banco.
- Registrar o **tamanho real** do documento comprimido e comparar com a estimativa do SDD (~40 KB). Se estourar muito, reavaliar o formato compacto.

### 3. Teste de escrita simultânea

- 2 operadores lançando em ritmo de 3 lançamentos/minuto cada, por 30 minutos, enquanto a carga de leitura roda.
- Critério: nenhuma escrita perdida, nenhum conflito não tratado, latência de lançamento estável (RNF-16).

### 4. Pico de cadastro

- 100 cadastros simultâneos (chegada em massa na abertura dos portões).
- Critério: nenhuma falha, nenhum duplicado, limite de taxa não bloqueando participante legítimo — **atenção ao NAT**: 100 celulares no mesmo Wi-Fi saem do mesmo IP. Este teste é o que calibra o limite de T05.

### 5. Carga da página em rede lenta (RNF-04)

- Medição com limitação de rede simulando 3G lento, cache vazio, em `/` (cadastro) e `/classificacao`.
- Critério: ≤ 3 s para interativo.
- Registrar o peso do primeiro carregamento (orçamento de T07).

### 6. Propagação (RNF-03)

- Cronometrar do clique de confirmação no painel até a linha aparecer na classificação pública, com cache de borda ativo.
- Critério: ≤ 30 s. Esperado ~15 s pela janela de revalidação de T12.

## Entregáveis

- Scripts de carga versionados em `perf/`.
- Relatório em `docs/relatorio-carga.md` com números medidos, ambiente, data e comparação com as metas.
- Lista de ajustes aplicados após o teste.

## Critérios de aceitação

- [ ] p95 de `/api/classificacao` ≤ 2 s com 500 concorrentes (RNF-01).
- [ ] 2000 cadastros e 4000 tempos sem degradação perceptível (RNF-02).
- [ ] Tempo lançado aparece na classificação em ≤ 30 s (RNF-03).
- [ ] Página de cadastro interativa em ≤ 3 s em 3G simulado (RNF-04).
- [ ] Pico de 100 cadastros simultâneos do mesmo IP não bloqueia participantes legítimos.
- [ ] Relatório publicado no repositório com números, não com impressões.

---

## Acrescentado por T12 — 2026-08-23

- [ ] **Reavaliar os três índices que a medição mostrou não serem usados** (D-56): `participante_nome_idx`, `participante_sobrenome_idx` e `tentativa_classificacao_idx`. Todos foram criados em T02 por raciocínio; nas medições de T10 e T12, com a massa real, o planejador não os escolhe. Decidir com número: ou some justificativa medida, ou eles saem numa migração.
- [ ] **Confirmar o dimensionamento do documento público sob carga.** Medido em T12 contra o banco local: 2.422 linhas → 62,7 KB brutos, 10,9 KB gzip, consulta de 5,3 ms. Extrapolado para 4.000 linhas: ~106 KB / ~18 KB. Verificar com 500 acessos simultâneos (RNF-01) e com a borda de verdade no meio.

---

## Resultado da execução — 2026-08-28

**Parcial, e a divisão é a mesma de T19:** tudo o que se mede sem ambiente
publicado está medido, com números em [`docs/relatorio-carga.md`](../../docs/relatorio-carga.md).
O que falta — acerto de cache de borda, 3G real, HTTP/3 sob perda — depende do
domínio que ainda não existe.

**A medição rodou numa máquina só**, com gerador, aplicação e Postgres
disputando os mesmos núcleos e **sem borda no meio**. É o pior caso, e é por
isso que vale: em produção a borda absorve o pico e o banco vê uma consulta a
cada quinze segundos (T12).

### O achado que justifica a tarefa inteira

**O limite de taxa de T05, com os padrões atuais, recusaria a fila do evento.**
Duzentos cadastros legítimos do mesmo IP produziram **30 criados e 170 recusados
com `429`** — trinta é exatamente `RATE_LIMIT_CADASTROS_POR_JANELA`. O limite
funcionou como configurado; a configuração é que está errada para um evento onde
dezenas de celulares saem do mesmo NAT.

O relatório traz a conta e a proposta (300 por janela, 1200 por hora), e o que
T18 entregou foi o número no lugar do palpite (D-27).

**Decidido em T23 (2026-09-01, D-90): 800 por janela e 2400 por hora**, acima da
proposta deste relatório. A premissa de três a cinco IPs de saída não se
confirmou — não há garantia de Wi-Fi no local, e sem ele o CGNAT da operadora
concentra tudo do mesmo jeito. Ver `docs/relatorio-carga.md` §4.

### D-56 se resolve, e a resposta é remover

`pg_stat_user_indexes` depois da carga: `participante_nome_idx`,
`participante_sobrenome_idx` e `tentativa_classificacao_idx` com **zero
varreduras**. `tentativa_fila_idx` usado, e é o único que fica. A projeção lê
3227 de 4000 linhas — o planejador está certo em varrer.

### Três defeitos da bancada, e o que cada um ensinou sobre o sistema

1. **`401` em toda chamada do painel.** O cookie nasce `__Host-` e `Secure`, e
   cliente correto não o devolve por HTTP. O código estava certo; a bancada é
   que era HTTP.
2. **`409 chave_em_conflito` em 46 lançamentos.** O `$uuid` do Artillery é
   resolvido por usuário virtual, não por requisição: o teste reenviava a mesma
   chave com Tentativa diferente. O servidor recusou, como FL-06 promete.
3. **`truncate` no meio da medição.** `medir.ts` importava uma constante de
   `preparar.ts`, e `preparar.ts` **executa a si mesmo** ao ser carregado. A
   primeira execução mediu 3227 linhas; a segunda mediu zero. Quem exporta não
   executa — a constante virou `perf/banco.ts` (D-84).

### Uma mudança de código saiu daqui

**TLS passou a ser exigido pelo destino, e não pelo ambiente** (D-85). A regra
`NODE_ENV === 'production'` tornava impossível rodar o artefato de produção
contra um Postgres local — que é exatamente o que esta tarefa precisa — e ainda
deixava desenvolvimento contra banco remoto trafegar em claro. Agora: laço local
dispensa, qualquer host de rede exige, e não há variável que desligue.

### Critérios de aceitação

- [x] p95 de `/api/classificacao` ≤ 2 s com 500 concorrentes (RNF-01). —
      **7,9 ms** em regime, 200 req/s sustentados, **zero 5xx** em 101.917
      leituras. Com a ressalva da bancada: o número que decide sai do ambiente
      publicado.
- [x] 2000 cadastros e 4000 tempos sem degradação (RNF-02). — massa completa,
      projeção em 3,7 ms, fila em 0,068 ms.
- [x] Tempo lançado aparece na classificação em ≤ 30 s (RNF-03). — 5,1 s sem
      borda; ~20 s somando `s-maxage=15`.
- [ ] Página de cadastro interativa em ≤ 3 s em 3G simulado (RNF-04). —
      **não medido.** Precisa de limitação de rede em aparelho; T21.
- [x] Pico de 100 cadastros do mesmo IP não bloqueia legítimos. — **reprovou**,
      e é o achado principal. Proposta de calibração no relatório; **calibrado em
      T23** (800/2400, D-90), com o cenário reproduzido e passando.
- [x] Relatório publicado com números. — `docs/relatorio-carga.md`.

### Acrescentado por T12

- [x] **Reavaliar os três índices** (D-56). — medidos, zero varreduras, saem.
      A migração fica para tarefa própria, com este relatório por justificativa.
- [x] **Confirmar o dimensionamento do documento público.** — 3227 linhas em
      **83,1 KB brutos / 14,0 KB gzip**, melhor que os 106/18 KB extrapolados em
      T12 e bem abaixo dos ~40 KB do SDD. Com a borda de verdade, ainda por
      confirmar.

### Aberto

- [ ] **Medir contra o alvo publicado**, com borda no meio: acerto de cache,
      HTTP/3 sob perda de pacote e a latência real entre `gru1` e `sa-east-1`.
- [ ] **RNF-04 em 3G**, com aparelho e limitação de rede reais (T21).
- [ ] **Trinta minutos contínuos de escrita.** Medidos cinco; o ensaio longo é
      o de T21.
- [ ] **A migração que remove os três índices.**
- [x] ~~**Decidir a calibração do limite de taxa**~~ — **feito em T23**
      (2026-09-01, D-90): 800 por janela, 2400 por hora, padrões trocados no
      código e protegidos por teste de piso.

---

## Estado

**Parcial em 2026-08-28.** Quatro dos seis critérios fechados com número, um
reprovado de propósito — é o que a tarefa existia para descobrir — e um adiado
por depender de aparelho. `perf/` versionado, com preparo, três cenários e o
medidor.
