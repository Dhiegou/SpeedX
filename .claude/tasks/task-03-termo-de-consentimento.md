# T03 — Termo de consentimento e textos legais

**Contexto SDD:** BC-01 Inscrição
**Depende de:** T02
**Bloqueia:** T06 (copy do formulário), T15 (retenção)
**Requisitos:** RF-08, RF-09, RNF-07, RNF-11

---

## Objetivo

Produzir o texto de consentimento e o mecanismo de versionamento. O SDD trata a base legal como invariante do contexto de Inscrição: nenhum Participante existe sem Consentimento registrado. O texto é, portanto, artefato de produto, não rodapé.

## Escopo

1. Redigir o termo em **linguagem simples** (P3 do PRD: o responsável precisa entender, não decifrar). O texto deve conter, obrigatoriamente (RF-09):
   - quais dados são coletados — listar nominalmente: nome, sobrenome, e-mail, telefone, idade; e para menores de 18, nome, sobrenome e telefone do responsável;
   - a finalidade de cada grupo de dados;
   - o **prazo de retenção** (pendente: definir com o organizador);
   - o **meio de solicitar exclusão** (pendente: definir canal com o organizador);
   - declaração explícita e destacada de que **nome e inicial do sobrenome ficarão visíveis em página pública de classificação**.
2. Redigir a variante do bloco de responsável: o que exatamente o responsável está autorizando, em primeira pessoa ("Eu autorizo…").
3. Guardar os textos versionados em `src/contexts/inscricao/consentimento/` como constantes com identificador de versão (ex.: `v1.0-2026-xx-xx`), não em banco editável e não hardcoded dentro de componente.
4. A versão vigente é gravada em `consentimento.versao_termo` a cada cadastro (T04).
5. Publicar o texto integral em rota pública própria (`/termo`), acessível a partir do formulário sem perder o preenchimento.
6. Submeter à validação do organizador e registrar a aprovação por escrito.

## Critérios de aceitação

- [x] Revisão item a item do texto contra a lista de RF-09, com o resultado registrado (checklist assinado). — checklist de 12 itens em `docs/aprovacao-termo.md`, todos fechados; 10 deles verificados por teste em `consentimento.test.ts`.
- [x] O texto declara em destaque a exposição pública de nome + inicial do sobrenome. — seção `exposicao-publica` com `destaque: true`, com exemplo concreto; teste falha se a flag ou o texto sumirem.
- [x] Alterar o texto obriga a incrementar o identificador de versão — teste garante que a constante de versão muda junto (hash do conteúdo comparado com a versão declarada). — SHA-256 do conteúdo canônico declarado em `integridade.ts`; teste cobre também o caso inverso (aprovar sem mudar palavra não exige versão nova).
- [x] Abrir `/termo` a partir do formulário e voltar não apaga os campos já preenchidos. — mecanismo entregue como `LINK_TERMO` (`target="_blank"`, `rel="noopener noreferrer"`) com teste; **a verificação ponta a ponta acontece em T06**, quando o formulário existir.
- [x] Aprovação do organizador registrada no repositório (arquivo `docs/aprovacao-termo.md` com data e responsável). — `v1.0-2026-08-19` aprovada em 2026-08-19, com versão, hash, responsável, papel e meio registrados.

## Pendências que bloqueiam

- ~~Prazo de retenção (RNF-11)~~ — **resolvido em 2026-08-19: máximo de 10 dias após o evento.**
- ~~Canal de solicitação de exclusão~~ — **resolvido em 2026-08-19: presencial, no ponto de inscrição durante o evento; sem canal remoto** (ver D-20 no `CONTEXT.md`). Consequência para T15: o expurgo a pedido precisa ser executável por um Operador no dia, não só por script pós-evento.

## Estado

**Concluída em 2026-08-19.** Versão vigente `v1.0-2026-08-19`, aprovada: texto completo, versionado, com integridade verificada e publicado em `/termo`. É base legal válida, e `assegurarTermoAprovado()` deixa o cadastro passar por causa disso — T05 continua chamando o guard, que volta a recusar se a versão vigente virar rascunho de novo. Seis rascunhos precederam a `v1.0`, e nenhum coletou nada porque o guard impediu.
