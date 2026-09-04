# Inventário de front-end — as sete superfícies

Levantado em 2026-09-03, lendo o código, antes de qualquer decisão de redesenho.

**Para que serve:** o `PRD-front.md` vai propor uma direção visual. Este documento é a contraparte factual — o que cada tela faz hoje, o que já está resolvido, onde a interface **fica muda quando deveria falar**, e o que é estilo versus o que é comportamento. Sem isso, o redesenho corre dois riscos simétricos: refazer o que já está decidido com motivo, e pintar por cima de um defeito em vez de corrigi-lo.

**A distinção que organiza tudo aqui:**

- **Estilo** é cor, espaço, tipografia, hierarquia. Trocar não muda o que o sistema faz. É o território do PRD-front.
- **Comportamento** é o que a tela responde ao que a pessoa faz. Um botão que não reage é um defeito, e nenhuma paleta conserta.

Os dois se misturam num ponto só, e é o mais importante deste documento: **uma interface que recusa em silêncio é um defeito de comportamento que parece problema de estilo.**

---

## O que já existe

| superfície                     | arquivo                                    | tipo   | estilos                    | tamanho    |
| ------------------------------ | ------------------------------------------ | ------ | -------------------------- | ---------- |
| Base do sistema visual         | `app/globals.css`                          | tokens | —                          | 27 tokens  |
| Casca do documento             | `app/layout.tsx`                           | Server | —                          | —          |
| Cabeçalho público              | `app/_componentes/Cabecalho.tsx`           | Server | `cabecalho.module.css`     | 102 linhas |
| **1. Inscrição** (`/`)         | `app/_componentes/FormularioInscricao.tsx` | Client | `formulario.module.css`    | 486 linhas |
| **2. Termo** (`/termo`)        | `app/termo/page.tsx`                       | Server | `termo.module.css`         | 206 linhas |
| **3. Classificação**           | `app/classificacao/Classificacao.tsx`      | Client | `classificacao.module.css` | 332 linhas |
| **4. Login** (`/painel/login`) | `app/painel/login/FormularioLogin.tsx`     | Client | `login.module.css`         | 123 linhas |
| **5. Painel** (`/painel`)      | `app/painel/(protegido)/Painel.tsx`        | Client | `painel.module.css`        | 386 linhas |
| **6. Sair**                    | `app/painel/(protegido)/BotaoSair.tsx`     | Client | **nenhum**                 | —          |
| **7. Confirmação**             | `Confirmado`, em `FormularioInscricao.tsx` | Client | compartilhado              | —          |

Não é um site sem design. É um site com um sistema visual declarado e **aplicado de forma desigual** — e a desigualdade é mensurável, está na seção seguinte.

---

## Achados transversais

### A1. O sistema de tokens promete uma coisa e duas telas não cumprem

`globals.css` abre afirmando: _"Tudo aqui é token e nenhuma regra é decoração solta. As telas leem estas variáveis; nenhuma cor é escrita à mão dentro de um módulo."_

Medido, contando ocorrências:

| módulo                     | tokens distintos | `var(--foco)` | cores à mão |
| -------------------------- | ---------------- | ------------- | ----------- |
| `formulario.module.css`    | 21               | 4             | 1           |
| `classificacao.module.css` | 18               | 1             | 0           |
| `login.module.css`         | 14               | 2             | 0           |
| `painel.module.css`        | 13               | **0**         | 0           |
| `termo.module.css`         | 12               | 1             | 0           |
| `cabecalho.module.css`     | **3**            | **0**         | **7**       |

O cabeçalho escreve `#fff`, `#cbd5e1` e `rgb(255 255 255 / 0.08)` diretamente, e usa `outline: 3px solid #fff` no lugar de `var(--foco)`. É a única superfície que aparece em **todas** as páginas públicas — ou seja, a peça mais visível é a que menos participa do sistema.

**Isto é estilo, e é a primeira coisa a arrumar num redesenho.** Se a paleta mudar e o cabeçalho continuar com branco fixo, ele sai de tom em três telas de uma vez.

### A2. O painel não usa o anel de foco comum, e é justamente a tela operada por teclado

`painel.module.css` tem 386 linhas e **zero** ocorrências de `var(--foco)`.

O comentário do próprio `globals.css` explica por que isso importa: _"Um anel só, usado em toda parte. O painel é operado por teclado (RF-19), e foco que muda de aparência entre telas é foco que se perde de vista."_ A intenção está escrita; a aplicação não chegou lá.

Numa tela onde a pessoa navega com ↑ ↓ Enter F2 F3 Esc por dez horas, saber onde o foco está não é acabamento — é a interface inteira.

### A3. Não existe ícone, e não existe imagem de compartilhamento

