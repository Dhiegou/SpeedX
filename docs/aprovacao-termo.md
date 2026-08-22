# Aprovação do termo de consentimento

Registro da revisão e da aprovação por escrito do texto de consentimento (T03, RF-09, PE-04).

**Este arquivo é a prova documental da base legal do evento.** A versão `v1.0-2026-08-19` está
aprovada desde 2026-08-19, e `assegurarTermoAprovado()` deixa o cadastro passar por causa disso.
Se algum dia a versão vigente voltar a ser rascunho, o guard volta a recusar.

---

## Versão aprovada

| Campo                      | Valor                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Identificador              | `v1.0-2026-08-19`                                                                                 |
| Situação                   | **aprovada** em 2026-08-19                                                                        |
| Publicada em               | 2026-08-19                                                                                        |
| Texto                      | [`src/contexts/inscricao/consentimento/v1-0.ts`](../src/contexts/inscricao/consentimento/v1-0.ts) |
| Rota pública               | `/termo`                                                                                          |
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
