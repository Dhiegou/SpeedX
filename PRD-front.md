# PRD-front — Elevação visual das interfaces do SpeedX

**Complementa:** `PRD.md` (§6 Usabilidade), `SDD.md` (§3 Peso e desempenho)
**Requisitos que mandam aqui:** RNF-04, RNF-15, RNF-17, RNF-18
**Escopo:** as três páginas públicas e as duas do painel
**Prazo:** antes do congelamento de deploy de 24/10
**Estado:** executado em 2026-09-08 — 17 dos 19 critérios fechados; os 2 abertos são ensaio com gente e aparelho

---

## 1. Por que este documento existe

O sistema está correto e o visual não acompanha. As páginas funcionam, são acessíveis e passam nos testes, mas parecem uma aplicação interna, não um produto de evento. Duas mil pessoas vão abrir a classificação no celular, e o que elas veem é uma tabela sem identidade.

Este PRD trata só de interface. Nenhum requisito funcional muda, nenhuma rota nasce ou morre, nenhum contrato de API é tocado.

## 2. A restrição que decide tudo, medida

Antes de qualquer ideia visual, o número. Medi o primeiro carregamento contra o artefato de produção:

```
485.6 KB bruto   142.0 KB gzip   122.0 KB brotli   TOTAL (10 recursos)
Dentro do orçamento: teto de 150 KB gzip, folga de 8.0 KB.
```

**Sobram 8 KB gzip.** É todo o orçamento que este trabalho tem.

E há um segundo número que muda a conversa: **do total, o CSS são 3,3 KB gzip.** Os outros 138 KB são JavaScript de framework. Ou seja, o peso não está na aparência, está na plataforma. Dá para **triplicar o CSS** do projeto inteiro e ainda sobrar folga.

Isso reorganiza o problema. O que é caro e o que é grátis:

| Recurso                                          | Custo gzip             | Cabe?              |
| ------------------------------------------------ | ---------------------- | ------------------ |
| Reescrever todo o CSS com o dobro de refinamento | ~3 KB                  | Sim, com folga     |
| Paleta nova, escala tipográfica, ritmo espacial  | 0 KB                   | Sim                |
| Logotipo em SVG embutido                         | ~0,3 KB                | Sim                |
| Os dois logotipos, em SVG embutido               | **3,75 KB**            | Sim, medido (§5.2) |
| Dois temas com troca por cookie                  | ~1,5 a 2,5 KB          | Sim (§5.1)         |
| Uma fonte variável, mesmo em subconjunto latino  | 15 a 30 KB             | **Não**            |
| Qualquer imagem, mesmo otimizada                 | 20 KB e uma requisição | **Não**            |
| Biblioteca de ícones                             | 10 KB e acima          | **Não**            |
| GSAP, Splide ou qualquer biblioteca de animação  | 25 KB e acima          | **Não**            |

## 3. O ponto que precisa ser dito com todas as letras

**O nosso repertório de Ellos não se aplica aqui, e insistir nele quebraria o produto.**

O que costuma dar identidade aos sites que fazemos é exatamente o que este projeto proíbe: Playfair Display e Lora carregadas do Google Fonts, imagem de herói em alta resolução, GSAP para as entradas, Splide para os carrosséis. Cada um desses itens sozinho estoura os 8 KB, alguns por três ou quatro vezes.

E a proibição não é preciosismo de quem escreveu o código. RNF-04 dá 3 segundos para a página de cadastro carregar em rede móvel lenta, e o cenário real é dois mil aparelhos disputando a mesma célula congestionada no mesmo pátio. Uma fonte de 25 KB não é 25 KB: é 25 KB multiplicados por duas mil pessoas, numa rede que já vai estar no limite, no exato momento em que a fila decide se anda.

**Então a pergunta deste PRD não é "como deixamos bonito".** É: _quanta identidade cabe em cor, espaço, tipografia do sistema e geometria de CSS?_ E a resposta agora tem uma peça a mais, que é a marca em SVG, medida e cabendo. O que continua fora é fonte, imagem e biblioteca.

Se o resultado for julgado bonito por parecer um site da agência, o julgamento está errado. O critério aqui é: **a pessoa de pé na arquibancada, com sol na tela, acha o próprio nome em menos de dez segundos e sente que aquilo é de um evento de verdade.**

