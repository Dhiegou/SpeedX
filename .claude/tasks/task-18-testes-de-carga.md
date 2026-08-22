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
