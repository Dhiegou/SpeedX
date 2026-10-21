# PRD — Conformidade legal: o que falta, o que já existe e o que não se aplica

**Data:** 2026-10-20. **Faltam 4 dias para o evento.**
**Escopo:** LGPD, acessibilidade, documentos legais
**Ressalva:** este documento é levantamento técnico e minuta. **Não é parecer jurídico.** Quem assume risco legal por um evento com 2000 pessoas, incluindo menores, decide com advogado

---

## 1. O que foi verificado, e o resultado

Cada linha abaixo foi conferida contra o código, não suposta.

| pedido                                                | resultado                                                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revisar Google Analytics e scripts de tracking        | **Não existe nenhum.** Zero ocorrências de `gtag`, `analytics`, `pixel`, `hotjar`, `clarity` ou equivalente                                                           |
| Verificar `alt` nas imagens                           | **Não existe imagem no site.** Nenhum `.png`, `.jpg` ou `<img>`. A marca é SVG escrito no HTML                                                                        |
| Licença e direito autoral das imagens                 | **Não se aplica.** Sem imagens. O logo é seu e o selo da PrinterX veio da patrocinadora                                                                               |
| Remover avaliações falsas e promessas sem comprovação | **Não existe nenhuma.** O texto visível é rótulo de campo e mensagem de erro. Não há depoimento, nota, número de participantes nem promessa de prêmio                 |
| Corrigir problemas de contraste                       | **Já está verificado por teste automatizado.** `tests/contraste.test.ts` calcula os pares de cor e exige WCAG AA: 4.5:1 para texto, 3:1 para texto grande. Passa hoje |
| Navegação por teclado                                 | **É requisito do projeto** (RF-19). O painel é operado inteiramente por teclado, com teste                                                                            |
| Coletar só os dados necessários                       | **Cinco campos**, cada um com finalidade declarada no termo. Ver §3.2                                                                                                 |
| Consentimento de cookies                              | **Não precisa de banner.** Ver §4, e a recomendação é não colocar                                                                                                     |
| Política de privacidade                               | **Existe em substância, não em forma.** Ver §2                                                                                                                        |
| Termos de serviço                                     | **Não existe.** Ver §5                                                                                                                                                |

**O que isso significa.** A maior parte deste pedido descreve problemas de sites comerciais com rastreamento, banco de imagens e marketing. Este site não tem nada disso, e a ausência é deliberada: RNF-04 proíbe imagem e script externo por peso, e isso produziu, de lado, um site sem superfície de rastreamento.

---

## 2. A política de privacidade existe, mas com o nome errado

O termo de consentimento `v1.1` tem as seções que uma política de privacidade precisa ter:

`dados-coletados` · `finalidade` · `compartilhamento` · `exposicao-publica` · `menores` · `retencao` · `exclusao`

Ele é aprovado, versionado, protegido por hash, e nenhum cadastro é registrado sem ele. Isso é mais rigor do que a maioria dos sites tem.

**O problema é de forma, e é real:** uma política de privacidade é documento informativo, que existe independentemente de alguém aceitar. Um termo de consentimento é ato de vontade. São peças diferentes, e hoje só existe a segunda.

---

## 3. As lacunas de verdade

### 3.1 O termo nunca cita a LGPD nem nomeia o controlador

Zero ocorrências de "LGPD", "Lei Geral", "ANPD", "controlador" ou "encarregado" no texto.

**A obrigação existe mesmo sem a citação**, e a substância está quase toda lá. Mas falta o essencial: **quem é o controlador dos dados?** Hoje o termo não diz. É FIAP? É você, pessoa física? É a organização do evento?

**Esta é a única decisão deste PRD que eu não posso tomar por você**, e é a mais importante de todas. Ela define quem responde se algo der errado.

### 3.2 Minimização: cinco campos, e um merece pergunta

| campo            | finalidade declarada                                           | veredito                                            |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| nome e sobrenome | identificar e publicar na classificação                        | necessário                                          |
| idade            | decide o regime jurídico, maior ou menor de 18                 | necessário, e é o discriminador legal               |
| telefone         | contato no dia, emergência, localizar ganhador                 | necessário, e já é reduzido a 4 dígitos no banco    |
| e-mail           | "falar com você sobre a sua inscrição e sobre o seu resultado" | **finalidade declarada, mas confirme que vai usar** |

A pergunta honesta sobre o e-mail: **vocês vão mesmo mandar e-mail?** Se não, coletar um dado que nunca é usado falha a minimização, por mais que o termo declare a finalidade. Se vão, está correto.

Não recomendo remover o campo a 4 dias. Recomendo decidir e registrar.

### 3.3 Direitos do titular: só a exclusão está oferecida

O termo cobre exclusão com clareza, inclusive encaminhando o pedido a quem recebeu o telefone. Mas o Art. 18 da LGPD lista outros, e nenhum aparece: confirmação de tratamento, acesso, correção, portabilidade, informação sobre compartilhamento e revogação do consentimento.

**Na prática, vários são triviais aqui** porque o volume é pequeno e o prazo é curto. Mas precisam estar escritos e ter um canal.

### 3.4 O contato é um e-mail pessoal

`dhiegodev@hotmail.com` é o canal de exclusão para um evento com 2000 pessoas, incluindo menores. Funciona, e está no termo aprovado.

Vale considerar um endereço institucional. Se não der em 4 dias, fica como está e é escolha registrada.

---

## 4. Cookie: a recomendação é **não** colocar banner

