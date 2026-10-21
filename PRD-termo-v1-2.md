# PRD — Termo v1.2: o telefone passa a autorizar mensagem por WhatsApp

**Data:** 2026-10-21. **Faltam 3 dias para o evento.**
**Contexto SDD:** BC-01 Inscrição, T03
**Decisões que continuam valendo:** D-21, D-22, D-23, D-24
**Aprovador:** Dhiego, o mesmo das versões anteriores

**Este PRD substitui o `PRD-politica-whatsapp.md`.** Aquele propunha tirar o WhatsApp da política; a decisão foi o contrário, alinhar o termo à política

---

## 1. O que muda, e por quê

A política de privacidade declara:

> "Depois da corrida, podemos mandar o seu resultado numa mensagem automática, por e-mail ou por WhatsApp, para o e-mail ou o telefone informados na inscrição."

O termo `v1.1` declara para o telefone:

> "Telefone: entrar em contato com os ganhadores depois da corrida e localizar você no dia do evento, inclusive em caso de emergência. Na tela da organização aparecem só os quatro últimos dígitos."

A política promete um uso que o consentimento não cobre. **Como a base legal declarada é o consentimento, quem manda é o termo.** A correção é alinhar os dois, e a decisão foi alinhar para cima: autorizar o WhatsApp no termo.

Para o e-mail não há nada a fazer. O termo já diz "falar com você sobre a sua inscrição e sobre o seu resultado", o que cobre o envio do resultado com folga.

## 2. Versão nova nasce aprovada, e isso é legítimo

A guarda `assegurarTermoAprovado()` recusa registrar consentimento quando `situacao` é `rascunho`. **Ela não exige que uma versão passe por rascunho antes.** A `v1.1` foi criada já com `situacao: 'aprovado'`, e é o mesmo caminho aqui.

O que "aprovado" significa neste projeto: o aprovador leu o texto final e o autorizou. Como você é o aprovador, aprovar e publicar acontecem no mesmo ato. O registro em `docs/aprovacao-termo.md` é o que documenta isso.

**Conferir antes de começar:** se a tabela `consentimento` tiver cadastro real sob a `v1.1`, essas pessoas **não** autorizaram WhatsApp, e não podem receber. O último levantamento achou só um participante de teste de 03/09, que deveria ser apagado de qualquer forma. Com a base limpa, todo mundo entra já sob a `v1.2`.

## 3. Escopo

### 3.1 Criar `v1-2.ts`

Cópia de `v1-1.ts`, com `versao: 'v1.2-<data>'`, `situacao: 'aprovado'`, e **uma única mudança de conteúdo**: a finalidade do telefone.

Proposta de texto, para você aprovar ou reescrever:

> "Telefone: entrar em contato com os ganhadores depois da corrida, localizar você no dia do evento, inclusive em caso de emergência, e mandar o seu resultado numa mensagem automática por WhatsApp. Na tela da organização aparecem só os quatro últimos dígitos."

**Nada mais muda.** Nem o corpo das outras seções, nem os aceites, nem as regras de obrigatoriedade.

### 3.2 Registrar o hash

Nova entrada em `HASHES_PUBLICADOS`, **sem remover** as das versões anteriores. O valor sai de `hashDoConteudo` rodado sobre o termo novo, nunca escrito à mão.

### 3.3 Apontar a vigente

`index.ts` passa a exportar a `v1.2` como `TERMO_VIGENTE`, mantendo `v1.0` e `v1.1` exportadas e dentro de `TERMOS_PUBLICADOS`. Versão publicada nunca sai: ela é a prova do que cada pessoa aceitou.

### 3.4 Registrar a aprovação

Entrada nova em `docs/aprovacao-termo.md`, no formato que as anteriores usam, com data e aprovador.

### 3.5 Varrer o resto da política

Enquanto o assunto é divergência entre os dois documentos, vale conferir se há outro ponto em que a política diz mais que o termo. A regra para resolver qualquer caso: **os dois precisam concordar**, e onde não concordarem, a decisão é de quem aprova, não do executor.

## 4. As regras que o texto precisa respeitar

A suíte vigia todas. Não são sugestões:

| regra                                                      | teste                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Nenhum travessão em nada que apareça na tela (D-24)        | `não usa travessão`                                      |
| O aceite do responsável não pode conter "repasse" (D-23)   | `o aceite do responsável não carrega o repasse embutido` |
| O aceite opcional precisa conter "opcional" e "desmarcada" | `o texto do aceite opcional diz que dá para não marcar`  |
| Só `compartilhamento` é opcional                           | `só o aceite do repasse é opcional`                      |
| `responsavel` só aparece para menor de 18                  | `o aceite do responsável só aparece para menor de 18`    |

Como este PRD mexe só na finalidade do telefone, e não nos aceites, as quatro últimas tendem a passar sem esforço. **A do travessão é a que pega**, porque o texto proposto é uma frase longa com enumeração, e travessão é a pontuação que naturalmente apareceria ali.

## 5. O que isto não resolve

**Autorizar não é entregar.** Permanece tudo o que impede o envio hoje:

- não existe infraestrutura de envio no projeto
- a API oficial do WhatsApp exige conta Meta Business, verificação de empresa e aprovação de modelo de mensagem
- o limite é de **250 destinatários únicos por 24 horas** sem empresa verificada, e **1.000** no primeiro nível com ela, contra 2000 participantes

O termo diz "podemos", que é permissão, não obrigação. Está correto assim. **Mas não prometa verbalmente a ninguém no dia** que vai receber mensagem, porque a maioria não vai.

## 6. Fora de escopo

| item                                     | por quê                                        |
| ---------------------------------------- | ---------------------------------------------- |
| Construir o envio por WhatsApp ou e-mail | Ver §5. É projeto próprio, não cabe em 3 dias  |
| Mudar qualquer outra seção do termo      | Uma mudança por versão mantém a trilha legível |
| Tocar `v1-0.ts` ou `v1-1.ts`             | São prova do que foi consentido. Imutáveis     |
| Material impresso                        | Não haverá papel                               |

## 7. Critérios de aceitação

- [ ] Base conferida: nenhum cadastro real sob a `v1.1` que ficaria com consentimento mais estreito
- [ ] `v1-2.ts` criada, aprovada, com identificador e data novos
- [ ] **Só a finalidade do telefone mudou**, verificado por `git diff` entre os dois arquivos
- [ ] Hash registrado, gerado por função
- [ ] `v1.0` e `v1.1` continuam exportadas e em `TERMOS_PUBLICADOS`
- [ ] `TERMO_VIGENTE` aponta para a `v1.2`
- [ ] Aprovação registrada em `docs/aprovacao-termo.md`
- [ ] A política e o termo concordam, sem a política dizer mais
- [ ] `npm test` e `npm run check` limpos, **sem nenhum teste alterado**
- [ ] `CONTEXT.md` com a decisão numerada

## 8. O risco

**Um teste que precise ser alterado é sinal de que o texto perdeu algo.** A suíte codifica D-21 a D-24, que custaram seis rascunhos até a v1.0. Se algum falhar, a correção é no texto.

O risco maior é de escopo: aproveitar a versão nova para "arrumar outras coisinhas" no termo. Uma mudança por versão é o que mantém auditável o que cada pessoa aceitou.
