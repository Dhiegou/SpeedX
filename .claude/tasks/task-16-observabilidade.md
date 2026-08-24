# T16 — Observabilidade, métricas e alertas

**Contexto SDD:** transversal · fluxo FL-12
**Depende de:** T01
**Bloqueia:** T18, T19
**Requisitos:** RNF-05 e as métricas do PRD §7

---

## Objetivo

Tornar o dia do evento observável em tempo real. O PRD é taxativo: o evento dura um dia, não há segunda chance. Descobrir um problema pelo relato de um participante é tarde demais.

## Princípio de projeto (SDD FL-12)

A coleta **jamais pode adicionar latência ao caminho da requisição nem falhar junto com ela**. Emissão de métrica é não bloqueante e sem confirmação: se o coletor cair, a aplicação não percebe. Perder amostra de métrica é aceitável; perder o serviço por causa do instrumento, não.

**Exceção:** alertas e registros de auditoria usam transporte confiável.

## Escopo

### 1. Health check

`GET /api/saude` — verifica conectividade com o banco e devolve versão da aplicação e instante do servidor. Usado pelo monitor externo.

### 2. Monitor externo

Verificação a cada 60 s de `/` , `/classificacao` e `/api/saude`, com alerta por canal que alguém realmente lê no dia (SMS/WhatsApp/Telegram, não e-mail).

### 3. Métricas técnicas

| Métrica | Motivo |
|---|---|
| Latência p50/p95/p99 de `/api/classificacao` | RNF-01 (≤ 2 s com 500 acessos) |
| Taxa de acerto do cache de borda | Se cair, o banco será atingido |
| Latência de `POST /api/inscricao` e `POST /api/painel/tempo` | RNF-15, RNF-16 |
| Erros 5xx por minuto | RNF-05 |
| 429 por minuto | Limite de taxa calibrado errado bloquearia participantes legítimos |
| Conexões e latência do banco | RNF-02 |

### 4. Métricas de produto (PRD §7)

| Métrica | Como | Meta |
|---|---|---|
| Taxa de conclusão do cadastro | eventos `form_iniciado` / `form_concluido` | ≥ 95% |
| Tempo mediano de cadastro | diferença entre os dois eventos | ≤ 90 s |
| Lançamentos corrigidos | `count(lancamento where tipo='correcao') / total` | ≤ 1% |
| Tentativas não resolvidas | consulta ao vivo (T14) | 0 ao fim |
| Consultas à classificação por participante | acessos ÷ inscritos | ≥ 2 |
| Uso da busca por nome | evento anônimo de interação | ≥ 30% |
| Rejeições no bloco de responsável | contagem de 422 nesse bloco | ≤ 10% |

Todos os eventos de produto são **anônimos**: sem nome, e-mail, telefone ou identificador pessoal (RNF-08).

### 5. Painel do dia

Uma tela simples (pode ser o painel do provedor) reunindo: inscritos por hora, tentativas pendentes por Pitch, lançamentos por minuto, erros, latência. É o que o time olha durante o evento.

### 6. Alertas

- Qualquer indisponibilidade de `/api/saude`.
- p95 da classificação acima de 2 s por mais de 2 minutos.
- Taxa de 5xx acima de 1%.
- Zero cadastros por 10 minutos durante a janela de inscrição (sinal de falha silenciosa).

## Critérios de aceitação

- [ ] Derrubar o coletor de métricas em ambiente de teste **não** afeta latência nem disponibilidade da aplicação (FL-12).
- [ ] O monitor externo detecta uma indisponibilidade simulada em ≤ 2 minutos e dispara alerta no canal escolhido.
- [ ] Todas as métricas do PRD §7 têm origem definida e são consultáveis durante o evento.
- [ ] Nenhum evento de telemetria carrega dado pessoal (verificado por leitura do código de emissão).
- [ ] `/api/saude` responde em ≤ 300 ms e não expõe detalhe interno de infraestrutura.

---

## Acrescentado por T13 — 2026-08-23

- [ ] **Derivar a métrica de uso da busca da Classificação a partir do log do servidor**, e não de telemetria do navegador. A T13 pedia instrumentar o uso da busca para a métrica secundária do PRD (≥ 30% das sessões); não foi implementado de propósito, porque seria o único evento emitido pelo navegador em todo o sistema — D-33 tirou a métrica do cadastro do cliente justamente para evitar isso, e reintroduzir aqui exigiria uma URL de coletor exposta na página mais pública do evento. O log de `classificacao.leitura` já traz volume e razão entre 200 e 304; combinado com o número de leituras únicas, responde à mesma pergunta sem nada sair do aparelho de ninguém.

---

## Resultado da execução — 2026-08-24

| Arquivo | Papel |
| --- | --- |
| `src/infra/saude.ts` | A sondagem do banco, com prazo |
| `app/api/saude/route.ts` | `GET /api/saude` — público, mudo sobre infraestrutura |
| `src/shared/metricas.ts` | Percentis, relatórios e os quatro alertas, tudo puro |
| `src/contexts/custodia/metricas.ts` | O painel do dia: o que só o banco sabe |
| `app/api/metricas/route.ts` | `GET /api/metricas` — só Operador, só contagem |
| `scripts/metricas.ts` | `npm run metricas` — relatório e alertas a partir do log |
| `docs/monitoramento.md` | O que observar, com que frequência, quem é acordado |
| `tests/observabilidade.test.ts` | 31 testes; mais 1 de fronteira |

### O log já era a telemetria; faltava alguém ler

