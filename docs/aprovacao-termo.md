# Aprovação do termo de consentimento

Registro da revisão e da aprovação por escrito do texto de consentimento (T03, RF-09, PE-04).

**Este arquivo é a prova documental da base legal do evento.** A versão vigente é a
`v1.2-2026-10-21`, aprovada em 2026-10-21, e `assegurarTermoAprovado()` deixa o cadastro passar
por causa disso. Se algum dia a versão vigente voltar a ser rascunho, o guard volta a recusar.

**Três versões, e as três valem.** A `v1.0-2026-08-19` e a `v1.1-2026-10-14` continuam publicadas
e inalteradas: quem se cadastrou sob elas tem `consentimento.versao_termo` apontando para o texto
que leu de verdade, e isso não pode ser reescrito depois. O que muda com a versão nova é só qual
delas o formulário apresenta de agora em diante.

---

## Versão vigente

| Campo                      | Valor                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Identificador              | `v1.2-2026-10-21`                                                                                 |
| Situação                   | **aprovada** em 2026-10-21                                                                        |
| Publicada em               | 2026-10-21                                                                                        |
| Texto                      | [`src/contexts/inscricao/consentimento/v1-2.ts`](../src/contexts/inscricao/consentimento/v1-2.ts) |
| Rota pública               | `/termo`                                                                                          |
| Hash do conteúdo (SHA-256) | `43f42f5a8b2527a0efd868220df2ae1ce60ef75bdb3cf1ab3f12d2d0c89cafdb`                                |

---

## Versão `v1.1-2026-10-14` — superada, e ainda publicada

| Campo                      | Valor                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Identificador              | `v1.1-2026-10-14`                                                                                 |
| Situação                   | **aprovada** em 2026-10-14                                                                        |
| Publicada em               | 2026-10-14                                                                                        |
| Texto                      | [`src/contexts/inscricao/consentimento/v1-1.ts`](../src/contexts/inscricao/consentimento/v1-1.ts) |
| Rota pública               | nenhuma: `/termo` publica a versão vigente                                                        |
| Hash do conteúdo (SHA-256) | `eb93b14a7e24c5566262cbb083e7ad926251e3f535b4b845cd1b42617695b753`                                |

---

## Versão `v1.0-2026-08-19` — superada, e ainda publicada

| Campo                      | Valor                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Identificador              | `v1.0-2026-08-19`                                                                                 |
| Situação                   | **aprovada** em 2026-08-19                                                                        |
| Publicada em               | 2026-08-19                                                                                        |
| Texto                      | [`src/contexts/inscricao/consentimento/v1-0.ts`](../src/contexts/inscricao/consentimento/v1-0.ts) |
| Rota pública               | nenhuma: `/termo` publica a versão vigente                                                        |
| Hash do conteúdo (SHA-256) | `9614118b061d5922172c67b63eb1e2408cf745c3a13045edbee241f64e3541c4`                                |

O hash está declarado em
[`integridade.ts`](../src/contexts/inscricao/consentimento/integridade.ts) e é verificado pela
suíte. Se o texto mudar depois de aprovado, o teste falha e **uma versão nova é obrigatória** —
o que está escrito abaixo passa a valer só para a versão identificada acima.

---

## Checklist de RF-09, item a item

Cada linha corresponde a uma exigência do PRD. As marcadas como _automatizado_ têm teste em
`src/contexts/inscricao/consentimento/consentimento.test.ts`; as demais dependem de leitura
humana.

