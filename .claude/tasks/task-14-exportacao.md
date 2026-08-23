# T14 — Exportação de dados (BC-05)

**Contexto SDD:** BC-05 Custódia de Dados · fluxo FL-11
**Depende de:** T08, T09
**Bloqueia:** T15
**Requisitos:** RF-34, RF-35, RNF-10

---

## Objetivo

Entregar ao organizador a base completa do evento para prestação de contas e contato. Este é o **único** ponto do sistema autorizado a reunir dados pessoais de Inscrição com resultados de Cronometragem no mesmo documento — e essa autorização precisa ser um lugar único, nomeado e auditável (SDD BC-05).

## Escopo

### 1. Endpoint `GET /api/exportacao`

- Exige sessão de Operador válida (RF-35, RNF-10). Sem sessão: 401, sem exceção e sem token de URL compartilhável.
- Vive em `src/contexts/custodia/` — nenhum outro módulo pode montar esse cruzamento de dados. Regra de lint (T01) impede import cruzado equivalente fora daqui.
- Formato **CSV** com `;` como separador e BOM UTF-8, para abrir corretamente em Excel em português. Oferecer também XLSX se houver demanda do organizador.

### 2. Colunas (uma linha por Tentativa, com os dados do Participante repetidos)

`participante_id` · `nome` · `sobrenome` · `email` · `telefone` · `idade` · `menor_de_idade` · `responsavel_nome` · `responsavel_sobrenome` · `responsavel_telefone` · `consentimento_versao` · `consentimento_registrado_em` · `aceite_compartilhamento` · `inscrito_em` · `pitch` · `estado` · `tempo` (`mm:ss.cc`) · `tempo_ms` · `resolvido_em` · `operador` · `qtd_correcoes`

- Inclui Tentativas **Ausentes** e **Pendentes** — a exportação é a base completa, não a classificação (RF-21: o ausente permanece nos dados exportados).
- `tempo` formatado e `tempo_ms` bruto: um para leitura humana, outro para reprocessamento sem ambiguidade.

### 2.1 Lista de repasse — exportação separada e filtrada

O termo promete que o telefone só vai para a FIAP e para a escolinha **de quem autorizou** (D-23). Isso obriga uma saída própria, e não uma coluna que alguém filtra na planilha depois:

- conteúdo mínimo — nome e telefone —, **somente** de quem tem `aceite_compartilhamento = true`;
- nunca reaproveitar a exportação completa para esse fim: mandar o arquivo inteiro e pedir que filtrem do outro lado entrega o telefone de quem recusou, que é exatamente o que a caixa opcional existe para impedir;
- `aceite_compartilhamento` aparece na exportação completa como registro de auditoria, não como filtro a aplicar manualmente.

### 3. Auditoria da própria exportação

Registrar quem exportou e quando, em log persistente. Exportação é o momento de maior exposição de dado pessoal do sistema; precisa deixar rastro.

### 4. Desempenho

Geração em streaming, sem carregar 4000 linhas em memória de uma vez. Resposta com `Content-Disposition: attachment` e nome de arquivo com data.

### 5. Auditoria da base (métrica do PRD §7)

Incluir uma segunda exportação/relatório: **Tentativas sem tempo e sem marcação de ausência ao fim do evento** — a métrica primária cuja meta é zero. O organizador precisa conseguir rodar isso durante o evento para agir a tempo, não depois.

## Critérios de aceitação

- [ ] Acesso anônimo ao recurso é negado (RF-35, RNF-10) — verificado com `curl` sem cookie.
- [ ] O arquivo abre em planilha e contém **todos** os registros do evento, inclusive ausentes e pendentes (RF-34).
- [ ] Dados de responsável aparecem para menores e ficam vazios para maiores.
- [ ] Nenhum caractere acentuado quebra na abertura em Excel.
- [ ] O relatório de pendências lista exatamente as Tentativas não resolvidas.
- [ ] Toda exportação deixa registro de autor e instante.
- [ ] A lista de repasse não contém **nenhum** participante com `aceite_compartilhamento = false` — teste com massa que tem os dois casos (o seed já gera).
- [ ] Nenhum módulo fora de `custodia/` importa simultaneamente dados pessoais e resultados (verificado por lint e por leitura).

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `csv.ts` | Separador, BOM, escape — e a proteção contra fórmula |
| `consultas.ts` | O cruzamento autorizado, lido em lotes por cursor estável |
| `exportacao.ts` | Os três documentos e o fluxo da exportação completa |
| `servico.ts` | Composição |
| `app/api/exportacao/route.ts` | `GET ?tipo=completa\|repasse\|pendencias`, com sessão e rastro |
| `tests/exportacao.test.ts` | 24 testes |

