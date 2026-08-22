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
