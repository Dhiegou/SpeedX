# T21 — Auditoria de privacidade e checklist pré-evento

**Contexto SDD:** §6 (verificações prévias)
**Depende de:** todas as anteriores
**Bloqueia:** o evento
**Requisitos:** RNF-08, RNF-09, RNF-10 + checklist do SDD §6

---

## Objetivo

Última porta antes do evento. Confirmar, por leitura de código e por verificação executada, que nenhum dado pessoal escapa e que as premissas de infraestrutura do SDD se confirmaram.

## Parte 1 — Auditoria de privacidade

Método: **leitura do código produzido**, não inspeção pelo navegador (restrição 1 do anexo).

- [ ] Listar **todas** as rotas públicas (sem autenticação) e, para cada uma, ler o serializador e confirmar quais campos saem.
- [ ] Confirmar que o tipo `LinhaClassificacao` (T12) não ganhou nenhum campo pessoal ao longo do desenvolvimento.
- [ ] Confirmar que `paraNomePublico` é a única função que toca sobrenome no caminho público, e que nenhuma resposta pública carrega sobrenome completo de menor de 18 (RNF-09, revisado em D-21). Avaliar também a inferência aceita naquela decisão: o formato abreviado sinaliza que a pessoa é menor de idade.
- [ ] Confirmar ausência de e-mail, telefone, idade e qualquer dado de responsável em toda resposta pública (RNF-08).
- [ ] Confirmar que nenhuma consulta a dados parte do navegador do usuário final (restrição 3) — buscar no bundle do cliente por credencial, string de conexão ou chamada direta a banco.
- [ ] Confirmar que dados pessoais completos exigem autenticação (RNF-10): painel e exportação testados sem cookie.
- [ ] Confirmar que logs e telemetria não carregam dado pessoal.
- [ ] Confirmar que o cruzamento pessoal × resultado existe **somente** em `contexts/custodia/` (BC-05).
- [ ] Rodar o teste automatizado de vazamento (T17) contra o ambiente de homologação com massa realista.

## Parte 2 — Checklist do SDD §6

- [ ] Hospedagem anuncia **HTTP/3** (T19) — sob pena de FL-02 e FL-07 caírem para TCP e RNF-04 ficar em risco.
- [ ] **Idempotência** de FL-03 e FL-06 validada sob reenvio deliberado (T05, T09).
- [ ] **Sincronia de relógio** do servidor confirmada, e o instante de Lançamento é o do servidor (T19).
- [ ] **Teste de carga** de FL-07 com 500 acessos concorrentes executado, com relatório (T18).
- [x] **Termo oficial** confirmado com o organizador em 2026-08-25: **Cockpit** — nem *Pitch* nem *Pista*, porque o evento é de simulador (D-75). A interface reflete a decisão em T06, T11 e T13; o identificador interno segue `pitch`. Falta só conferir na leitura final que nenhuma tela voltou a escrever a palavra à mão.
- [ ] **Ausência de campo pessoal** em toda resposta pública verificada (Parte 1).

## Parte 3 — Prontidão operacional

