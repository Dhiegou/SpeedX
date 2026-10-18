# PRD — Reta final: quatro itens que não dependem de decisão pendente

**Data:** 2026-10-17. **Faltam 7 dias para o evento.**
**Origem:** `docs/relatorio-prontidao.md`, de 17/10
**Escopo:** quatro itens. Nenhum deles espera o domínio ou a troca de plano do Neon

---

## 1. O que este PRD é

O relatório de prontidão levantou nove reprovados. Quatro dependem de decisão ou de acesso que o agente não tem, e estão listados na §6 como fora de escopo. **Os quatro daqui são executáveis hoje.**

A sete dias do evento, a regra que vale acima de tudo: **mudança não pedida é risco, não ajuda.** Nada neste PRD altera comportamento de produto, salvo o item 4, que é uma linha de configuração com número medido e precisa de aprovação explícita antes de entrar.

---

## 2. Item 1 · Restaurar o `PRD.md` (R8)

O `PRD.md` na árvore de trabalho é o PRD de verificação, salvo por engano sobre o PRD do produto (v2.0). Não está commitado.

```bash
git status --short          # confirmar que mostra " M PRD.md"
git checkout -- PRD.md      # restaura o PRD do produto
```

O PRD de verificação, se for para ficar, vai como `PRD-go-live.md`.

**Verificação:** `npm test` volta de 701 para **703 de 703**. Os dois testes que falham hoje são de `tests/rastreabilidade.test.ts`, que lê o `PRD.md` procurando 35 RF e 18 RNF.

**Nenhum teste é alterado.** O teste está certo; o arquivo é que está errado.

---

## 3. Item 2 · Corrigir os números defasados na documentação (R4)

`docs/o-que-falta-para-voce.md` §3 manda configurar o limite de taxa em **300 e 1200**. Os valores decididos em D-90 são **800 e 2400**, e são os que estão em `src/shared/env.ts` como padrão. Os 300 foram a proposta que D-90 explicitamente rejeitou, porque o organizador respondeu que não garante Wi-Fi no local.

Quem seguir esse documento vai configurar a Vercel com menos da metade do calibrado, e trazer de volta o `429` na fila que a T23 corrigiu.

Corrigir a tabela para 800 e 2400, com referência a D-90.

**Enquanto estiver no arquivo, varrer o resto dele e os irmãos** atrás de outros números que envelheceram:

| arquivo | diz | é |
|---|---|---|
| `docs/o-que-falta-para-voce.md` | 636 testes, e "faltam 57 dias" | 703 testes, faltam 7 dias |
| `docs/testes.md` | 636 testes | 703 |
| `README.md` | já corrigido em 17/10 | — |

O prazo em dias não precisa virar contagem viva. Basta deixar de afirmar um número que já não é verdade.

---

## 4. Item 3 · Descobrir por que o e2e está vermelho (R3)

O job "Testes de ponta a ponta" falha nos quatro últimos commits, **incluindo o `c596953` que está publicado**. Último verde: `ba96d2c`, de 09/09.

Isto é o mais importante dos quatro, e por um motivo específico: **não se sabe o que está quebrado.** A suíte que exercita cadastro, painel e 360 px de ponta a ponta está vermelha sobre o código que está no ar, e ninguém sabe se é defeito de produto, de ambiente de CI ou de teste.

Três hipóteses prováveis, nesta ordem, para orientar a investigação sem fechá-la:

1. **Defeito de teste, não de produto.** Os quatro commits vermelhos são justamente os do trabalho de front: paleta, marca, selo saindo do cabeçalho, termo v1.1. Um teste e2e que afirme texto ou posição quebra sem que o site quebre.
2. **Ambiente de CI.** Navegador, banco efêmero ou variável que o job precisa.
3. **Defeito real** no que foi publicado.

**A hipótese 1 é a mais provável e a mais perigosa de assumir sem provar.** Se for ela, a correção é no teste. Se for a 3, a correção é no produto, e a sete dias isso muda o plano inteiro.

