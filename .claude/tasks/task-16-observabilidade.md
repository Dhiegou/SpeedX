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