- [ ] Contas de Operador criadas e testadas por cada pessoa que vai operar, **antes** do dia.
- [ ] Sessão testada para durar a janela inteira do evento.
- [ ] Termo de consentimento aprovado por escrito pelo organizador (T03).
- [ ] Prazo de retenção acordado e registrado (T15) — o procedimento está escrito em `docs/retencao.md` e a **data-base entrou em 2026-08-25**: evento em 24/10/2026, retenção vencendo em **04/11/2026, 00:00** em São Paulo. Falta o ensaio do expurgo total contra o banco real, que T15 deixou aberto para não apagar a massa de T18.
- [ ] Material de contingência impresso e no local, com ensaio feito (T20).
- [ ] Monitoramento ativo, alertas chegando no canal certo, com teste real de disparo (T16) — a especificação do monitor, dos limiares e do canal está em `docs/monitoramento.md`; falta contratar o serviço (PE-05) e disparar de verdade.
- [ ] **Decidir sobre a métrica de uso da busca por nome** (PRD §7, ≥ 30%): ela **não é mensurável** neste desenho, porque a busca roda no navegador e não gasta rede (D-69). Ou cai do PRD, ou alguém aceita telemetria de navegador na página mais pública do evento. Decisão do organizador, não do código.
- [ ] Snapshot manual do banco tirado no início do evento, 24/10/2026 (T19).
- [ ] Deploys congelados; plano de reversão distribuído (T19).
- [ ] QR code impresso, testado com três leitores e posicionado (T07) — é o resíduo de RF-01: a parte automatizável já tem teste, e o ato de escanear precisa dos aparelhos.
- [ ] **Os quatro requisitos sem verificação automática**, com as justificativas escritas em `tests/rastreabilidade.test.ts`: RNF-04 (rede real), RNF-05 (o dia do evento), RNF-06 (T20) e RNF-15 (cinco pessoas cronometradas em cada perfil). O teste falha se a lista mudar sem alguém escrever o porquê.
- [ ] Relatório de tentativas não resolvidas acessível ao organizador durante o evento (T14).
- [ ] Quem executa o expurgo sabe que **apagar o banco não tira o site do ar** — o passo 5 de `docs/retencao.md` depende de T19, e o termo prometeu os dois (T15, T19).

## Critérios de aceitação

- [ ] Todos os itens acima marcados, com evidência registrada (comando executado, arquivo, print de relatório ou nome de quem confirmou).
- [ ] Resultado consolidado em `docs/checklist-pre-evento.md`, datado e assinado pelo responsável técnico.
- [ ] Riscos que permanecerem abertos estão explicitamente aceitos por escrito, com plano de mitigação no dia.

---

## Acrescentado por T09 — 2026-08-23

- [ ] **Decidir com o organizador se a inclusão de Tentativa (RF-24) precisa de rastro de autoria.** Hoje não tem: a constraint `tentativa_autoria_coerente_com_estado` exige `operador_id` nulo enquanto o estado é `pendente`, e o enum `tipo_lancamento` não tem valor para "inclusão". RF-23 cobre gravação e alteração de **Tempo**, então a ausência está dentro do requisito — mas se alguém for incluído no Pitch errado, não há como saber quem incluiu. Custo de mudar: um valor no enum, ajuste na constraint de `lancamento` e uma migração.

- [ ] **Cronometrar um lançamento completo com o supervisor (RNF-16, vindo de T11).** Alvo: ≤ 15 s de ponta a ponta — buscar, selecionar, digitar o tempo, confirmar. O fluxo foi desenhado para caber, mas o número depende do teclado do tablet, da luz e de quanto o Operador já usou a tela. **Se não fechar, o suspeito mais provável é a etapa de confirmação — e a saída não é removê-la (RF-18 a exige), é encurtar o que vem antes dela.**
- [ ] **Confirmar com o supervisor os atalhos do painel:** `Alt+1`/`Alt+2` troca de Pitch, `F2` ausência, `F3` busca global, `Esc` cancela. O `Alt` foi decisão nossa (D-54), não da task — vale ver se atrapalha na prática.

- [ ] **Abrir a Classificação em 360px de largura real e confirmar que não há rolagem horizontal (RNF-18, vindo de T13).** O CSS foi escrito para isso — coluna de nome elástica com `overflow-wrap`, números tabulares, controles fixos —, mas a confirmação depende de aparelho. Testar com o sobrenome mais longo da massa real.

- [ ] **Abrir as três exportações no Excel de verdade, em português (vindo de T14).** Separador `;`, BOM UTF-8 e escape foram escritos para o Excel pt-BR e conferidos byte a byte, mas "abre corretamente em Excel" é afirmação sobre um programa que não está no repositório. Conferir: acento legível, colunas separadas, e **um participante cujo nome comece com `=`** — o apóstrofo de proteção (D-60) deve sumir na exibição e a célula não pode virar fórmula.
