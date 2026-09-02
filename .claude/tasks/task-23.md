# T23 — Calibrar o limite de taxa do cadastro

**Contexto SDD:** BC-01 Inscrição
**Depende de:** T05 (mecanismo), T18 (medição)
**Bloqueia:** T19 (publicação), T21 (fechamento da auditoria)
**Requisitos:** RNF-12, RNF-15
**Decisões:** D-27 (a calibração é decisão de T21), item 3.13 do checklist, risco R-2
**Prazo:** antes de publicar, e a razão do prazo está na seção 1

---

## Objetivo

Substituir os padrões atuais do limite de taxa do cadastro por valores que não recusem a fila do evento, sem abrir mão da contenção que RNF-12 pede.

Esta tarefa não constrói mecanismo nenhum. O mecanismo de T05 está correto, medido e testado: em 200 cadastros do mesmo IP ele aceitou exatamente 30 e recusou 170, que é o comportamento configurado. O que está errado é a configuração, e ela é de quatro números.

## O problema, com o número medido

T18 rodou 200 cadastros legítimos partindo de um mesmo IP, que é o que acontece atrás de um NAT.

| | medido |
|---|---|
| Criados (201) | **30** |
| Recusados por limite (429 `limite_ip`) | **170** |
| Falhas de aplicação | 0 |
| Latência do cadastro | p95 27,9 ms |

Trinta é exatamente `RATE_LIMIT_CADASTROS_POR_JANELA`. No local do evento dezenas de celulares saem do mesmo Wi-Fi, e em rede móvel a operadora coloca milhares de assinantes atrás de um endereço. **Com os padrões atuais, o 31º participante da fila é recusado**, e a tela dele diz para esperar sem que ele tenha feito nada de errado.

O relatório completo está em `docs/relatorio-carga.md` §4.

---

## Escopo

### 1. Decidir os valores, e decidir antes de publicar

Esta é a única parte que não é código, e é a que tem prazo.

A proposta de T18, com a conta em `docs/relatorio-carga.md` §4:

| variável | hoje | proposto |
|---|---|---|
| `RATE_LIMIT_CADASTROS_POR_JANELA` | 30 | **300** |
| `RATE_LIMIT_CADASTROS_POR_HORA` | 100 | **1200** |
| `RATE_LIMIT_JANELA_SEGUNDOS` | 600 | 600 (sem mudança) |

A conta que sustenta os números: 2000 participantes, chegada concentrada em quatro horas, três a cinco IPs de saída, o que dá um pico plausível de aproximadamente 150 cadastros por IP a cada 10 minutos. A proposta é o dobro disso.

**Por que o prazo é "antes de publicar" e não "antes do evento".** Mudar variável de ambiente na Vercel exige redeploy da última publicação (`docs/deploy.md` §6), e há congelamento de deploy no dia 24/10. No dia, a única alavanca que sobra é `RATE_LIMIT_ATIVO=false`, que não calibra: desliga o limite inteiro e deixa o cadastro sem contenção alguma pelo resto do evento. Decidir agora é a diferença entre um número escolhido e um interruptor de emergência.

### 2. Revisar a premissa de concentração antes de fixar 300

A proposta assume chegada distribuída em quatro horas e três a cinco IPs. As duas premissas merecem uma conferência com quem conhece o evento, porque o número de 300 tem folga de exatamente 2× sobre elas.

Dois cenários que estreitam essa folga:

- **Um IP só, e não três a cinco.** Se o Wi-Fi do local for a rota de quase todo mundo, o divisor cai e o pico por IP sobe na mesma proporção.
- **Chegada em rajada na abertura.** Uma fila que se forma na abertura concentra numa janela de 10 minutos o que a conta distribuiu em quatro horas.

Se qualquer dos dois for plausível, os valores devem subir. O custo de subir é baixo: o limite existe contra automação em escala, e um atacante decidido não passa pelo NAT do evento. O custo de errar para baixo é participante recusado na fila.

**A decisão pede uma resposta a uma pergunta só, para quem organiza:** as pessoas vão se inscrever pelo Wi-Fi do local ou pelo próprio 4G, e a chegada é espalhada ou concentrada na abertura?

### 3. Aplicar os valores nos dois lugares onde eles moram

Os padrões vivem no código, em `src/shared/env.ts`:

```
RATE_LIMIT_CADASTROS_POR_JANELA: z.coerce.number().int().positive().default(30),
RATE_LIMIT_JANELA_SEGUNDOS:      z.coerce.number().int().positive().max(86_400).default(600),
RATE_LIMIT_CADASTROS_POR_HORA:   z.coerce.number().int().positive().default(100),
```

Trocar o valor **no `default` do código**, e não só na variável de ambiente da Vercel. O motivo é que o padrão é o que vale quando alguém esquece de definir a variável, e um padrão que recusa a fila é uma armadilha esperando um ambiente novo. Homologação, ambiente local e qualquer instância futura herdam o que estiver escrito aqui.

`.env.example` acompanha, com o comentário atualizado: hoje ele diz "Calibrar em T18, decidir em T21", e essa frase deixa de ser verdadeira quando esta tarefa fechar.

### 4. Fixar a decisão em teste

