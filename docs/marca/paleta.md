# Marca e paleta do SpeedX

Arquivo de referência. **Nada aqui é servido**: os vetores desta pasta são os
originais, guardados para quem precisar refazer o trabalho. O que a aplicação
usa são os componentes de `app/_componentes/marca/`, com o SVG embutido no HTML.

## Os arquivos

| arquivo                   | o que é                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `speedx-tracado.svg`      | a marca SpeedX vetorizada a partir do JPEG, com 97,67% de fidelidade |
| `printerx-powered-by.svg` | o selo da patrocinadora, vetor original dela                         |

**O que falta aqui:** o `speedx-original.jpg`, de onde o traço saiu, e o vetor
original da SpeedX. O traço serve para tela e não para gráfica — para material
impresso, pedir o arquivo original a quem desenhou a marca.

Os dois SVG desta pasta trazem um manifesto **C2PA** embutido em `<metadata>`:
7,7 KB de base64 que não desenha nada. Ele é retirado nos componentes, e é o que
faz o par caber em 3,8 KB gzip como arquivo. `tests/sistemaVisual.test.ts` falha
se ele voltar.

## As seis cores

| cor      | hex       | papel                                        |
| -------- | --------- | -------------------------------------------- |
| rosa     | `#ED145B` | acento principal                             |
| vermelho | `#E93B40` | apoio — no produto, o erro                   |
| laranja  | `#E46124` | apoio — no produto, o aviso e o pódio bronze |
| amarelo  | `#FFE206` | só como fundo, nunca texto — o pódio ouro    |
| preto    | `#000000` | área de marca, e o fundo do tema escuro      |
| branco   | `#FFFFFF` | a superfície do tema claro                   |

## O problema medido

Contraste WCAG de cada cor da marca, calculado:

| cor       | sobre branco   | sobre preto |
| --------- | -------------- | ----------- |
| `#ED145B` | **4,33** falha | 4,85 passa  |
| `#E93B40` | **4,07** falha | 5,16 passa  |
| `#E46124` | **3,48** falha | 6,03 passa  |
| `#FFE206` | **1,30** falha | 16,13 passa |

**Nenhuma das quatro passa em fundo claro. Todas passam em preto.** Esta é uma
marca desenhada para o escuro — e o logotipo confirma, porque veio sobre preto.

Daí saem as três regras que governam o uso da cor no produto:

1. **Cor pura só em texto grande.** Acima de 24px, ou 19px em negrito, a norma
   pede 3:1 e não 4,5:1. É a faixa onde `#ED145B` e `#E46124` voltam ao produto:
   o total da Classificação, a contagem do painel, o pódio.
2. **Texto de corpo usa a variante escurecida.** `#ED145B` vira `#E81258` e
   `#E46124` vira `#C85019` — as mínimas que atingem 4,5:1 sobre branco
   preservando a matiz. O rosa quase não muda porque já estava na fronteira.
3. **O amarelo nunca é texto sobre claro.** Em 1,30 é ilegível, e escurecido
   vira ocre, que já não é a cor da marca. Ele é fundo, com preto por cima, onde
   entrega 16:1.

**Uma correção sobre o vermelho.** O PRD calculou `#E6242A` como a mínima sobre
branco, e ela está certa para esse par. No produto o vermelho é o erro, e o erro
aparece sobre o **próprio** fundo rosado da tarja, não sobre branco — ali
`#E6242A` cai para 4,08 e reprova. Por isso `--erro` é `#D11F25`, um degrau
abaixo: 4,82 sobre a tarja e 5,34 sobre o cartão.

## O fundo do tema escuro tem teto

Medido, com o rosa por cima:

| fundo     | rosa `#ED145B` em cima |
| --------- | ---------------------- |
| `#000000` | 4,85 passa             |
| `#0A0A0B` | 4,57 passa             |
| `#111113` | 4,36 falha             |
| `#121214` | 4,32 falha             |

**Grafite não serve.** É por isso que, no tema escuro, o cartão quase não se
levanta da página: a separação vem da borda, e não de um degrau de cinza que
custaria a legibilidade do rosa em cima dele.

## Onde a paleta vive

Em `app/globals.css`, e em nenhum outro lugar — nenhum módulo escreve cor à mão.
`tests/contraste.test.ts` lê aqueles tokens e confere **os dois temas**, par a
par: 31 pares de texto a 4,5:1, dois de texto grande e onze gráficos a 3:1.
Tabela escrita envelhece no primeiro ajuste de tom; o teste, não.