## 4. Estado atual, por página

| Página           | O que existe                                                   | Diagnóstico                                                                                                                       |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/` inscrição    | Cartão único, coluna única, seções com legenda                 | Funcional e sem hierarquia. Nada diz "corrida". Parece um formulário de cadastro genérico                                         |
| `/classificacao` | Tabela de quatro colunas, abas de Cockpit, filtro fixo no topo | É a página que 2000 pessoas veem, e é a mais sem graça das três. Nenhum tratamento de pódio, nenhum destaque do próprio resultado |
| `/termo`         | Texto legal                                                    | Adequado ao que é. Prioridade baixa                                                                                               |
| `/painel/login`  | Formulário simples                                             | Adequado. Um operador, duas vezes no dia                                                                                          |
| `/painel`        | Fila, lançamento, busca                                        | **Não é lugar para embelezar.** Densidade e velocidade são o requisito (RNF-16, 15 segundos por lançamento)                       |

A paleta atual é azul-marinho com âmbar sobre uma escala de cinzas que é a padrão de biblioteca. Funciona, tem contraste, e não tem personalidade nenhuma.

## 5. Escopo

### 5.1 Sistema visual (base de tudo)

Reescrever `globals.css` mantendo a arquitetura de tokens, que está certa, e trocando os valores por dentro dela.

**A paleta agora vem da marca, não é escolha nossa.**

| token    | hex       | uso                                  |
| -------- | --------- | ------------------------------------ |
| rosa     | `#ED145B` | acento principal                     |
| vermelho | `#E93B40` | apoio                                |
| laranja  | `#E46124` | apoio                                |
| amarelo  | `#FFE206` | só como fundo, nunca texto           |
| preto    | `#000000` | área de marca e fundo do tema escuro |
| branco   | `#FFFFFF` | fundo do tema claro                  |

**O problema medido, e ele decide a arquitetura de cor.** Calculei o contraste WCAG de cada cor da marca:

| cor       | sobre branco     | sobre preto |
| --------- | ---------------- | ----------- |
| `#ED145B` | **4,33** reprova | 4,85 passa  |
| `#E93B40` | **4,07** reprova | 5,16 passa  |
| `#E46124` | **3,48** reprova | 6,03 passa  |
| `#FFE206` | **1,30** reprova | 16,13 passa |

**Nenhuma das quatro passa em fundo claro. Todas passam em fundo preto.** Esta é uma marca desenhada para o escuro, e o logo confirma, porque veio sobre preto.

Três regras saem daí, e elas não são estilo, são condição de legibilidade:

1. **Cores puras da marca só em texto grande.** A regra WCAG acima de 24px é 3:1, não 4,5:1, e rosa, vermelho e laranja passam nessa faixa sobre branco. Servem para números da classificação, títulos e o pódio.
2. **Texto de corpo usa as variantes escurecidas.** Calculei as mínimas que atingem 4,5:1 sobre branco preservando a matiz: `#ED145B` vira `#E81258`, `#E93B40` vira `#E6242A`, `#E46124` vira `#C85019`. Rosa e vermelho quase não mudam porque já estavam na fronteira.
3. **O amarelo nunca é texto sobre claro.** Em 1,30 é ilegível, e escurecido vira ocre, que já não é a cor da marca. Ele é fundo, com texto preto por cima, onde entrega 16:1.

**Dois temas, e o padrão é o claro.**

O tema escuro fica fiel à marca, porque a paleta foi feita para preto. Testei os fundos e **use `#000000` ou `#0A0A0B`**: a partir de `#121214` o rosa cai para 4,32 e reprova. Grafite não serve aqui.

O padrão é o claro **sempre**, e não o `prefers-color-scheme`. O motivo é o mesmo argumento do sol: a maioria deixa o aparelho no escuro, mas essa preferência foi formada em ambiente fechado, e o evento é ao ar livre. Seguir o sistema operacional entregaria o tema pior por padrão para mais da metade das pessoas, no exato ambiente em que ele é pior. O sistema não sabe onde a pessoa está; nós sabemos. A escolha continua sendo dela, pelo botão, e é respeitada e lembrada.

