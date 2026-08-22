# T11 — UI do painel do Operador

**Contexto SDD:** BC-02
**Depende de:** T10
**Bloqueia:** —
**Requisitos:** RF-13 a RF-22, RF-24, RNF-16

---

## Objetivo

Entregar a tela que o Operador usa por dez horas seguidas, a ~3 lançamentos por minuto. O PRD é claro: qualquer fricção de interface aqui se acumula em fila de gente esperando. **Teclado é o dispositivo primário; o mouse é a exceção.**

## Escopo

### 1. Layout `/painel`

- Duas abas ou seletor de Pitch, alternável por atalho de teclado (`1` e `2`) — RF-13.
- Fila visível com contagem de pendentes, em fonte grande o suficiente para leitura rápida.
- Cada item: **Nome Sobrenome · ****1234** (últimos 4 dígitos do telefone) — RF-15.
- Ordem: do cadastro mais antigo para o mais recente (RF-14).

### 2. Fluxo de lançamento inteiramente por teclado (RF-19)

Sequência-alvo, sem tocar no mouse:

```
[digita nome] → ↓/↑ navega → Enter seleciona
→ [digita tempo mm:ss.cc] → Enter
→ tela de confirmação com o NOME EM DESTAQUE → Enter confirma / Esc cancela
→ foco volta ao campo de busca, campos limpos
```

- Foco inicial no campo de busca ao carregar a página.
- Campo de tempo com máscara `mm:ss.cc`, aceitando digitação contínua ("12345" → `01:23.45`).
- **Confirmação obrigatória** exibindo o nome em destaque antes de gravar (RF-18). Nunca gravar em um único Enter sem essa etapa.
- Após gravar: limpar campos, devolver foco ao início, exibir confirmação efêmera (RF-20).
- Atalhos adicionais: `Esc` cancela e limpa; tecla dedicada para marcar ausência do item selecionado (com confirmação).

### 3. Ações secundárias

- **Marcar ausente** (RF-21) — a partir da Fila, com confirmação exibindo o nome.
- **Corrigir tempo** (RF-22) — via busca global; mostra o valor atual, pede o novo e confirma exibindo nome, valor anterior e novo.
- **Adicionar Pitch** (RF-24) — a partir do participante encontrado, botão/atalho para inscrevê-lo no outro Pitch; feedback imediato de que entrou na Fila.
- **Histórico** (RF-23) — ver quem lançou e quando, acessível a partir do item.

### 4. Robustez operacional

- Falha de rede: manter o valor digitado na tela, exibir erro claro e permitir repetir **reusando a mesma chave de idempotência**. Jamais limpar campo por causa de erro.
- Conflito 409: mensagem explicando que outro operador já registrou, com o valor atual, oferecendo correção.
- Atualização periódica da Fila (ex.: a cada 10 s) **sem** roubar o foco nem reordenar o item em edição.
- Indicador de sessão e de conectividade sempre visível.

### 5. Acessibilidade e ergonomia

- Contraste alto, tipografia grande — o painel é usado em pé, sob sol ou luz ruim.
- Todos os estados de foco visíveis.
- Nenhuma ação destrutiva alcançável por Enter acidental sem confirmação.

## Critérios de aceitação

- [ ] Cinco lançamentos consecutivos concluídos **sem tocar no mouse** (RF-19).
- [ ] Nenhum lançamento é gravado sem a etapa de confirmação com o nome em destaque (RF-18) — verificado por leitura do código: não existe caminho de gravação fora do fluxo de confirmação.
- [ ] Após gravar, os campos estão limpos e o foco está no campo de busca (RF-20).
- [ ] Alternar Pitch altera a lista (RF-13); a lista inicial não traz lançados nem ausentes (RF-14).
- [ ] Dois homônimos são distinguíveis apenas pelo que a lista mostra (RF-15).
- [ ] Um lançamento completo é concluído em ≤ 15 s, cronometrado com o supervisor do evento (RNF-16).
- [ ] Erro de rede não apaga o tempo digitado, e repetir não duplica o lançamento.
