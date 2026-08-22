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

---

## Resultado da execução — 2026-08-23

| Arquivo | Papel |
|---|---|
| `fluxo.ts` | A máquina de estados do lançamento, pura — é onde RF-18 vira prova |
| `mascaraDeTempo.ts` | `12345` → `01:23.45`, e a leitura do que foi de fato teclado |
| `api.ts` | As chamadas a T10, com rede caída separada de recusa do servidor |
| `Painel.tsx` | A tela: abas, fila, campo de tempo, confirmação, erros, atualização |
| `painel.module.css` | Tipografia grande, contraste alto, foco espesso |
| `page.tsx` | Server Component: guarda a sessão e passa o nome do Operador |
| `tests/fluxoDoPainel.test.ts` | 20 testes puros |
| `tests/painelDoOperador.test.tsx` | 11 testes de tela, todos por teclado |

### RF-18 deixou de depender de leitura

O critério pedia verificar **por leitura do código** que não existe caminho de
gravação fora da etapa de confirmação. Leitura confere o código de hoje; não
confere o de depois que alguém acrescentar um atalho com pressa.

O fluxo virou um redutor puro, e a verificação virou um teste que percorre
**todos** os pares de estado e evento e prova três coisas:

1. nenhum evento leva `lista` ou `tempo` direto a `gravando`;
2. `falhou` só é alcançável a partir de `gravando`;
3. a partir de `confirmar`, só o evento `confirmar` chega a `gravando`.

Juntas, elas fecham por indução: toda gravação passou por uma confirmação. Do
lado do componente, o único disparo de escrita está amarrado à etapa `gravando`
num efeito — não a um `onClick`. Um botão novo que despache `confirmar` passa
pela mesma porta; um que tente gravar direto não tem porta.

### Dois defeitos que o teste pegou e a leitura não pegaria

**A máscara se realimentava.** O campo exibe o texto formatado, então o
`onChange` recebe de volta os zeros que a própria máscara colocou. Digitar `1`,
`2`, `3` produzia `000:00.12` — o dígito mais antigo era empurrado para fora do
campo. Um Operador digitando `12345` gravaria um tempo errado, e a tela mostraria
o valor errado sem nenhum sinal de erro. Corrigido em `digitosDoCampo`, com um
teste que digita tecla a tecla e confere os cinco passos.

**O atalho que a task pede é inutilizável como está** (D-54). A T11 diz `1` e
`2` para trocar de Pitch. Só que o foco vive no campo de busca durante toda a
navegação da Fila, e `1` e `2` são justamente os dígitos que mais se digita no
campo de tempo — o atalho literal ou não funciona, ou troca de aba a cada tecla
do tempo. Ficou `Alt+1` / `Alt+2`, com as teclas sozinhas ainda valendo quando o
foco não está num campo de texto.

### Critérios de aceitação

- [x] Cinco lançamentos consecutivos concluídos **sem tocar no mouse** (RF-19). — teste que não chama `click` uma vez sequer e confere as cinco escritas.
- [x] Nenhum lançamento é gravado sem a confirmação com o nome em destaque (RF-18). — provado sobre o redutor, e conferido na tela: com o diálogo aberto, nada saiu para a rede.
- [x] Após gravar, os campos estão limpos e o foco está no campo de busca (RF-20).
- [x] Alternar Pitch altera a lista (RF-13); a lista inicial não traz lançados nem ausentes (RF-14). — o segundo vem da API, e T10 já o prova.
- [x] Dois homônimos são distinguíveis apenas pelo que a lista mostra (RF-15). — duas "Marina Costa", separadas por `4321` e `8765`.
- [x] Erro de rede não apaga o tempo digitado, e repetir não duplica. — a retentativa reenvia a **mesma chave**.
- [ ] **Um lançamento completo em ≤ 15 s, cronometrado com o supervisor (RNF-16).** Depende de gente e cronômetro; nenhum teste substitui.

### O que fica aberto, e por quê

RNF-16 é o único critério que não fecha aqui, e não por falta de implementação:
ele mede uma pessoa, não um programa. O fluxo foi desenhado para caber nos
quinze segundos — busca com foco automático, seta, Enter, cinco dígitos, Enter,
Enter — mas quanto disso o Operador leva depende do teclado do tablet, da luz e
de quanto ele já usou a tela antes. Entra no ensaio pré-evento junto com o teste
dos três leitores de QR (T07) e o ensaio de preenchimento (T06), todos reunidos
no checklist de T21.

Um efeito colateral do ensaio: se os quinze segundos não fecharem, o suspeito
mais provável é a etapa de confirmação, que é obrigatória por RF-18. A saída
nesse caso **não** é remover a confirmação — é reduzir o que vem antes dela.

## Estado

**Concluída em 2026-08-23**, com o critério de RNF-16 aberto por depender de
ensaio com pessoas. 31 testes novos, 458 no total.

Com isto a trilha de Cronometragem (T08–T11) fecha. Restam Classificação
(T12, T13), Custódia (T14, T15) e as tarefas de qualidade e operação (T16–T21).