**A troca é guardada em cookie, não em `localStorage`.** E isso é decisão técnica, não contorno:

- O cookie é lido no servidor, então a página **já renderiza no tema certo na primeira pintura**. Isso elimina o script bloqueante no `<head>` e o risco de erro de hidratação, que são justamente os custos que o `localStorage` obriga a pagar, por só ser legível depois que o JavaScript roda.
- O projeto já usa cookie para a sessão do painel, então a infraestrutura existe (`src/contexts/identidade/servico.ts`).
- Tema não é dado pessoal, e não esbarra em RNF-08 nem no que o termo promete.

**Sem persistência, o botão não funciona na prática.** As páginas públicas usam âncora comum em vez do `Link` do Next, por causa dos 4,7 KB medidos, e por isso toda navegação é recarga completa. Estado em memória morreria a cada clique entre inscrição, termo e classificação.

**O resto do sistema:**

- **Escala tipográfica de verdade**, com razão definida em vez de valores escolhidos um a um. As fontes continuam sendo as do sistema, e o refinamento vem de tamanho, entrelinha, `letter-spacing` e medida de linha.
- **Escala espacial** de passos nomeados, em vez do `rem` avulso que cada módulo escolhe hoje.

### 5.2 Identidade da marca

Os dois logotipos estão prontos, vetorizados e medidos.

| peça                                | origem                                | gzip        |
| ----------------------------------- | ------------------------------------- | ----------- |
| marca SpeedX                        | traçada do JPEG, 97,67% de fidelidade | 1,89 KB     |
| selo PrinterX                       | vetor original, otimizado com `svgo`  | 1,97 KB     |
| **os dois embutidos no mesmo HTML** |                                       | **3,75 KB** |

Sobram **4,25 KB** para o trabalho de temas, que estimei entre 1,5 e 2,5 KB.

**Ambos vão embutidos no HTML, não como arquivo de imagem.** SVG em `<img>` seria requisição a mais, e o primeiro carregamento tem que continuar em 10 recursos.

**O selo é parte do logo e vai junto onde o logo aparecer.** Isso tem uma consequência de tamanho que foi medida: o texto "POWERED BY" precisa de cerca de 8px de altura para ser legível, o que exige **logo com no mínimo 200px de largura**, ou 56% da tela num aparelho de 360px. Abaixo de 180px o selo fica ilegível e não vale estar ali. A consequência é que os links de navegação vão **abaixo** do logo no celular, e não ao lado.

**O cabeçalho é preto nos dois temas**, funcionando como área de marca. Isso resolve três coisas de uma vez: o "POWERED BY" é branco no vetor e sumiria em fundo claro; o logo aparece exatamente como foi desenhado; e a marca ganha um lugar fiel mesmo no tema claro. O cabeçalho de hoje já é escuro, então é mais confirmação do que mudança.

Some do cabeçalho o quadriculado em gradiente que servia de marca provisória.

### 5.3 Classificação (maior retorno do projeto)

É a página com mais audiência e a mais fraca. O que ela precisa:

- **Tratamento de pódio** para as três primeiras posições, com peso e cor além do número, nunca só cor.
- **Destaque do próprio resultado.** Quem se inscreveu deveria conseguir se achar sem varrer a lista. Isso pede uma decisão de produto sobre como o navegador sabe quem é a pessoa, e a decisão precisa respeitar RNF-08 (nada de dado pessoal em armazenamento de navegador sem pensar).
- **Hierarquia da linha**: hoje as quatro colunas têm o mesmo peso visual. Posição, nome e tempo não valem a mesma coisa.
- Manter números tabulares, filtro fixo no topo, abas de Cockpit e 360px sem rolagem horizontal.

**O telão não é caso próprio, e isso está decidido.** Ele é esta mesma página projetada, e nem existe confirmação de que vai haver um. Não se constrói layout, rota nem modo separado para ele: seria trabalho especulativo por algo que pode não acontecer, e o que já está lá funciona — os números grandes leem de longe e a sondagem periódica atualiza sozinha, que é exatamente o que um telão precisa.