| #   | Exigência (RF-09)                                                                                                                  | Onde está no texto                                 | Verificação    | Situação                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Informa **quais dados** são coletados, nominalmente                                                                                | seção `dados-coletados`                            | automatizado   | ✅ nome, sobrenome, e-mail, telefone, idade                                                                                          |
| 2   | Informa os dados do **responsável** de menor de 18 (RNF-07)                                                                        | seção `dados-coletados`                            | automatizado   | ✅ nome, sobrenome e telefone do responsável                                                                                         |
| 3   | Informa a **finalidade** de cada grupo de dados                                                                                    | seção `finalidade`                                 | automatizado   | ✅ um item por grupo                                                                                                                 |
| 4   | Informa o **prazo de retenção** (RNF-11)                                                                                           | seção `retencao`                                   | automatizado   | ✅ máximo de 10 dias após o evento, e o site sai do ar ao fim do prazo (PE-02, definido em 2026-08-19)                               |
| 5   | Informa o **meio de solicitar exclusão**                                                                                           | seção `exclusao`                                   | automatizado   | ✅ e-mail dhiegodev@hotmail.com, e presencial durante o evento (PE-03, definido em 2026-08-19)                                       |
| 6   | Declara **em destaque** que o nome fica visível em página pública                                                                  | seção `exposicao-publica`, `destaque: true`        | automatizado   | ✅ os dois formatos, com exemplo de cada: "Dhiego Ferreira" (18+) e "Lucas M." (menor de 18), conforme RNF-09 revisado em 2026-08-19 |
| 7   | Declara o que **não** aparece em página pública (RNF-08)                                                                           | seção `exposicao-publica`                          | automatizado   | ✅ e-mail, telefone, idade e dados do responsável                                                                                    |
| 8   | Aceite explícito do participante antes de concluir o cadastro (RF-08)                                                              | `aceites[participante]`                            | automatizado   | ✅                                                                                                                                   |
| 9   | Bloco do responsável em **primeira pessoa**, dizendo o que autoriza                                                                | `aceites[responsavel]`                             | automatizado   | ✅ participação + publicação + contato. O repasse saiu daqui: virou caixa opcional própria (D-23)                                    |
| 10  | **Linguagem simples** (P3 do PRD): frases curtas, sem jargão, sem citação de artigo de lei                                         | texto inteiro                                      | leitura humana | ✅ revisado pelo organizador em 2026-08-19; travessões removidos na v0.6 (D-24)                                                      |
| 11  | Idade mínima de 13 anos declarada (RF-04)                                                                                          | seção `menores`                                    | leitura humana | ✅                                                                                                                                   |
| 12  | Declara **a quem os dados são repassados** fora da organização — não exigido por RF-09, e indispensável desde que o repasse existe | seção `compartilhamento` + aceite opcional próprio | automatizado   | ✅ FIAP e a futura escolinha de Lélio Assumpção; só o telefone; **mediante autorização opcional**, em caixa separada (D-22, D-23)    |

### Como foi revisado o item 10

Nenhum teste julga se uma frase é clara; isso é leitura humana. Feita em 2026-08-19, com um ajuste: excesso de travessão, corrigido e travado por teste (D-24). O roteiro fica registrado para a próxima versão.

1. Suba o projeto e abra o texto:

   ```bash
   npm run dev
   # abrir http://localhost:3000/termo
   ```

   O arquivo-fonte é `src/contexts/inscricao/consentimento/v1-0.ts`, se preferir ler no
   editor — mas `/termo` é o que o participante vê, e é nele que o destaque e a ordem das seções
   se avaliam.

2. Leia como quem está na fila do evento, no celular, com pressa. A pergunta não é "está
   juridicamente correto", é: **um pai de 40 anos, sem formação jurídica, entende cada frase na
   primeira leitura?** Marque qualquer frase que precisou reler.