Não há `app/icon.*`, `app/favicon.*`, `app/opengraph-image.*` nem diretório `public/`. Nenhum `openGraph` no `metadata`.

Duas consequências concretas para um evento:

- **A aba do navegador mostra o ícone genérico.** Quem salva a Classificação na tela inicial do celular — e num evento de um dia isso acontece — fica com um quadrado em branco.
- **O link compartilhado não tem cartão.** A Classificação vai circular no WhatsApp; hoje ela chega como URL crua, sem título, sem imagem, sem descrição.

**É estilo, tem custo baixo e efeito alto.** A restrição de peso (RNF-04) vale para o que o participante baixa ao abrir a página, não para um ícone que o navegador busca uma vez e guarda.

### A4. Não há modo escuro, e isso pode ser a decisão certa

Nenhum `prefers-color-scheme` em lugar nenhum. Só existe `prefers-reduced-motion`, tratado.

Não listo como defeito porque o `globals.css` tem um argumento explícito na direção oposta: _"Contraste antes de tom. O evento é ao ar livre, com sol na tela."_ Uma paleta escura sob sol é pior, não melhor.

**Mas o PRD-front precisa dizer isso de propósito**, porque a Classificação também vai para um telão, e telão em ambiente fechado é o caso em que escuro ganha. As duas superfícies têm ambientes opostos e hoje compartilham a paleta.

---

## Onde a interface fica muda

Esta é a seção que não é estilo. Em ordem de gravidade.

### M1. O Enter do painel recusa sem dizer nada — **é o defeito relatado**

`app/painel/(protegido)/Painel.tsx`, na função `confirmarTempo`, tem **três** saídas silenciosas:

| linha | condição                   | o que acontece na tela |
| ----- | -------------------------- | ---------------------- |
| 331   | `!pareceCompleto(digitos)` | nada                   |
| 339   | `Number(s) > 59`           | nada                   |
| 341   | `catch` da conversão       | nada                   |

Nenhuma escreve nada. O Operador aperta Enter e **não acontece absolutamente nada** — sem mensagem, sem campo em vermelho, sem som.

A da linha 339 é a mais grave, porque contradiz uma decisão deliberada da máscara. `mascaraDeTempo.ts` documenta: _"Não corrige valor implausível. `9999` vira `00:99.99`, que `parseTempo` recusa — e é exatamente o que deve acontecer: ver `00:99.99` na tela diz ao Operador que ele errou a digitação."_

A máscara mostra o valor errado **de propósito**, para a pessoa perceber. E aí o Enter o recusa **sem propósito visível**. O Operador vê um tempo na tela, aperta Enter, e conclui que o sistema travou.

A da linha 331 pega quem digitou menos de três dígitos — `pareceCompleto` exige `>= 3`.

**Correção esperada:** as três precisam dizer o que está errado, no lugar onde a pessoa está olhando. RNF-16 dá quinze segundos para um lançamento inteiro; uma recusa muda gasta os quinze e não entrega nada.

### M2. O botão Sair não tem estilo nenhum

`BotaoSair.tsx` renderiza `<button type="button">` **sem `className`**. É o único controle do projeto que não passa pelo sistema visual: sai com a aparência nativa do navegador, diferente em cada aparelho.

E `app/painel/(protegido)/page.tsx` o embrulha em `style={{ maxWidth: '60rem', margin: '0 auto', padding: '0 1rem 2rem' }}` — os únicos estilos em linha que restaram no projeto. A página do termo foi limpa exatamente disso depois de T21; este ficou para trás.

### M3. A falha de fundo do painel só aparece no cabeçalho

Quando a atualização periódica da fila falha, a tela muda uma palavra: o indicador vira "sem conexão".

**Isto é deliberado e está documentado** — _"um banner vermelho a cada 10 s por causa de um pacote perdido custa mais atenção do que informa"_. Registro aqui não como defeito, mas como escolha que o redesenho precisa **preservar conscientemente**: é fácil, ao redesenhar, transformar esse indicador discreto num alerta grande e desfazer a decisão sem perceber.

### M4. O aviso de sucesso do painel some sozinho em 4 segundos

`DURACAO_DO_AVISO_MS = 4_000`. Para um Operador com fila na frente, é provavelmente certo. Vale confirmar com quem vai operar: quatro segundos é pouco se a pessoa desviou o olhar para o cronômetro no momento exato.

### M5. O login não tem caminho de volta

`/painel/login` não usa o `Cabecalho`, e não há link nenhum para o site público. Quem abre o endereço errado — ou um participante que descobre a URL — fica numa tela sem saída que não seja o botão do navegador.

O `Cabecalho.tsx` documenta que o painel não o usa porque _"a altura da tela é orçamento"_. O argumento vale para a tela de trabalho; a de login está vazia.

