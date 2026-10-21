# Conformidade legal: o que foi verificado, e o que não se aplica

**Conferido contra o código em 2026-10-20 (D-109).** Escrito para a próxima
pessoa que receber um pedido de "revisar LGPD, cookies, analytics e
acessibilidade" não refazer a varredura do zero.

**Isto é levantamento técnico, não parecer jurídico.** Quem responde por um
evento com 2000 pessoas, incluindo menores, confirma com advogado.

---

## O que foi conferido, e como

| pedido comum                               | resultado                        | como foi conferido                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Analytics e scripts de rastreamento | **Não existe nenhum**            | busca por `gtag`, `analytics`, `googletagmanager`, `hotjar`, `clarity`, `fbq`, `pixel`, `plausible`, `posthog` em `app/` e `src/`. O único resultado foi a palavra "pixel" num comentário de CSS. Nenhuma dependência de analytics no `package.json` |
| Texto alternativo (`alt`) nas imagens      | **Não se aplica: não há imagem** | nenhum `.png`, `.jpg`, `.webp` ou `.gif`, nenhum `<img>` ou `next/image`. A marca é SVG escrito no HTML                                                                                                                                              |
| Licença das imagens                        | **Não se aplica**                | idem                                                                                                                                                                                                                                                 |
| Avaliações falsas e promessas sem prova    | **Não existe nenhuma**           | o texto visível é rótulo, aviso e erro. Não há depoimento, nota nem promessa de prêmio                                                                                                                                                               |
| Contraste                                  | **Verificado por teste**         | `tests/contraste.test.ts` calcula cada par de cor nos dois temas e exige WCAG AA                                                                                                                                                                     |
| Navegação por teclado                      | **Requisito do projeto** (RF-19) | o painel é operado por teclado, com teste                                                                                                                                                                                                            |
| Scripts de terceiros                       | **Não existe nenhum**            | nenhum `<script>` externo nem `next/script`                                                                                                                                                                                                          |
| Cookies                                    | **Dois, nenhum de rastreamento** | as únicas escritas de cookie são `app/api/tema/route.ts` (tema) e `identidade/servico.ts` (sessão do painel)                                                                                                                                         |

A ausência é deliberada e tem origem no peso, não na lei: RNF-04 proíbe imagem e
script externo, e isso produziu, de lado, um site sem superfície de rastreamento.

## O que foi construído

- **`/privacidade`**: política de privacidade, documento informativo. Nomeia o
  controlador, a base legal, o repasse opcional, os serviços de hospedagem, o
  prazo, os direitos do art. 18 com o canal, os dois cookies e a ANPD. Onde se
  sobrepõe ao termo, remete a ele.
- **`/termos`**: termos de uso. A vaga, as regras, como o resultado é registrado
  e contestado, a disponibilidade, a data em que o site sai do ar, e o foro.
- **Rodapé** em todas as páginas públicas (`/`, `/classificacao`, `/termo` e as
  duas novas) com os três documentos.

Os textos moram em `src/contexts/inscricao/documentos/`, ao lado do termo.
`tests/documentosLegais.test.ts` compara os dois com o termo vigente: mesmo
e-mail, mesmo prazo, mesmo repasse, e toda remissão apontando para uma seção que
existe.

## Decisões do organizador (2026-10-20)

| pergunta                    | decisão                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| Quem é o controlador        | **Dhiego Ferreira, pessoa física**, organizador do NEXT                         |
| Canal para os direitos      | **dhiegodev@hotmail.com**, o mesmo do termo. Não há encarregado nomeado à parte |
| A inscrição garante vaga    | **Sim.** Todo inscrito presente corre                                           |
| Foro                        | **Comarca de São Paulo/SP**                                                     |
| Os inscritos recebem e-mail | **Sim, e WhatsApp também:** o resultado por mensagem automática. Ver abaixo     |

## O que ficou de fora, de propósito

| não feito                       | por quê                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Nova versão do termo            | Versão nova nasce rascunho e bloqueia o cadastro até aprovação (D-18). O termo `v1.1` não foi tocado |
| Aviso de cookies                | Os dois cookies são necessários. Um aviso seria um clique a mais na fila sem proteger nada           |
| Remover o campo de e-mail       | Decisão de produto, e tarde demais                                                                   |
| Mexer em contraste ou teclado   | Já verificados por teste                                                                             |
| Analytics para "medir o evento" | Levaria rastreamento a um site cuja política diz o contrário                                         |

## Pontos de atenção

**A política diz que o resultado pode ir por e-mail ou por WhatsApp, e o termo
só cobre o e-mail.** Decisão do organizador, tomada sabendo disso. O termo diz
que o e-mail serve para "falar com você sobre a sua inscrição e sobre o seu
resultado", e isso cobre o envio por e-mail. Para o telefone, diz "entrar em
contato com os ganhadores depois da corrida e localizar você no dia do evento":
mandar o resultado de **todos** pelo WhatsApp é outra finalidade. A base legal é
o consentimento dado ao termo, e a própria política diz que, havendo diferença,
vale o termo. Escrever na política não cria o consentimento que falta.

Três coisas a resolver antes de mandar a primeira mensagem:

- **Mandar pelo WhatsApp só para ganhadores** está coberto pelo termo como
  está. Para os demais, o e-mail;
- o envio automático **não existe no sistema hoje**;
- um serviço de envio de WhatsApp recebe telefone e resultado, e passaria a
  ser mais uma empresa com os dados, ao lado da Vercel e da Neon. A política
  teria de dizer qual.

**A vaga garantida é promessa por escrito.** Com um Cockpit, três voltas por
pessoa e 2000 inscritos previstos, o organizador confirmou que todos correm. Se
a capacidade do dia não fechar, os termos de uso precisam mudar antes do evento,
não depois.

**O procedimento de contestação é minuta.** Os termos dizem: no dia, falar com a
equipe no Cockpit; depois, por e-mail até 3 de novembro. Confirme que a equipe
sabe disso.

**Os serviços de hospedagem aparecem na política e não no termo.** O termo diz
que os dados não são divulgados a ninguém fora da organização além da FIAP e do
curso. A política acrescenta que a Vercel e a Neon guardam os dados por conta
da organização. Não é repasse, mas é a única informação da política que o termo
não tem.

## O que teste não pega

Leitor de tela no formulário, 360 px em aparelho real, tela sob sol e teclado
no painel com o Operador. Nenhum é código: são os ensaios que já estavam
pendentes.
