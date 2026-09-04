# PRD-front — Elevação visual das interfaces do SpeedX

**Complementa:** `PRD.md` (§6 Usabilidade), `SDD.md` (§3 Peso e desempenho)
**Requisitos que mandam aqui:** RNF-04, RNF-15, RNF-17, RNF-18
**Escopo:** as três páginas públicas e as duas do painel
**Prazo:** antes do congelamento de deploy de 24/10
**Estado:** executado em 2026-09-03 — 12 dos 14 critérios fechados; os 2 abertos são ensaio com gente e aparelho

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

| Recurso                                          | Custo gzip             | Cabe?                                |
| ------------------------------------------------ | ---------------------- | ------------------------------------ |
| Reescrever todo o CSS com o dobro de refinamento | ~3 KB                  | Sim, com folga                       |
| Paleta nova, escala tipográfica, ritmo espacial  | 0 KB                   | Sim                                  |
| Logotipo em SVG embutido                         | ~0,3 KB                | Sim                                  |
| Paleta alternativa por `prefers-color-scheme`    | ~0,6 KB                | Cabe, mas **decidido contra** (§5.1) |
| Uma fonte variável, mesmo em subconjunto latino  | 15 a 30 KB             | **Não**                              |
| Qualquer imagem, mesmo otimizada                 | 20 KB e uma requisição | **Não**                              |
| Biblioteca de ícones                             | 10 KB e acima          | **Não**                              |
| GSAP, Splide ou qualquer biblioteca de animação  | 25 KB e acima          | **Não**                              |

## 3. O ponto que precisa ser dito com todas as letras

**O nosso repertório de Ellos não se aplica aqui, e insistir nele quebraria o produto.**

O que costuma dar identidade aos sites que fazemos é exatamente o que este projeto proíbe: Playfair Display e Lora carregadas do Google Fonts, imagem de herói em alta resolução, GSAP para as entradas, Splide para os carrosséis. Cada um desses itens sozinho estoura os 8 KB, alguns por três ou quatro vezes.

E a proibição não é preciosismo de quem escreveu o código. RNF-04 dá 3 segundos para a página de cadastro carregar em rede móvel lenta, e o cenário real é dois mil aparelhos disputando a mesma célula congestionada no mesmo pátio. Uma fonte de 25 KB não é 25 KB: é 25 KB multiplicados por duas mil pessoas, numa rede que já vai estar no limite, no exato momento em que a fila decide se anda.

**Então a pergunta deste PRD não é "como deixamos bonito".** É: _quanta identidade cabe em cor, espaço, tipografia do sistema e geometria de CSS?_ E a resposta honesta é: muito mais do que está lá hoje. O que existe agora não usa nem perto do teto do que essas quatro ferramentas dão.

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

Reescrever `globals.css` mantendo a arquitetura de tokens, que está certa, e elevando as decisões dentro dela.

- **Paleta com identidade própria.** Sair do azul-marinho e cinza-de-biblioteca. Manter o compromisso de contraste acima de 4,5:1 em todo par de texto e fundo, que não é negociável: o evento é ao ar livre.
- **Escala tipográfica de verdade**, com razão definida em vez de valores escolhidos um a um. As fontes continuam sendo as do sistema, e o refinamento vem de tamanho, entrelinha, `letter-spacing` e medida de linha.
- **Escala espacial** de passos nomeados, em vez do `rem` avulso que cada módulo escolhe hoje.
- **Sem modo escuro. Decisão fechada.** Eu havia proposto isto como ganho fácil e estava errado duas vezes. `globals.css` já argumentava o oposto de propósito: o evento é ao ar livre e paleta escura sob sol piora a leitura. O que restava era o telão, e ele foi decidido em §5.3: não é caso próprio. Sobra um ambiente só, e é o mais hostil dos dois. Uma paleta serve.

### 5.2 Identidade da marca

- **Logotipo em SVG embutido**, substituindo o quadriculado em gradiente do cabeçalho. SVG no HTML custa alguns décimos de KB e é a única forma de ter marca de verdade dentro do orçamento.
- Definir o que o SpeedX parece: hoje o único gesto de identidade é a faixa de 4px no topo do `body`.

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

| Restrição                                    | Como se verifica                              |
| -------------------------------------------- | --------------------------------------------- |
| Teto de 150 KB gzip no primeiro carregamento | `npm run orcamento`                           |
| 636 testes passando                          | `npm test`                                    |
| Tipos, lint e formatação                     | `npm run check`                               |
| 360px sem rolagem horizontal                 | Playwright, e conferência em aparelho         |
| Contraste acima de 4,5:1                     | Conferência par a par, registrada por escrito |
| Alvos de toque de 44px                       | Playwright                                    |

**Um achado que reduz muito o risco deste trabalho:** os testes de interface usam papéis e rótulos acessíveis, não classes CSS. Contei 54 seletores por papel ou rótulo contra 1 por classe nos três arquivos de teste de UI. Isso significa que o markup e o estilo podem mudar bastante sem quebrar a suíte, **desde que a estrutura acessível seja preservada**. Se um teste quebrar por seletor, o sinal provável é que a acessibilidade regrediu, e a correção é no componente, não no teste.

## 8. Ordem de execução

Revista depois do inventário: **o defeito vem antes da estética, e a base uniforme vem antes da paleta nova.** Uma etapa por PRD numerado. Cada uma fecha com `npm run check`, `npm test` e `npm run orcamento` verdes.