Se ele for confirmado, a saída é o navegador em tela cheia na página que existe. Fica **um item de ensaio, não de projeto**: conferir se a tabela lê da distância real da arquibancada, e isso cabe na tarde de ensaios que a T21 já pede. Se nesse ensaio a leitura falhar, aí sim vira decisão de layout, com o problema medido em vez de suposto.

### 5.4 Inscrição

- Hierarquia entre as três seções, que hoje se parecem demais.
- **Estados de erro, carregamento e sucesso** com o mesmo cuidado do estado normal. É onde um produto revela se foi acabado, e é o que RNF-17 já exige em conteúdo mas não em forma.
- Preservar o que já está resolvido: alvos de toque de 44px, coluna única, `overflow-wrap`, foco visível.

### 5.5 Painel

**Correção do que este PRD dizia antes.** Eu havia colocado o painel inteiramente fora de escopo. O inventário mostra que isso estava errado em duas frentes, ambas verificadas por mim no código:

- `painel.module.css` tem 386 linhas e **zero ocorrências de `var(--foco)`**, enquanto `formulario.module.css` tem 4. É a única tela operada por teclado durante dez horas, e é a que não usa o anel de foco comum que o sistema declara.
- `BotaoSair.tsx` renderiza `<button type="button">` **sem `className` nenhum**, e é o único controle do projeto fora do sistema visual. A `page.tsx` do painel guarda o **único** `style={{ }}` em linha que restou no projeto.

Então o painel entra, com escopo estreito e explícito:

- Absorver os tokens e passar a usar `var(--foco)`.
- Dar estilo ao botão Sair e eliminar o estilo em linha.
- **Nenhuma mudança de layout, densidade ou fluxo.** A fila continua cabendo sem rolagem e o lançamento continua em 15 segundos (RNF-16).
- Preservar conscientemente a falha de fundo discreta: quando a atualização da fila falha, a tela muda uma palavra, e isso é decisão registrada. Redesenhar sem cuidado transforma esse indicador num banner de alerta e desfaz a decisão sem ninguém perceber.

### 5.6 Correções de comportamento (não é estilo)

Três recusas silenciosas em `confirmarTempo`, no painel. Verifiquei as três no código: são `return` nus, nenhum escreve nada na tela.

| condição                   | quem ela pega                     | o que a tela faz hoje |
| -------------------------- | --------------------------------- | --------------------- |
| `!pareceCompleto(digitos)` | quem digitou menos de 3 dígitos   | nada                  |
| `Number(s) > 59`           | quem digitou segundos impossíveis | nada                  |
| `catch` da conversão       | entrada malformada                | nada                  |

A segunda é a mais grave, porque **contradiz uma decisão deliberada da máscara**. `mascaraDeTempo.ts` documenta que não corrige valor implausível de propósito: `9999` vira `00:99.99` justamente para o Operador ver que errou. A máscara mostra o erro para a pessoa perceber, e aí o Enter o recusa sem propósito visível. O Operador vê um tempo na tela, aperta Enter, e conclui que o sistema travou.

RNF-16 dá quinze segundos para um lançamento inteiro. Uma recusa muda gasta os quinze e não entrega nada.

**Isto não é polimento e não deve ser tratado como tal.** Nenhuma paleta conserta um botão que não responde. Entra como correção, com teste que falha se a mudez voltar.

### 5.7 Ícone e cartão de compartilhamento

Não existe `app/icon.*`, `app/opengraph-image.*`, `public/` nem `openGraph` no metadata. Verificado.

Duas consequências para um evento de um dia: quem salva a Classificação na tela inicial do celular fica com um quadrado em branco, e o link que circula no WhatsApp chega como URL crua, sem título nem imagem.

**Custo real, mais favorável do que parece:** o `opengraph-image` é buscado pelo rastreador do WhatsApp, **nunca pelo participante**, então custa zero no orçamento. O ícone é um pedido de prioridade baixa que não bloqueia a pintura, e em SVG cabe em algumas centenas de bytes. Nenhum dos dois entra na conta de RNF-04, e vale confirmar isso rodando `npm run orcamento` depois, que é a única prova que aceita.

## 6. Fora de escopo

