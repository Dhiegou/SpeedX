# T17 — Testes automatizados

**Contexto SDD:** transversal
**Depende de:** T04 em diante (acompanha cada tarefa)
**Bloqueia:** T21
**Requisitos:** as *Verificações* de cada RF/RNF do PRD §5 e §6

---

## Objetivo

Transformar cada linha de *Verificação* do PRD em teste executável. O PRD já escreveu a suíte: cada requisito traz o critério de verificação. Esta tarefa é a tradução literal disso.

## Estrutura

| Camada | Ferramenta | Cobre |
|---|---|---|
| Unidade | Vitest | domínio de Inscrição (T04), máquina de estados de Cronometragem (T09), `parseTempo`/`formatTempo`, `paraNomePublico` |
| Integração | Vitest + banco de teste | endpoints, transações, invariantes do banco, concorrência, idempotência |
| End-to-end | Playwright | fluxo de cadastro, fluxo de lançamento por teclado, classificação |

## Casos obrigatórios

### Inscrição
- Idades de fronteira: 12 (rejeita), 13, 17, 18, 19 — bloco de responsável presente só em 13 e 17 (RF-04, RF-05).
- Menor sem bloco completo rejeitado (RF-06).
- Idade corrigida de menor para maior descarta dados do responsável (RF-07).
- Envio sem aceite rejeitado (RF-08).
- Sem Pitch rejeita; um e dois Pitches aceitam (RF-03).
- **Requisição forjada fora do navegador** burlando toda validação de tela é rejeitada (RNF-13).
- Reenvio com mesma chave de idempotência não duplica (FL-03).
- Limite de taxa dispara 429 (RNF-12).

### Cronometragem
- `01:23.45` aceito e reexibido idêntico (RF-17).
- Nenhuma gravação sem etapa de confirmação (RF-18) — teste e2e.
- Cinco lançamentos consecutivos apenas com teclado (RF-19) — teste e2e sem eventos de mouse.
- Campos limpos e foco devolvido após gravar (RF-20).
- Ausente sai da Fila, permanece na exportação, não aparece na Classificação (RF-21).
- Correção substitui valor e reflete na Classificação (RF-22).
- Autor e instante consultáveis (RF-23).
- Adicionar Pitch mantém registro pessoal único (RF-24).
- Segundo lançamento no mesmo Pitch bloqueado ou tratado como correção (RF-25).
- **Concorrência:** dois operadores lançando ao mesmo tempo na mesma Pitch não se sobrescrevem (RF-12).

### Classificação
- Abre em sessão anônima (RF-26).
- Resposta contém exatamente os cinco campos e nada mais (RF-27).
- Dois tempos do mesmo participante geram duas linhas (RF-28).
- Filtro por Pitch renumera a partir de 1 (RF-29).
- Busca localiza e destaca (RF-30).
- Empate resolvido pelo lançamento mais antigo, de forma estável e repetível (RF-31).
- Indicador de atualização e botão manual (RF-32).
- Posições 1–100 visíveis; 101 alcançável (RF-33).
- **Teste de vazamento:** varrer toda resposta pública procurando e-mail, telefone, idade, nome de responsável e sobrenome de participante **menor de 18** da massa de teste — falha se encontrar qualquer um (RNF-08, RNF-09 revisado em D-21).

### Acesso e custódia
- Painel sem sessão bloqueado (RF-11).
- Exportação anônima negada (RF-35).
- Exportação contém todos os registros, inclusive ausentes (RF-34).
- Não existe caminho público de criação de conta (RNF-14).

## Regras da suíte

- Banco de teste real (não mock) para os testes de integração — as invariantes de T02 estão no banco e precisam ser exercitadas.
- Massa de teste determinística, com homônimos e acentos.
- Testes de concorrência executam requisições genuinamente paralelas.
- A suíte roda em CI a cada pull request (T01) e bloqueia merge.

## Critérios de aceitação

- [ ] Existe ao menos um teste nomeado por requisito, referenciando o código do requisito no nome do teste (ex.: `RF-07 — idade corrigida descarta responsável`).
- [ ] Toda *Verificação* do PRD §5 tem teste correspondente, ou justificativa registrada quando só puder ser verificada manualmente (ex.: RNF-15, teste cronometrado com pessoas).
- [ ] O teste de vazamento de dado pessoal roda em CI.
- [ ] A suíte completa roda em menos de 10 minutos.
