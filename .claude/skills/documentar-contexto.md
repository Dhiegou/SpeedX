---
name: documentar-contexto
description: Mantém o CONTEXT.md — registro vivo de tudo que foi conversado, decidido e raciocinado nas sessões. Use SEMPRE que uma sessão produzir uma decisão, uma premissa, uma mudança de rumo ou uma pendência, quando o usuário pedir para "documentar o contexto"/"registrar o que conversamos", e ANTES de encerrar qualquer trabalho substantivo.
---

# Skill — Documentar contexto no CONTEXT.md

## Função

Garantir que **toda conversa e todo raciocínio usado neste projeto fiquem registrados no `CONTEXT.md`**, na raiz do repositório. Cada sessão nova começa sem memória da anterior; o `CONTEXT.md` é o que atravessa essa fronteira.

## Princípio

O `CONTEXT.md` documenta o **porquê**, não o **o quê**.

O *o quê* já está no PRD, no SDD, nas tasks e no código. Se a informação existe nesses lugares, **não repita** — aponte para ela. O que se perde entre sessões é o raciocínio: por que uma decisão foi tomada, o que foi descartado, o que foi assumido na falta de informação.

## Quando atualizar

Sempre que a sessão produzir qualquer um destes:

- uma **decisão** técnica ou de produto — incluindo as recusadas e o motivo;
- uma **premissa** assumida por falta de definição, marcada como premissa e não como fato;
- uma **mudança de rumo** em relação ao que já estava documentado;
- uma **pendência** criada, resolvida ou repassada — com quem decide e o que ela bloqueia;
- um **pedido do usuário** que altera escopo, prioridade ou forma de trabalhar;
- uma **descoberta** sobre o domínio, a stack ou uma limitação encontrada na prática.

Não registrar trabalho mecânico ("criei o arquivo X") — isso o histórico do repositório já conta.

## Estrutura obrigatória do CONTEXT.md

1. **Estado atual** — onde o projeto está, em 3 a 5 linhas. Reescrito por inteiro a cada atualização, nunca acumulado.
2. **Linha do tempo das sessões** — uma entrada por sessão, mais recente primeiro: data, o que o usuário pediu, o que foi entregue, o que ficou aberto.
3. **Decisões e raciocínio** — o que foi decidido, por quê, o que foi descartado, e se é reversível.
4. **Premissas assumidas** — o que foi assumido e o que acontece se a premissa cair.
5. **Pendências abertas** — o que falta, quem resolve, o que bloqueia.
6. **Vocabulário do projeto** — termos com significado específico aqui.

## Como escrever

- **Português**, mesma língua dos demais documentos.
- Prosa curta e direta, frases completas.
- **Datas absolutas** (`2026-08-18`), nunca "ontem" ou "semana passada" — o arquivo é lido meses depois.
- Registrar sempre a **alternativa descartada**. Decisão sem alternativa registrada é decisão que alguém reabre do zero.
- Distinguir **fato** de **premissa** explicitamente.
- Ao corrigir algo registrado antes, **não apagar**: marcar como superado e dizer o que mudou. O raciocínio antigo explica o código antigo.

## Procedimento

1. Ler o `CONTEXT.md` atual; se não existir, criar com as seções acima.
2. Identificar o que a sessão produziu, segundo a lista de gatilhos.
3. Reescrever **Estado atual** por completo; acrescentar nas demais seções sem apagar histórico.
4. Se a sessão alterou escopo, arquitetura ou stack, aplicar também a skill `manter-readme`.
5. Informar ao usuário, em uma linha, o que foi registrado.