- Qualquer fonte que não seja a do sistema
- Qualquer imagem, ícone baixado ou biblioteca de animação
- Animações de entrada. A única transição permitida continua sendo a de estado de controle, em milissegundos, desligada por `prefers-reduced-motion`
- Mudança de rota, de contrato de API ou de regra de validação
- Redesenho de layout do painel

## 7. Restrições de verificação

Cada uma tem verificação automática já existente, e nenhuma pode regredir:

| Restrição                                    | Como se verifica                               |
| -------------------------------------------- | ---------------------------------------------- |
| Teto de 150 KB gzip no primeiro carregamento | `npm run orcamento`                            |
| A suíte inteira passando                     | `npm test` e `npx playwright test`             |
| Tipos, lint e formatação                     | `npm run check`                                |
| 360px sem rolagem horizontal                 | Playwright, e conferência em aparelho          |
| Contraste acima de 4,5:1, nos dois temas     | `npm test` — `tests/contraste.test.ts` calcula |
| Alvos de toque de 44px                       | Playwright                                     |

**Um achado que reduz muito o risco deste trabalho:** os testes de interface usam papéis e rótulos acessíveis, não classes CSS. Contei 54 seletores por papel ou rótulo contra 1 por classe nos três arquivos de teste de UI. Isso significa que o markup e o estilo podem mudar bastante sem quebrar a suíte, **desde que a estrutura acessível seja preservada**. Se um teste quebrar por seletor, o sinal provável é que a acessibilidade regrediu, e a correção é no componente, não no teste.

## 8. Ordem de execução

Revista depois do inventário: **o defeito vem antes da estética, e a base uniforme vem antes da paleta nova.** Uma etapa por PRD numerado. Cada uma fecha com `npm run check`, `npm test` e `npm run orcamento` verdes.

1. **As três mudezes do painel** (§5.6). É defeito, é o fluxo principal do Operador, e não depende de nenhuma decisão visual.
2. **Uniformizar a base** — cabeçalho e painel entrando nos tokens e no `var(--foco)`. O cabeçalho aparece em todas as páginas públicas com 3 tokens e 9 cores à mão; sem arrumar isso primeiro, qualquer paleta nova sai desalinhada em três telas de uma vez.
3. **Botão Sair e o estilo em linha** (§5.5).
4. **Ícone e cartão de compartilhamento** (§5.7), e os dois logotipos no cabeçalho (§5.2). Os ativos já estão prontos e medidos.
5. **Sistema visual novo** — paleta, escalas, ritmo. Agora sobre base uniforme.
6. **Classificação** — pódio e hierarquia.
7. **Inscrição** — hierarquia e estados.
8. **Caminho de volta no login**, e medição final: orçamento, 360px em aparelho real, contraste par a par.

Os itens 1 a 4 não dependem de nenhuma decisão de direção visual. **Se o prazo apertar, eles sozinhos já melhoram o produto** e podem ser entregues antes de qualquer discussão de paleta.

## 9. Critérios de aceitação