### Medido contra o banco real

| | valor |
|---|---|
| Exportação completa | 2.973 linhas · **673,2 KB** · 663 ms |
| Colunas | 21, conforme o escopo |
| Lista de repasse | 1.267 pessoas (de 2.000) |
| Pendências | 292 |

### Um risco que a task não menciona e que estava aberto

**Injeção de fórmula em CSV.** Um Participante digita o próprio nome num
formulário público, sem autenticação. Se alguém se cadastrar como `=1+1` — ou
como algo bem menos inocente —, o Excel do organizador **executa** aquilo ao
abrir o arquivo. O caminho está todo montado neste sistema: entrada pública,
saída em planilha, aberta por alguém de confiança numa máquina de trabalho.

`escapar` prefixa com apóstrofo qualquer campo que comece com `=`, `+`, `-` ou
`@`. O Excel consome o apóstrofo ao exibir. O custo é que um telefone `+55…`
aparece como `'+55…` num editor de texto — e como `+55…` na planilha, que é
onde ele vai ser lido.

Não tratar seria supor que ninguém vai tentar. Pedir que a task previsse seria
supor que quem a escreveu conhecia o ataque.

### As três saídas são separadas porque a promessa exige

A lista de repasse podia ser uma coluna da exportação completa, filtrada na
planilha do outro lado. Aí o telefone de quem **recusou** já teria saído daqui —
e o termo promete que ele só vai para quem autorizou (D-23). A promessa só se
cumpre com o filtro **na consulta**.

`aceite_compartilhamento` continua na exportação completa, mas como registro de
auditoria: serve para conferir, não para filtrar à mão.

### O rastro vai para o log, não para o banco

O escopo pede registro persistente de quem exportou. Foi para o log estruturado
(stdout → agregador), e não para uma tabela — **porque T15 vai apagar o banco**.
Um registro de auditoria que desaparece junto com o dado que ele auditava não é
auditoria. O log sobrevive ao expurgo.

E o rastro sai **antes** do corpo: uma exportação em fluxo pode ser interrompida
no meio, e o que precisa ficar registrado é que alguém pediu a base — não que
conseguiu baixá-la inteira.

### Critérios de aceitação

- [x] Acesso anônimo é negado (RF-35, RNF-10). — as três saídas, e o teste confere que nenhum telefone aparece no corpo do 401.
- [x] O arquivo contém todos os registros, inclusive ausentes e pendentes (RF-34). — 2.973 linhas contra 2.973 Tentativas no banco, com a massa passando do tamanho do lote para provar que o cursor não pula nem repete.
- [x] Dados de Responsável aparecem para menores e ficam vazios para maiores.
- [x] Nenhum caractere acentuado quebra na abertura em Excel. — BOM conferido nos **bytes**; `Response.text()` descarta BOM inicial por especificação e a primeira versão do teste caiu nessa.
- [x] O relatório de pendências lista exatamente as Tentativas não resolvidas. — Ausente **é** desfecho e sai da métrica.
- [x] Toda exportação deixa registro de autor e instante. — inclusive a tentativa recusada por falta de sessão.
- [x] A lista de repasse não contém nenhum participante que recusou. — varredura sobre 300 semeados, com os dois casos.
- [x] Nenhum módulo fora de `custodia/` monta o mesmo cruzamento. — dois testes novos de fronteira: um confirma que a Custódia alcança os dois lados, outro que mais ninguém alcança.

### Aberto

- [ ] **Abrir o arquivo no Excel de verdade.** Separador, BOM e escape foram escritos para o Excel pt-BR e conferidos byte a byte, mas "abre corretamente em Excel" é afirmação sobre um programa que não está aqui. Entra no checklist de T21, junto com um teste de um nome que comece com `=`.
- [ ] **XLSX**, se o organizador pedir. O escopo diz "oferecer também se houver demanda"; não houve.

## Estado

**Concluída em 2026-08-23.** 24 testes novos, 537 no total. Desbloqueia **T15**
(retenção e exclusão), que agora tem a exportação como a saída a preservar antes
de apagar.