Um teste que leia os padrões vigentes e recuse valores abaixo do piso decidido. O que ele protege não é o número em si, e sim a memória de por que ele é esse: sem teste, o padrão volta a 30 na primeira vez que alguém copiar um `.env` antigo, e o defeito só aparece com a fila parada.

`tests/deploy.test.ts` já verifica configuração de publicação e é o lugar natural.

O teste deve falhar com mensagem que nomeie o motivo, não só o valor esperado. Algo na linha de "o padrão recusaria a fila do evento; ver relatorio-carga.md §4".

### 5. Verificar que a recusa é observável no dia

O relatório de métricas já conta as respostas 429 (`scripts/metricas.ts`). O que falta conferir é se existe **alerta**, e não apenas contagem num relatório que alguém precisa lembrar de rodar.

Um 429 no cadastro durante o evento é o sinal de que a calibração errou, e é um sinal que chega tarde demais se ninguém estiver olhando. Confirmar que a contagem de 429 do escopo `cadastro` está entre os alertas de T16; se não estiver, incluir.

Este item pode revelar que não há nada a fazer. Se for o caso, registrar isso por escrito é o resultado.

### 6. Atualizar o que aponta para esta pendência

Quatro lugares afirmam que a calibração está aberta, e todos passam a estar errados quando ela fechar:

- `docs/checklist-pre-evento.md`, item 3.13 e risco R-2
- `docs/relatorio-carga.md` §4, que diz "a decisão é de T21"
- `.claude/tasks/task-18-testes-de-carga.md`, pendência final
- `README.md`, linha de T18
- `CONTEXT.md`, com a decisão nova na numeração corrente

O risco R-2 não some do checklist: ele muda de mitigação. Deixa de ser "`RATE_LIMIT_ATIVO=false` derruba o limite" e passa a ser "os valores foram calibrados em T23 sobre medição; a alavanca continua existindo para o caso de a calibração ter errado".

---

## Fora de escopo

- **Trocar o mecanismo de identificação.** O IP é uma identidade ruim atrás de NAT, e trocá-la por algo melhor é projeto próprio, não calibração. O sistema já tem uma segunda defesa contra automação que não depende de IP: o token de formulário com tempo mínimo de preenchimento (`FORMULARIO_SEGUNDOS_MINIMOS`), que esta tarefa não toca.
- **O limite de login do painel.** Faixas próprias, decisão própria, e `RATE_LIMIT_ATIVO` deliberadamente não o alcança (D-27). Afrouxar o cadastro não afrouxa a senha do Operador.
- **A remoção dos três índices** que T18 encontrou sem uso. Achado do mesmo relatório, tarefa diferente.

---

## Critérios de aceitação

- [x] Os três valores decididos e registrados, com o cenário de chegada que os sustenta escrito junto. — **800 / 2400 / 600**, registrados em D-90. O cenário: conectividade mista confirmada com o organizador (Wi-Fi **não garantido** no local, mais dados móveis), concentração de chegada **não confirmada**, valores escolhidos pelo pior caso plausível.
- [x] `src/shared/env.ts` com os novos `default`, e `.env.example` coerente.
- [ ] **As variáveis definidas nos dois ambientes da Vercel, produção e homologação.** — *pendente, e é a única coisa que falta.* Exige acesso ao painel da Vercel — comandos prontos em `docs/deploy.md` §6; sem elas os ambientes publicados herdam o padrão do código, que agora já é o valor calibrado — a definição explícita é para que o número fique visível a quem operar no dia.
- [x] Teste que falha se o padrão do código voltar a um valor que recusaria a fila, com mensagem que explique o motivo. — `tests/deploy.test.ts`, cinco asserções. Verificado ao contrário, com o padrão de volta em 30: *"RATE_LIMIT_CADASTROS_POR_JANELA=30, abaixo de 800: o padrão recusaria a fila do evento; ver docs/relatorio-carga.md §4…"*.
- [x] 200 cadastros do mesmo IP passam sem 429. — **200 criados (201), 0 recusados**, contra o artefato de produção e o banco `speedx_carga`. Conferido também no banco: 200 marcas na janela, todas sob um único identificador, e nenhum `limite_ip` no log. Tabela comparativa em `docs/relatorio-carga.md` §4.
- [x] A contagem de 429 do cadastro está entre os alertas. — **Não estava.** T16 tinha quatro alertas e nenhum olhava para 429; a contagem existia só no relatório de métricas. Incluído como `cadastro_limitado`, gravidade crítica, limiar zero, contando apenas `limite_ip` — a recusa por `anti_automacao` é a outra defesa e não fala sobre esta calibração.
- [x] Os cinco documentos da seção 6 atualizados, com R-2 remitigado em vez de removido.
- [x] `npm run check` e `npm test` limpos. — 645 testes em 35 arquivos, lint, typecheck e formatação sem apontamento.

---

## Nota sobre o que esta tarefa não resolve

A medição de T18 rodou numa máquina só, sem borda no meio. Ela é suficiente para esta decisão, porque o limite de taxa é contagem no banco e não depende de cache, mas não substitui a verificação contra o ambiente publicado que T19 espera.

Depois de publicar, vale repetir o cenário de cadastro contra o alvo real. Se os 429 aparecerem lá com os valores novos, a premissa de chegada da seção 2 é que estava errada, e o número sobe de novo.