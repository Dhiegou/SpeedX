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
