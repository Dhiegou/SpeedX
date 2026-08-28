# Tasks — Sistema de Cadastro e Classificação de Corrida

Plano de execução derivado de [PRD.md](../../PRD.md) (v2.0) e [SDD.md](../../SDD.md).
Cada arquivo é uma tarefa autocontida: objetivo, escopo, requisitos cobertos, dependências e critérios de aceitação.

---

## Convenções

- **Terminologia:** o termo oficial é **Cockpit** — confirmado pelo organizador em 2026-08-25, porque o evento é de simulador e não há pista física (D-75). Na tela, Cockpit; no banco e no contrato da API, o identificador segue `pitch`.
- **Rastreabilidade:** toda tarefa lista os `RF-xx` / `RNF-xx` que fecha. Nenhum requisito do PRD fica órfão (ver matriz abaixo).
- **Restrições inegociáveis** (Anexo do PRD e do SDD):
  1. Verificação de resultado pela leitura do código produzido, não pela renderização no navegador.
  2. Toda validação de interface é reaplicada de forma independente no servidor.
  3. Nenhuma consulta a dados parte do navegador do usuário final.
- **Definition of Done** de qualquer tarefa: código + teste automatizado do critério de aceitação + as três restrições acima respeitadas.

---

## Ordem sugerida e dependências

```
T01 Fundação
 ├─ T02 Esquema de dados
 │   ├─ T04 Domínio Inscrição ── T05 Endpoint de cadastro ── T06 UI de cadastro ── T07 QR code
 │   │                                    ↑
 │   │                            T03 Termo de consentimento
 │   ├─ T08 Identidade e Acesso ── T09 Domínio Cronometragem ── T10 API do painel ── T11 UI do painel
 │   ├─ T12 Projeção de Classificação ── T13 UI da Classificação
 │   └─ T14 Exportação ── T15 Retenção e exclusão
 └─ T16 Observabilidade

T17 Testes automatizados   (acompanha T04–T15)
T18 Testes de carga        (depende de T13 e T19)
T19 Deploy e infraestrutura
T20 Contingência offline
T21 Auditoria de privacidade e checklist pré-evento  (última)
```

Depois de T02, três trilhas correm em paralelo: Inscrição (T03–T07), Cronometragem (T08–T11) e Classificação (T12–T13).

**Concluídas:** T01 a T17, mais a T22 (renomeação de `pitch` para `cockpit`, fora da ordem porque nasceu de uma decisão do organizador). As cinco trilhas de produto estão fechadas — Inscrição, Cronometragem, Classificação e Custódia, esta última com exportação (T14) e ciclo de vida do dado (T15). A observabilidade (T16) está de pé e a suíte (T17) cobre os 53 requisitos do PRD, com rastreabilidade verificada por teste.

**T19 está parcial**, e a divisão é limpa: tudo o que é código, configuração e documento está pronto — Vercel em `gru1`, Neon em São Paulo, UptimeRobot, `docs/deploy.md` e `docs/plano-do-dia.md`. Faltam as contas criadas e **um domínio**, e é ele que segura quatro dos sete critérios de aceitação, o QR definitivo de T07 e a partida de T18.

**T18 está parcial pelo mesmo motivo**: quatro dos seis critérios fechados com número (`docs/relatorio-carga.md`), um reprovado de propósito — o limite de taxa recusaria a fila — e um adiado por depender de aparelho em 3G.

**T20 está concluída, menos o ensaio**: `npm run fichas` gera a ficha numerada, o termo integral e a folha de tempos, todos lendo o mesmo termo que a tela, e um teste compara papel e esquema nos dois sentidos. Imprimir e ensaiar são do dia.

Resta **T21**, mais a metade externa de T18 e T19.

---

## Índice