- [x] `npm run orcamento` passa, e o relatório do antes e depois está registrado com o número medido — **143,0 → 148,4 KB gzip**, folga de 1,6 KB. Medido em três pontos para separar as parcelas: os dois temas custaram **0,7 KB** e os dois logotipos, **4,8 KB**
- [x] `npm test` e `npm run check` limpos — **696 testes**, 38 arquivos, mais 25 de ponta a ponta
- [x] Nenhuma requisição de rede nova no primeiro carregamento. Continua em **10 recursos**
- [x] Contraste acima de 4,5:1 em todo par de texto e fundo — **calculado, não escrito**: `tests/contraste.test.ts` confere 31 pares de texto, 2 de texto grande e 11 gráficos
- [ ] 360px sem rolagem horizontal nas cinco páginas, conferido em aparelho real — **parcial**: as cinco passam no Playwright em 360px, agora incluindo o termo e uma conferência do bloqueio da marca. O aparelho real é ensaio de gente e continua aberto
- [x] Nenhum estado comunicado apenas por cor — pódio mantém número e barra, conexão mantém texto, recusa mantém barra à esquerda, página atual mantém `aria-current` e peso
- [x] Contraste verificado nos **dois** temas, par a par — o teste roda a mesma bateria duas vezes, resolvendo a herança do tema escuro
- [x] O tema abre no claro por padrão, e a escolha sobrevive à navegação entre páginas — verificado em navegador (`e2e/tema.spec.ts`), clicando de uma página para a outra
- [x] Nenhuma piscada de tema no primeiro carregamento — o `data-tema` sai no HTML cru, e há teste que busca a resposta antes de qualquer script rodar
- [x] O selo PrinterX legível: logo com 200px ou mais onde ele aparecer — conferido em 360px pelo navegador, medindo o elemento
- [x] Nenhum `localStorage` no projeto — teste varre `app/` e `src/`, ignorando comentário
- [x] `prefers-reduced-motion` respeitado — regra intocada, nenhuma animação nova; e teste que recusa `prefers-color-scheme` decidindo tema
- [x] `var(--foco)` usado em todas as seis superfícies, incluindo o painel — com `--foco-sobre-area` para a área preta
- [x] Nenhuma cor literal em módulo CSS, incluindo o cabeçalho
- [x] Nenhum `style={{ }}` em linha no projeto — a exceção declarada é `opengraph-image.tsx`, montado fora do navegador
- [x] As três recusas do `confirmarTempo` dizem o que está errado — 6 testes; verificado ao contrário, escondendo a mensagem: 5 quebram
- [x] Ícone e cartão de compartilhamento existem, e o orçamento continua passando — os dois foram refeitos na paleta da marca
- [ ] O painel mantém a fila sem rolagem e o lançamento em 15 segundos — **pendente**: nenhuma mudança de layout ou densidade foi feita (§5.5), mas cronometrar é ensaio com Operador, item 3.17 do checklist
- [x] `CONTEXT.md` com as decisões visuais numeradas na sequência corrente — **D-94** (a marca decide a cor), **D-95** (dois temas por cookie) e **D-96** (o custo dos logotipos), com D-93 marcada como revisada

### O que a execução corrigiu neste documento

Três números deste PRD não sobreviveram à medição, e ficam registrados porque o método vale mais que o número:

1. **O par de logotipos custou 4,8 KB, e não 3,75.** Os 3,75 saíram de comprimir os dois arquivos SVG isoladamente. Embutidos no HTML eles comprimem contra outro dicionário, e a conta muda. A medida que vale é sempre a do primeiro carregamento inteiro — e é a que `npm run orcamento` dá.
2. **O vermelho de corpo precisou de um degrau a mais.** `#E6242A` está certo para texto sobre branco, que é o par que §5.1 calculou. Só que no produto o vermelho é o erro, e o erro aparece sobre a própria tarja rosada: ali ele cai para 4,08 e reprova. `--erro` ficou em `#D11F25`.
3. **A folga final é 1,6 KB, e não os 4,25 previstos em §5.2.** Continua dentro do teto, mas é a margem mais estreita que este projeto já teve. Se ela apertar de novo, o caminho mais barato de volta é pedir o vetor original da SpeedX a quem desenhou a marca: o que está aqui é traço automático, e traço automático gasta mais nós — e o material impresso vai precisar do original de qualquer forma.

## 10. Riscos

| Risco                                                   | Mitigação                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A folga de 8 KB acaba no meio do caminho                | Medir a cada etapa, não no fim. O CSS é 3,3 KB hoje, então a folga é generosa para o que está previsto   |
| Alguém propõe fonte externa durante a execução          | Está no fora de escopo por escrito, e o orçamento reprova sozinho                                        |
| Contraste regride na busca por uma paleta mais bonita   | Verificação par a par é critério de aceitação, não conferência de fim                                    |
| Redesenho quebra teste de UI                            | Baixo, pelos seletores acessíveis. E teste quebrado é sinal de acessibilidade perdida                    |
| Trabalho invade o congelamento de 24/10                 | Etapas independentes e entregáveis. Se o tempo acabar, o que estiver pronto já está no ar e o resto fica |
| A marca SpeedX é traço automático, não o vetor original | 97,67% de fidelidade e 1,89 KB, suficiente para tela. Para gráfica, pedir o original a quem desenhou     |
| O logo de 200px espreme a navegação em 360px            | Links abaixo do logo, não ao lado. Conferir em aparelho real, não no emulador                            |

## 11. Decisões tomadas e o que ainda falta