O log do job exige login, então o dono do repositório abre Actions → run `38670617086` → artefato `playwright-report` e entrega o resultado.

**Rodar localmente exige um Postgres descartável.** O `.env` atual aponta para o banco de produção (R9), então **não rode o e2e local antes de o banco de desenvolvimento existir**. Rodar e2e contra produção escreve no banco do evento.

**Entregável:** a causa nomeada, com a linha de falha. Se for teste, o conserto. Se for produto, o achado registrado e nada mais, porque a correção passa por decisão.

---

## 5. Item 4 · `experimental.inlineCss` (R5) · precisa de aprovação antes de entrar

RNF-04 dá 3 segundos e o 3G lento mede **4,98 s publicado**. D-102 já mediu a alavanca, com mediana de cinco por célula:

| rota | 3G lento hoje | com `inlineCss` |
|---|---|---|
| `/` | 4,72 s | **2,20 s** |
| `/classificacao` | 4,58 s | **2,21 s** |

O que segurou: com `inlineCss` o CSS viaja duas vezes, e **`/termo` vai a 150,1 KB contra um teto de 150**. Estouro de 0,1 KB, ou 0,07%.

**O que o agente faz:** aplicar a flag numa branch, rodar `npm run orcamento` e `npm run perf:rede` nas quatro rotas, e trazer os números de hoje. Confirmar se o estouro do termo continua em 0,1 KB depois das mudanças de front de outubro.

**O que o agente não faz:** decidir. A pergunta é de quem responde pelo evento, e está escrita em D-102: o teto de 150 KB é substituto para o tempo, e quando substituto e medida direta discordam, qual vale?

Se a decisão for entrar, o teto sobe para 151 KB **com a justificativa escrita no script**, e não por conveniência. Se for ficar como está, a reprovação em 3G lento é registrada como risco aceito, com assinatura.

---

## 6. Fora de escopo, e por quê

| item | por quê |
|---|---|
| R1, cold start | Depende da troca para o plano pago do Neon, prevista para 18/10. Vira o PRD de reverificação |
| R2, domínio e QR | Decisão do organizador, ainda em aberto |
| R9, banco de desenvolvimento | Exige acesso ao Neon |
| R6, atualizar o Next | O cartão de compartilhamento é estático, gerado no build, e o CVE que pesa é de `ImageResponse` por requisição. Deploy de dependência na véspera é risco líquido |
| R7, HTTP/3 | É da Vercel. O caminho é assinar o risco R-1 no checklist |
| Qualquer coisa contra o banco de produção | `db:seed`, `perf:preparar`, e2e e `expurgar` ficam proibidos até existir banco de desenvolvimento |

---

## 7. Critérios de aceitação

- [ ] `PRD.md` restaurado, e `npm test` em 703 de 703
- [ ] Limite de taxa corrigido para 800 e 2400 em `o-que-falta-para-voce.md`, com referência a D-90
- [ ] Contagens de teste defasadas corrigidas nos três arquivos
- [ ] Causa do e2e vermelho nomeada, com a linha de falha
- [ ] `inlineCss` medido numa branch, com os números de hoje, **sem entrar sem aprovação**
- [ ] `npm run check` e `npm run orcamento` limpos
- [ ] Nenhum teste alterado para passar, nenhum comando rodado contra o banco de produção
- [ ] `CONTEXT.md` com as decisões numeradas na sequência corrente

---

## 8. O risco deste PRD

**Três dos quatro itens são documentação e restauração de arquivo, e o quarto é uma flag.** Nenhum deles deveria tocar comportamento de produto. Se a execução começar a mexer em componente, rota ou validação, saiu do escopo.

O item 3 é o que pode escalar. Se a investigação do e2e achar defeito real no que está publicado, **pare e relate.** Corrigir produto a sete dias do evento é decisão, não consequência.