---

## O que já está resolvido e não deve ser refeito

Listo para o redesenho não gastar esforço aqui — e, principalmente, para não desfazer sem perceber.

**Inscrição (`/`)** é a superfície mais trabalhada do projeto:

- resumo de erros no topo, e **cada erro é um link que foca o campo** — com `preventDefault`, para o foco de teclado ir junto com a rolagem;
- foco automático no primeiro campo inválido, com `scrollIntoView`;
- botão de envio **preso ao rodapé no celular**, com justificativa medida: o formulário passa de duas telas em 360px, e quem termina de marcar os aceites interpretaria a rolagem como travamento;
- máscara de telefone, `inputMode` e `enterKeyHint` por campo;
- `noValidate` para as mensagens do navegador não competirem com as nossas;
- o bloco do responsável **apaga o estado** ao passar dos 18, em vez de esconder;
- as caixas de aceite vêm do termo, com `obrigatorio` vindo do dado (D-23);
- campo-armadilha `empresa`, escondido de leitor de tela.

**Classificação** tem busca que destaca em vez de esconder, com as posições vizinhas em volta; pódio marcando a célula da posição e não a linha inteira, para não competir com o destaque da busca; números grandes para telão e defasagem pequena para celular; e a tabela **nunca esvazia** por falha de rede.

**Termo** ganhou índice e caminho de volta depois de T21.

**Painel** tem redutor puro em `fluxo.ts` — a garantia de RF-18 (nada grava sem confirmação) é provada por teste de estados, não por leitura de `onClick`.

---

## Restrições que o redesenho não pode atropelar

Cada uma tem auditoria, teste ou medição por trás.

1. **Nenhuma fonte externa, nenhuma imagem, nenhum ícone baixado** (RNF-04). A identidade inteira sai de cor, espaço e tipografia do sistema. Uma fonte do Google Fonts é um pedido a mais multiplicado por 2000 aparelhos em rede congestionada. _(O favicon de A3 é a exceção: o navegador o busca uma vez e guarda.)_
2. **Nenhuma navegação por `Link` do Next nas páginas públicas.** Medido: **+4,7 KB gzip** no primeiro carregamento, de 140,2 para 145,3 contra um teto de 150. O `Cabecalho` usa âncora comum, com a regra de lint desligada e o número no comentário. Há `npm run orcamento` para conferir.
3. **Nenhum dado pessoal na Classificação pública** — sobrenome abreviado para menores, nada de telefone, e-mail ou idade. Auditado em T21, com teste que falha se voltar.
4. **`no-store` no painel, exportação, métricas e saúde**; 15 s de borda na Classificação. Mexer em rota ou cabeçalho mexe em RNF-01.
5. **360px sem rolagem horizontal** (RNF-18), e sem travar o zoom.
6. **Contraste acima de 4.5:1**, porque o evento é ao ar livre. Onde a cor comunica algo, há também peso, borda ou texto.
7. **A ficha de papel de T20 sai da mesma fonte da tela.** Mudar os campos do formulário muda o impresso, que é feito antes do evento.
8. **`prefers-reduced-motion` respeitado**, e nenhuma animação de entrada.

---

## Perguntas que o PRD-front precisa responder

1. **Constrói sobre os tokens ou os substitui?** Existem 27 tokens em `globals.css` (identidade, forma, sombra, foco). Trocar os valores é barato; trocar o esquema é reescrever seis módulos.
2. **A Classificação no telão e a Classificação no celular são a mesma tela?** Hoje são, e a paleta atende o celular ao sol. Se o telão virar caso próprio, é layout novo, não ajuste.
3. **O painel entra no redesenho?** É a tela mais usada em horas, a menos integrada ao sistema visual, e a única onde erro de estética vira erro de operação.
4. **Existe identidade do evento a respeitar?** Cor da FIAP, do patrocinador, do evento. Hoje a paleta é escolha nossa — grafite, azul de pista e âmbar de bandeira — sem nada externo a obedecer.
5. **O que fazer com as três mudezes de M1**, que são comportamento e não estilo? Cabem no mesmo trabalho, mas precisam ser nomeadas como correção, não como polimento.

---

## Ordem sugerida

Se for para atacar por impacto, e não tela por tela:

1. **M1** — as recusas silenciosas do painel. É defeito, é o fluxo principal do Operador, e é o que motivou este documento.
2. **A1 e A2** — o cabeçalho e o painel entrando no sistema de tokens. Sem isso, qualquer paleta nova sai desalinhada em três telas de uma vez.
3. **M2** — o botão Sair e os estilos em linha da página do painel.
4. **A3** — ícone e cartão de compartilhamento.
5. A direção visual nova, com a base já uniforme.
6. **M5** — o caminho de volta no login.