O site usa dois cookies, e nenhum é de rastreamento:

| cookie             | para quê                 | quem vê                           |
| ------------------ | ------------------------ | --------------------------------- |
| sessão do Operador | manter o login do painel | só quem opera, não o participante |
| tema               | lembrar claro ou escuro  | o participante                    |

Os dois são estritamente necessários ou funcionais. **Não há cookie de terceiro, de publicidade ou de análise**, porque não há script de terceiro no site.

Sob a LGPD, cookie necessário ao funcionamento não exige consentimento prévio. **Um banner aqui seria pior que inútil:** adiciona um clique no caminho de quem está na fila, contra RNF-15, e acostuma a pessoa a aceitar sem ler, que é o oposto do que a lei quer.

**O que fazer:** declarar os dois cookies na política de privacidade, dizendo o que são e por que não há banner. Transparência sem fricção.

---

## 5. O que construir

### 5.1 Página `/privacidade` · prioridade alta

Política de privacidade formal, como documento informativo. **Complementa o termo, não o substitui, e não pode contradizê-lo.**

Precisa conter, no mínimo:

- **Quem é o controlador**, com identificação e contato. O campo que você precisa preencher
- **Encarregado**, se houver, ou a declaração de qual canal faz esse papel
- Dados coletados e finalidade de cada um, **remetendo ao termo** em vez de reescrever
- Base legal: consentimento, e para menores o consentimento do responsável (Art. 14)
- Compartilhamento: FIAP e o curso, **mediante autorização opcional**
- Retenção de 10 dias após o evento, e o que acontece depois
- **Os direitos do Art. 18**, com o canal para exercê-los
- **Os dois cookies**, e por que não há banner
- Menção explícita à LGPD e à ANPD como via de reclamação
- Data da versão

**Link no rodapé das páginas públicas**, ao lado do termo.

### 5.2 Página `/termos` · prioridade média

Termos de uso. Para um evento gratuito de um dia, é peça curta:

- O que o site faz e para quem
- Que a inscrição não garante vaga, se for o caso. **Confirme isso**
- Regras de conduta mínimas, e que a organização pode recusar inscrição
- Que o resultado é digitado por operador humano a partir de cronômetro externo, e o procedimento de contestação
- Que o site sai do ar em 4 de novembro
- Ausência de garantia de disponibilidade, sendo evento gratuito
- Foro e legislação aplicável

**O item do resultado é o que mais importa.** Num evento com classificação pública e possivelmente prêmio, contestação de resultado é o conflito mais provável, e o PRD já lista isso como contraindicador.

### 5.3 O que **não** fazer

| não fazer                                 | por quê                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nova versão do termo                      | Versão nova nasce rascunho e **bloqueia cadastro** até aprovação (D-18). A 4 dias, e com material impresso já alinhado ao texto atual, o risco supera o ganho |
| Banner de cookie                          | §4                                                                                                                                                            |
| Remover o campo de e-mail                 | Decisão de produto, não de conformidade, e tarde demais                                                                                                       |
| Mexer em contraste ou teclado             | Já verificados por teste. Mexer sem medir é regressão esperando acontecer                                                                                     |
| Adicionar analytics para "medir o evento" | Levaria rastreamento a uma página que promete o contrário                                                                                                     |

---

## 6. Acessibilidade: o que ainda vale conferir

O automatizado está coberto. O que teste não pega e o ensaio pega:

- **Leitor de tela** no formulário, ao menos uma passada. Os rótulos e a associação de campo estão corretos no código, mas ninguém ouviu
- **360px em aparelho real**, que já está na lista de ensaios
- **Sob sol**, que é o cenário que motivou a régua de contraste
- **Teclado no painel**, com o Operador, que também já está na lista

Nenhum desses é código. São os ensaios que já estavam pendentes.

---

## 7. Critérios de aceitação

- [ ] Controlador identificado, com contato, **decidido pelo organizador**
- [ ] `/privacidade` publicada, com tudo de §5.1, sem contradizer o termo
- [ ] `/termos` publicada, com tudo de §5.2
- [ ] Link para as duas no rodapé das páginas públicas
- [ ] Os dois cookies declarados, com a justificativa de não haver banner
- [ ] Direitos do Art. 18 listados, com canal
- [ ] **O termo `v1.1` não foi tocado**, verificado por `git diff`
- [ ] Nenhum script de terceiro, nenhum cookie novo, nenhum rastreamento
- [ ] `npm run orcamento` passa. Duas páginas novas de texto não podem estourar RNF-04
- [ ] `npm test` e `npm run check` limpos
- [ ] Registro em `docs/` do que foi verificado e **do que não se aplica**, para a próxima pessoa não refazer a varredura
- [ ] `CONTEXT.md` com a decisão numerada

---

## 8. O risco

**O maior risco deste PRD é fazer demais.** O pedido descreve um site comercial com rastreamento e marketing, e este não é esse site. Implementar banner de cookie, revisar analytics inexistente ou caçar `alt` em imagens que não existem gasta as últimas horas antes do evento sem reduzir risco nenhum.

**O segundo risco é a página nova contradizer o termo.** O termo é documento aprovado e protegido por hash; se a política disser algo diferente sobre retenção, compartilhamento ou exclusão, cria-se ambiguidade exatamente onde não se quer. Onde houver dúvida, a política remete ao termo em vez de reescrever.

**O que fica em aberto e não é técnico:** a identidade do controlador. Enquanto ela não for decidida, a política não pode ser publicada, porque é a primeira informação que ela precisa dar.