A decisão que organiza a task (D-67): **não há um segundo caminho de
telemetria**. Toda rota já emitia evento, resultado, status e duração desde T05.
Um emissor paralelo de métricas seria uma segunda coisa a manter, a sanear e a
derrubar sem querer — e mediria o mesmo. O que faltava era a leitura, e é ela
que `shared/metricas.ts` e `npm run metricas` entregam.

Isso torna o critério de FL-12 verdadeiro por construção e não por disciplina:
**não existe coletor a derrubar**. O transporte é a saída padrão, dentro de um
`try` que engole a própria falha. O teste que prova isso força o `write` a
lançar e verifica que a operação segue.

### `TELEMETRY_URL` foi removida (D-66)

Declarada em T01, documentada no README e no `.env.example`, **nunca usada**.
Uma configuração que promete um caminho inexistente é pior que nenhuma: quem
chega depois a preenche e conclui que a telemetria está ligada. No lugar entrou
`APP_VERSION`, que `/api/saude` devolve e T19 preenche com o commit.

### O log da própria sondagem corrigiu o teto da sondagem

Escrevi `LIMITE_DA_SONDAGEM_MS = 200` amarrado ao critério de aceitação
("`/api/saude` em 300 ms"). Soa correto e está errado: são grandezas
diferentes. O critério descreve o regime; o teto existe para distinguir banco
**pendurado** de banco lento.

Quem mostrou foi o relatório rodando contra o log do servidor de verdade: a
primeira sondagem depois de subir o processo levou **191 ms**, porque inclui
abrir a primeira conexão do pool. Com teto de 200, um monitor batendo logo após
o deploy tinha chance real de receber `degradado` de um sistema saudável — um
alarme falso no minuto em que alguém está olhando, que é a forma mais rápida de
um alerta perder crédito. Teto agora é 1 s.

### Uma exceção de lint, com um arquivo de largura

`/api/saude` é a única rota que alcança o banco sem passar por um caso de uso.
A regra existe para impedir que uma rota contorne a regra de negócio pelo
caminho de baixo, e aqui não há o que contornar: não é regra de negócio "o banco
está de pé". Mesmo feitio da exceção de `classificacao/projecao.ts`, e
`tests/fronteiras.test.ts` falha se ela crescer — inclusive para
`app/api/saude/apoio.ts` e `app/api/saude2/route.ts`.

### Duas rotas, e não uma

`/api/saude` responde "o processo está de pé"; `/api/metricas` responde "o
evento está indo bem". Juntá-las faria a rota que o monitor bate a cada minuto
carregar seis agregações — e cair junto com o banco, apagando justamente o sinal
que distingue "banco fora" de "aplicação fora".

O painel do dia mora na Custódia porque a consulta atravessa BC-01 e BC-02 no
mesmo documento, e BC-05 é o único lugar autorizado a isso (SDD §1). A
alternativa — meia consulta em Inscrição, meia em Cronometragem, soma na rota —
move o cruzamento para fora do lugar onde ele é auditável.

### Medições

| | resultado |
| --- | --- |
| `/api/saude` em regime | 13 a 33 ms (5 medições) |
| `/api/saude` na primeira chamada | ~191 ms (abre a conexão do pool) |
| `/api/metricas` contra a base de 2000 | seis agregações em 190 ms |
| Relatório contra o log do servidor real | 34 registros, 3 eventos, sem alerta |
| Relatório contra log degradado sintético | os 4 alertas, código de saída 1 |

### Critérios de aceitação

- [x] Derrubar o coletor não afeta latência nem disponibilidade (FL-12). — verdadeiro por construção: não há coletor. Teste força a escrita em stdout a lançar e verifica que a operação segue e que o registro continua íntegro.
- [ ] O monitor externo detecta indisponibilidade em ≤ 2 min e alerta. — **não verificável aqui**: exige contratar o serviço, que depende de PE-05. Especificado por inteiro em `docs/monitoramento.md` §3 e no checklist de T21.
- [x] Todas as métricas do PRD §7 têm origem definida e são consultáveis. — seis das sete, com a tabela de origem em `docs/monitoramento.md` §5. A sétima está abaixo.
- [x] Nenhum evento de telemetria carrega dado pessoal. — a forma de `EntradaDeLog` continua fechada; o campo `contagens` acrescentado em T15 só aceita números. Teste varre o corpo de `/api/metricas` atrás de nome, e-mail e telefone semeados.
- [x] `/api/saude` responde em ≤ 300 ms e não expõe detalhe interno. — 13 a 33 ms medidos; o teste confirma que a resposta de 503 não contém a cadeia de conexão, nem `ECONNREFUSED`, nem a porta.

### Aberto

- [ ] **Uso da busca por nome (≥ 30%) não é mensurável neste desenho.** A busca da Classificação roda inteira no navegador, sobre o documento já carregado — os testes de T13 exigem zero `fetch` durante a busca. Medir exigiria telemetria de navegador na página mais pública do evento, que D-33 tirou do sistema. O adendo de T13 sugeria derivar da razão 200/304, mas isso mede **revalidação**, não uso da busca; está no relatório com esse nome. Encaminhado a T21 para decisão explícita: ou a métrica cai do PRD, ou alguém aceita a telemetria de olhos abertos.
- [ ] **Taxa de acerto do cache de borda** (§3) não chega ao servidor por definição. Só o painel do provedor sabe. Entra em T19.
- [ ] **O monitor externo e o teste de disparo real do canal** — T19 contrata, T21 confere.

## Estado

**Concluída em 2026-08-24.** 32 testes novos, 589 no total. Desbloqueia **T18**
(que agora tem de onde tirar p95) e **T19** (que tem o que configurar).