3. Confira especificamente o que costuma escapar:
   - alguma palavra que só alguém da área entende;
   - pontuação que não é de português corrente (travessão já foi banido em D-24 e tem teste);
   - frase com mais de duas linhas;
   - promessa vaga onde deveria haver um número ou um lugar concreto ("em breve", "quando
     possível");
   - a seção em destaque: fica claro, sem esforço, que o nome vai para uma página que qualquer
     pessoa pode abrir?

4. Resultado:
   - **está claro** → troque o ⏳ da linha 10 por ✅ e a data;
   - **algo precisa mudar** → anote a frase e o que incomodou. Reescrever o texto **gera versão
     nova** (`v0.4`), porque o hash muda — o procedimento é o mesmo da aprovação, abaixo.

---

## Pendências

**Nenhuma.** Todas foram resolvidas em 2026-08-19:

- **PE-02** (prazo de retenção): máximo de 10 dias após o evento, com o site saindo do ar ao fim do
  prazo.
- **PE-03** (canal de exclusão): e-mail `dhiegodev@hotmail.com`, e também presencialmente no ponto
  de inscrição durante o evento (D-20 e D-22).
- **PE-04** (aprovação por escrito): registrada abaixo.

---

## Aprovação

| Campo                              | Valor                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Versão aprovada                    | `v1.0-2026-08-19`                                                      |
| Hash conferido                     | `9614118b061d5922172c67b63eb1e2408cf745c3a13045edbee241f64e3541c4`     |
| Nome do responsável pela aprovação | Dhiego (`dhiegodev@hotmail.com`)                                       |
| Papel                              | Responsável pelo sistema de inscrição e classificação do evento        |
| Data                               | 2026-08-19                                                             |
| Meio da aprovação por escrito      | Instrução registrada na sessão de trabalho, materializada neste commit |

**Sobre o meio da aprovação.** O registro escrito é este arquivo, versionado no repositório: quem
aprovou, qual versão, qual hash e quando. Não há e-mail nem documento assinado anexado.

**Se o organizador do evento for outra pessoa** (Lélio Assumpção ou quem responda formalmente pelo
NEXT), vale colher a concordância dele e acrescentar uma linha nesta mesma tabela. O texto não muda
por isso, então **não é preciso versão nova**: a aprovação é metadado e fica fora do hash,
justamente para que confirmar uma assinatura não custe reescrever o termo.

### Se algum dia for preciso alterar o texto

`v1.0` está aprovada e por isso é **imutável**. Qualquer correção, mesmo de uma vírgula:

1. copie o arquivo para `v1-1.ts` (ou o identificador que couber) e edite lá;
2. registre o hash novo em `integridade.ts`, **sem tocar na entrada da `v1.0`**;
3. aponte `TERMO_VIGENTE` para a versão nova e mantenha a `v1.0` em `TERMOS_PUBLICADOS`, porque ela
   é a prova do que foi consentido por quem já se cadastrou;
4. repita a revisão desta tabela e do checklist acima para a versão nova.

---

## Aprovação da `v1.1-2026-10-14`

| Campo                              | Valor                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Versão aprovada                    | `v1.1-2026-10-14`                                                      |
| Hash conferido                     | `eb93b14a7e24c5566262cbb083e7ad926251e3f535b4b845cd1b42617695b753`     |
| Nome do responsável pela aprovação | Dhiego (`dhiegodev@hotmail.com`)                                       |
| Papel                              | Responsável pelo sistema de inscrição e classificação do evento        |
| Data                               | 2026-10-14                                                             |
| Meio da aprovação por escrito      | Instrução registrada na sessão de trabalho, materializada neste commit |

### O que foi aprovado, nas palavras de quem aprovou

As duas redações foram propostas com variantes numeradas, e a escolha veio assim, literalmente:

> caixa 1, opção A; caixa 2, opção C mas ao invés de "escolinha", coloque "futuro curso"

Daí saíram os dois textos que estão em `v1-1.ts`:

| caixa                         | texto aprovado                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `participante` (obrigatória)  | Li e entendi este termo. Autorizo o uso dos meus dados e a publicação do meu nome na página pública de classificação, como está descrito acima.        |
| `compartilhamento` (opcional) | Opcional: autorizo o repasse do meu telefone para a FIAP e para o futuro curso do Lélio Assumpção. Posso deixar desmarcada e me inscrever assim mesmo. |

### Uma decisão que não estava na instrução, e precisa ser conferida

A instrução pedia "futuro curso" **no texto da caixa**. A palavra "escolinha" aparecia mais duas vezes no corpo do termo, e as duas foram trocadas junto:

| seção              | antes                                                                     | agora                                                                |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `compartilhamento` | uma escolinha de corrida que o Lélio Assumpção pretende abrir futuramente | um curso de corrida que o Lélio Assumpção pretende abrir futuramente |
| `exclusao`         | enviado para a FIAP ou para a escolinha                                   | enviado para a FIAP ou para o curso                                  |

**O motivo:** aplicar a troca só na caixa deixaria o documento dizendo que o telefone vai para um "futuro curso" num lugar e para "a escolinha" em outros dois. Num termo cuja razão de existir é declarar a quem o dado é entregue, duas palavras para a mesma organização é ambiguidade no pior lugar possível.

**Se a intenção era outra** — manter "escolinha" no corpo e usar "futuro curso" só na caixa —, isto se desfaz com uma versão `v1.2`, pelo mesmo procedimento descrito no fim deste arquivo.

### O que mudou, e o que explicitamente não mudou

Nenhuma promessa do termo foi alterada: os mesmos dados coletados, as mesmas finalidades, o mesmo prazo de retenção, o mesmo canal de exclusão, os mesmos destinatários do repasse e as mesmas três caixas, com `obrigatorio` idêntico em cada uma. O hash vigia essa última parte por fora do texto, justamente para que transformar um opcional em obrigatório não passe como mudança de redação.

### Checklist de RF-09, relido para a versão nova

As seções do termo não foram tocadas, então os itens 1 a 7 e 9 a 11 valem como estão na tabela acima. Dois itens mereciam releitura, e foram relidos:

| #   | Exigência                                                     | Situação na `v1.1`                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Aceite explícito do participante antes de concluir o cadastro | ✅ A caixa continua obrigatória, em primeira pessoa, e continua nomeando a publicação na página pública. A regra dos 18 anos saiu de dentro dela e continua declarada **em destaque** na seção `exposicao-publica` (item 6) e na tarja logo acima das caixas, no formulário |
| 12  | Declara a quem os dados são repassados fora da organização    | ✅ FIAP e o **futuro curso** de Lélio Assumpção; só o telefone; mediante autorização opcional, em caixa separada (D-22, D-23). A organização é a mesma; mudou como ela é nomeada                                                                                            |

### O material impresso foi refeito

`npm run fichas` regenerou a ficha de inscrição e o termo impresso contra a `v1.1`, e há teste que falha se o papel e a tela divergirem (RNF-07). **O que estiver impresso em papel com a `v1.0` não serve mais** e precisa ser reimpresso antes do evento.

---

## Aprovação da `v1.2-2026-10-21`

| Campo                              | Valor                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Versão aprovada                    | `v1.2-2026-10-21`                                                      |
| Hash conferido                     | `43f42f5a8b2527a0efd868220df2ae1ce60ef75bdb3cf1ab3f12d2d0c89cafdb`     |
| Nome do responsável pela aprovação | Dhiego (`dhiegodev@hotmail.com`)                                       |
| Papel                              | Responsável pelo sistema de inscrição e classificação do evento        |
| Data                               | 2026-10-21                                                             |
| Meio da aprovação por escrito      | Instrução registrada na sessão de trabalho, materializada neste commit |

### O que foi aprovado, nas palavras de quem aprovou

O PRD do termo `v1.2`, escrito pelo aprovador, trazia o texto proposto "para você aprovar ou reescrever". A instrução que veio em seguida foi, literalmente:

> leia o PRD.md e execute-o

O texto foi publicado como proposto, sem reescrita:

| seção        | antes (`v1.1`)                                                                                                                                                                                    | agora (`v1.2`)                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finalidade` | Telefone: entrar em contato com os ganhadores depois da corrida e localizar você no dia do evento, inclusive em caso de emergência. Na tela da organização aparecem só os quatro últimos dígitos. | Telefone: entrar em contato com os ganhadores depois da corrida, localizar você no dia do evento, inclusive em caso de emergência, e mandar o seu resultado numa mensagem automática por WhatsApp. Na tela da organização aparecem só os quatro últimos dígitos. |

### O que mudou, e o que explicitamente não mudou

Uma frase, numa seção. A política de privacidade já declarava o envio do resultado por WhatsApp, e o termo não o cobria; como a base legal é o consentimento, o termo foi alinhado à política (D-111). Todas as outras seções, as três caixas e o `obrigatorio` de cada uma são os da `v1.1`, conferido por diff entre `v1-1.ts` e `v1-2.ts`.

**Quem se inscreveu sob a `v1.0` ou a `v1.1` não autorizou o WhatsApp**, e não pode receber a mensagem.

**Autorizar não é entregar.** O envio por WhatsApp não existe no sistema, e o termo diz "mandar", como finalidade autorizada, não como promessa de envio.

### Checklist de RF-09, relido para a versão nova

Só a seção `finalidade` mudou, então os itens 1, 2 e 4 a 12 valem como estão nas tabelas acima. O item 3 foi relido:

| #   | Exigência                                       | Situação na `v1.2`                                                                             |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 3   | Informa a **finalidade** de cada grupo de dados | ✅ um item por grupo; o telefone ganha o envio do resultado por WhatsApp, sem travessão (D-24) |

### O material impresso

`npm run fichas` regenerou a ficha e o termo impresso contra a `v1.2`, para o teste de RNF-07 continuar valendo. Não haverá papel neste evento, então nada precisa ser reimpresso.