| pergunta                               | decisão                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Constrói sobre os tokens ou substitui? | **Constrói.** O esquema está certo; trocam-se os valores                                 |
| O painel entra no redesenho?           | **Entra, com escopo estreito** (§5.5)                                                    |
| O que fazer com as mudezes?            | **São correção, e vêm primeiro** (§5.6)                                                  |
| O telão é caso próprio?                | **Não.** Vira item de ensaio (§5.3)                                                      |
| Existe identidade externa?             | **Sim**, e é a paleta do projeto (§5.1). A PrinterX é patrocinador e vive dentro do logo |
| Claro ou escuro?                       | **Os dois**, com o claro por padrão (§5.1)                                               |
| Onde guardar a escolha de tema?        | **Cookie**, nunca `localStorage` (§5.1)                                                  |
| Quem diz qual linha é a da pessoa?     | **Ninguém, e de propósito.** A busca já responde, e sem guardar nada (fechada em 14/10)  |

### Fechada em 2026-10-14

**Como a Classificação identifica o próprio resultado do participante? Ela não identifica, e isso é a decisão.**

A pergunta ficou aberta durante toda a execução, sem bloquear nada: o pódio e a hierarquia foram entregues, e a linha destacada tem forma pronta (`--acento-claro` com barra à esquerda) — faltava só quem dissesse qual linha é. As três saídas foram postas lado a lado com o custo de cada uma, e a escolhida foi **nenhuma delas**.

**O argumento é que a pergunta já tem resposta, e ela não cobra nada.** Quem quer se achar digita o nome na busca, e a linha acende com as vizinhas em volta — que é exatamente o que a pessoa em 437º precisa ver. Nada sai do dispositivo, nada é guardado, nada entra na URL.

As duas alternativas cobravam, e cobravam no lugar errado. Levar o nome público na URL da tela de confirmação o põe no histórico do navegador e em qualquer link colado sem perceber — um dado que é público **naquela página** passando a viajar fora dela. E um botão "sou eu" exigiria cookie: a decisão do cookie de tema **não** abre essa porta, porque tema é preferência de interface e identificar participante é outra categoria, que passa pelo que o termo promete — e termo novo nasce rascunho, e sob rascunho o sistema recusa cadastrar qualquer pessoa (D-18).

**O que isto fecha:** o PRD-front não tem mais pergunta aberta. Os dois critérios de aceitação que continuam marcados são ensaio com gente e aparelho (§9), e não decisão de produto.

## 12. Ativos e onde eles vivem

Os arquivos de marca **não são imagens servidas**. Eles viram SVG embutido dentro de componentes React, porque imagem seria requisição a mais e o primeiro carregamento precisa continuar em 10 recursos.

```
app/
  _componentes/
    marca/
      SpeedX.tsx        <- <svg> da marca, inline, aceita largura por prop
      PrinterX.tsx      <- <svg> do selo, inline
      Logo.tsx          <- compõe os dois no bloqueio oficial
  icon.svg              <- favicon (convenção de arquivo do Next)
  opengraph-image.png   <- cartão de compartilhamento, 1200x630
docs/
  marca/                <- originais, NÃO servidos, só arquivo histórico
    speedx-original.jpg
    printerx-powered-by.svg
    paleta.md
```

**Regras que decidem cada caso:**

- **`public/` fica vazio, e é de propósito.** Tudo que entra ali vira URL servida e requisição separada. O logo do cabeçalho não pode ser requisição.
- **`app/icon.svg` e `app/opengraph-image.png` são exceções corretas**, e por motivos diferentes: o ícone é pedido de prioridade baixa que o navegador busca uma vez e guarda, e o cartão de compartilhamento é buscado **pelo rastreador do WhatsApp, nunca pelo participante**, então custa zero no orçamento. As duas são convenção de arquivo do Next, que gera as meta tags sozinho.
- **O cartão de compartilhamento é a única imagem raster do projeto**, porque WhatsApp e Twitter não renderizam SVG em prévia de link. 1200x630, e o peso dele não entra em RNF-04.
- **`docs/marca/` guarda os originais** para quando alguém precisar refazer, inclusive o JPEG de onde a marca foi traçada. Nada ali é servido.