1. **As três mudezes do painel** (§5.6). É defeito, é o fluxo principal do Operador, e não depende de nenhuma decisão visual.
2. **Uniformizar a base** — cabeçalho e painel entrando nos tokens e no `var(--foco)`. O cabeçalho aparece em todas as páginas públicas com 3 tokens e 9 cores à mão; sem arrumar isso primeiro, qualquer paleta nova sai desalinhada em três telas de uma vez.
3. **Botão Sair e o estilo em linha** (§5.5).
4. **Ícone e cartão de compartilhamento** (§5.7). Independente de tudo, entrega valor sozinho.
5. **Sistema visual novo** — paleta, escalas, ritmo. Agora sobre base uniforme.
6. **Classificação** — pódio e hierarquia.
7. **Inscrição** — hierarquia e estados.
8. **Caminho de volta no login**, e medição final: orçamento, 360px em aparelho real, contraste par a par.

Os itens 1 a 4 não dependem de nenhuma decisão de direção visual. **Se o prazo apertar, eles sozinhos já melhoram o produto** e podem ser entregues antes de qualquer discussão de paleta.

## 9. Critérios de aceitação

- [x] `npm run orcamento` passa, e o relatório do antes e depois está registrado com o número medido — **142,3 → 143,0 KB gzip**, folga de 7,0 KB. A identidade inteira custou 0,7 KB
- [x] `npm test` e `npm run check` limpos — **672 testes**, 37 arquivos
- [x] Nenhuma requisição de rede nova no primeiro carregamento. Continua em **10 recursos**
- [x] Contraste acima de 4,5:1 em todo par de texto e fundo — **calculado, não escrito**: `tests/contraste.test.ts` lê os tokens e confere 28 pares de texto e 7 gráficos (piso 3:1 nestes)
- [ ] 360px sem rolagem horizontal nas cinco páginas, conferido em aparelho real — **pendente**: nenhuma regra de largura fixa entrou, e o Playwright cobre o emulado, mas o aparelho real é ensaio de gente e continua aberto
- [x] Nenhum estado comunicado apenas por cor — pódio mantém número e barra, conexão mantém texto, recusa mantém barra à esquerda
- [x] `prefers-reduced-motion` respeitado — regra de `globals.css` intocada, nenhuma animação nova
- [x] `var(--foco)` usado em todas as seis superfícies — com `--foco-sobre-marca` para fundo escuro, e teste que recusa anel próprio
- [x] Nenhuma cor literal em módulo CSS — eram **47**, não 10 (o inventário subcontava; ver a correção lá)
- [x] Nenhum `style={{ }}` em linha no projeto — a exceção declarada é `opengraph-image.tsx`, montado fora do navegador
- [x] As três recusas do `confirmarTempo` dizem o que está errado — 6 testes; verificado ao contrário, escondendo a mensagem: 5 quebram
- [x] Ícone e cartão de compartilhamento existem, e o orçamento continua passando
- [ ] O painel mantém a fila sem rolagem e o lançamento em 15 segundos — **pendente**: nenhuma mudança de layout ou densidade foi feita (§5.5), mas cronometrar é ensaio com Operador, item 3.17 do checklist
- [x] `CONTEXT.md` com as decisões visuais numeradas — **D-92** (verificação no lugar da afirmação) e **D-93** (asfalto e bandeira)

## 10. Riscos

| Risco                                                 | Mitigação                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A folga de 8 KB acaba no meio do caminho              | Medir a cada etapa, não no fim. O CSS é 3,3 KB hoje, então a folga é generosa para o que está previsto   |
| Alguém propõe fonte externa durante a execução        | Está no fora de escopo por escrito, e o orçamento reprova sozinho                                        |
| Contraste regride na busca por uma paleta mais bonita | Verificação par a par é critério de aceitação, não conferência de fim                                    |
| Redesenho quebra teste de UI                          | Baixo, pelos seletores acessíveis. E teste quebrado é sinal de acessibilidade perdida                    |
| Trabalho invade o congelamento de 24/10               | Etapas independentes e entregáveis. Se o tempo acabar, o que estiver pronto já está no ar e o resto fica |

## 11. Decisões tomadas e o que ainda falta

Das cinco perguntas que o inventário levantou, **as cinco estão fechadas.**

| pergunta                               | decisão                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Constrói sobre os tokens ou substitui? | **Constrói.** Os 27 tokens e o esquema estão certos. O problema é aplicação desigual, não desenho     |
| O painel entra no redesenho?           | **Entra, com escopo estreito.** Tokens e anel de foco, nenhuma mudança de layout (§5.5)               |
| O que fazer com as mudezes?            | **São correção, não polimento**, e vêm primeiro (§5.6)                                                |
| O telão é caso próprio?                | **Não.** É a mesma página projetada, e nem há confirmação de que existirá. Vira item de ensaio (§5.3) |
| Existe identidade externa a respeitar? | **Não.** Nenhuma marca, patrocinador ou cor institucional a obedecer                                  |

Duas consequências que valem ser ditas:

**O modo escuro caiu de vez.** Ele só se sustentava se o telão fosse ambiente próprio. Não é, então sobra um ambiente só, e é celular ao sol. Uma paleta serve, e o argumento de contraste antes de tom que já estava no `globals.css` continua valendo sem concorrente.

**A etapa 5 está desbloqueada e tem liberdade total.** Sem marca externa, a paleta é inteiramente escolha nossa. Isso importa mais do que parece: era a única pergunta que podia obrigar a refazer o sistema visual depois de pronto, e ela não existe. A restrição que sobra é a de sempre, e é técnica, não política — 8 KB, contraste acima de 4,5:1, e nada de fonte ou imagem.

### Ainda aberta

**Como a Classificação identifica o próprio resultado do participante?** É a única que continua de pé, e não bloqueia o começo do trabalho: as etapas 1 a 5 rodam sem ela, e §5.3 entrega pódio e hierarquia de qualquer forma. Ela só decide se existe destaque pessoal, e a resposta tem implicação de RNF-08, porque qualquer coisa guardada no navegador precisa passar pelo que o termo promete.