| # | Tarefa | Contexto (SDD) | Requisitos |
|---|---|---|---|
| [T01](task-01-fundacao-do-projeto.md) ✅ | Fundação do projeto e tooling | — | restrições de implementação |
| [T02](task-02-esquema-de-dados.md) ✅ | Esquema de dados e migrações | todos | RNF-02, RF-23, RF-25 |
| [T03](task-03-termo-de-consentimento.md) ✅ | Termo de consentimento e textos legais | BC-01 | RF-08, RF-09, RNF-07, RNF-11 |
| [T04](task-04-dominio-inscricao.md) ✅ | Domínio de Inscrição | BC-01 | RF-02 a RF-08, RNF-07, RNF-13 |
| [T05](task-05-endpoint-de-cadastro.md) ✅ | Endpoint de cadastro | BC-01 | RF-01, RNF-12, RNF-13, RNF-17 |
| [T06](task-06-ui-de-cadastro.md) ✅ | UI pública de cadastro | BC-01 | RF-02 a RF-10, RNF-15, RNF-17, RNF-18 |
| [T07](task-07-rota-de-entrada-qr.md) ✅ | Rota de entrada e QR code | BC-01 | RF-01, RNF-04 |
| [T08](task-08-identidade-e-acesso.md) ✅ | Identidade e Acesso | BC-04 | RF-11, RF-12, RNF-14 |
| [T09](task-09-dominio-cronometragem.md) ✅ | Domínio de Cronometragem | BC-02 | RF-17, RF-21 a RF-25 |
| [T10](task-10-api-do-painel.md) ✅ | API do painel do Operador | BC-02 | RF-12 a RF-16, RF-21 a RF-25 |
| [T11](task-11-ui-do-painel.md) ✅ | UI do painel do Operador | BC-02 | RF-13 a RF-22, RF-24, RNF-16 |
| [T12](task-12-projecao-classificacao.md) ✅ | Projeção e endpoint da Classificação | BC-03 | RF-26 a RF-33, RNF-01, RNF-03, RNF-08, RNF-09 |
| [T13](task-13-ui-classificacao.md) ✅ | UI pública da Classificação | BC-03 | RF-27 a RF-33, RNF-18 |
| [T14](task-14-exportacao.md) ✅ | Exportação de dados | BC-05 | RF-34, RF-35, RNF-10 |
| [T15](task-15-retencao-e-exclusao.md) ✅ | Retenção e exclusão de dados | BC-05 | RNF-11 |
| [T16](task-16-observabilidade.md) ✅ | Observabilidade, métricas e alertas | — | RNF-05, métricas do PRD §7 |
| [T17](task-17-testes-automatizados.md) ✅ | Testes automatizados | todos | verificações do PRD §5 e §6 |
| [T18](task-18-testes-de-carga.md) ◐ | Testes de carga e desempenho | BC-03 | RNF-01 a RNF-04 |
| [T19](task-19-deploy-e-infraestrutura.md) ◐ | Deploy e infraestrutura | — | RNF-01, RNF-04, RNF-05, RF-23, RF-31 |
| [T20](task-20-contingencia-offline.md) ✅ | Contingência offline | — | RNF-06 |
| [T21](task-21-auditoria-e-checklist.md) | Auditoria de privacidade e checklist pré-evento | todos | RNF-08 a RNF-10, SDD §6 |
| [T22](task-22-renomear-pitch-para-cockpit.md) ✅ | Renomear `pitch` para `cockpit` no código e no banco | §3 | — (dívida de linguagem) |

---

## Matriz de cobertura de requisitos

| Requisito | Tarefa(s) |
|---|---|
| RF-01 | T05, T07 |
| RF-02 a RF-07 | T04, T06 |
| RF-08, RF-09 | T03, T04, T06 |
| RF-10 | T06 |
| RF-11, RF-12 | T08, T10 |
| RF-13 a RF-16 | T10, T11 |
| RF-17 a RF-20 | T09, T11 |
| RF-21 a RF-25 | T09, T10, T11 |
| RF-26 a RF-33 | T12, T13 |
| RF-34, RF-35 | T14 |
| RNF-01 a RNF-04 | T12, T18, T19 |
| RNF-05 | T16, T19 |
| RNF-06 | T20 |
| RNF-07 | T03, T04 |
| RNF-08 a RNF-10 | T12, T14, T21 |
| RNF-11 | T15 |
| RNF-12, RNF-13 | T05 |
| RNF-14 | T08 |
| RNF-15, RNF-17, RNF-18 | T06, T13 |
| RNF-16 | T11 |

---

## Decisões pendentes com o organizador

1. ~~Termo oficial: **Pitch** ou **Pista** (SDD §3 e §6)~~ — resolvido em 2026-08-25: nenhum dos dois. São dois **Cockpits**, que é onde fica o simulador (D-75).
2. ~~Prazo de retenção dos dados após o evento (RNF-11)~~ — resolvido em 2026-08-19: máximo de 10 dias após o evento.
3. ~~Canal de contato para solicitação de exclusão (RF-09)~~ — resolvido em 2026-08-19: presencial, no ponto de inscrição durante o evento.
4. ~~Aprovação por escrito do texto de consentimento (RF-09)~~ — resolvida em 2026-08-19: `v1.0-2026-08-19` aprovada e registrada em `docs/aprovacao-termo.md`.
5. ~~Data do evento (PE-06)~~ — resolvida em 2026-08-25: **24 de outubro de 2026**, em São Paulo. A retenção vence em 04/11/2026, e é essa a data-base de `docs/retencao.md`.
6. Hospedagem (PE-05) — **quase fechada**. A aplicação vai para a **Vercel gratuita**, funções em `gru1` (D-76, D-79); o Postgres vai para o **Neon**, `aws-sa-east-1` (D-79); o monitor é o **UptimeRobot gratuito** (D-82). **Falta o domínio**, e sem ele o QR de T07 segue provisório e quatro critérios de T19 não têm contra o que rodar. É o item de maior prazo do projeto.

O raciocínio por trás das decisões já tomadas está em [CONTEXT.md](../../CONTEXT.md).
