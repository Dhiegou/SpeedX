# Sinalização impressa do ponto de inscrição

Especificação do material que vai para a gráfica (T07, RF-01, RNF-04).

O QR code é a porta do sistema. Tudo o que o software fez para carregar rápido
se perde se a pessoa precisar de três tentativas para escanear — e a fila que se
forma no ponto do QR é um dos contraindicadores do PRD §7.

---

## 1. Endereço

|                      |                                              |
| -------------------- | -------------------------------------------- |
| **URL de destino**   | `https://speedx.exemplo.br` — **provisório** |
| **Arquivo do QR**    | [`qr/inscricao.svg`](qr/inscricao.svg)       |
| **Correção de erro** | Nível H (recupera cerca de 30% do símbolo)   |
| **Módulos**          | 33 × 33, mais 4 de área de silêncio por lado |

> **O endereço acima é um espaço reservado.** O domínio depende da escolha de
> hospedagem (PE-05). Assim que existir, rode `npm run qr` com a `APP_URL`
> definitiva: o arquivo é regravado e o destino fica escrito dentro do próprio
> SVG, em `<title>`. Conferir o cartaz depois de impresso é abrir o arquivo, não
> escanear.

A URL não leva parâmetro nenhum — sem `utm_`, sem código de origem. Não é
purismo: cada caractere a mais empurra o símbolo para uma versão com mais
módulos, e mais módulos no mesmo papel significa módulos menores e leitura mais
difícil.

---

## 2. Tamanho mínimo de impressão

Um QR é legível até cerca de **dez vezes a largura do símbolo**. A distância de
leitura de cada peça define, portanto, o tamanho mínimo dela.

| Distância de leitura | Peça                                | Lado mínimo do símbolo | Tamanho do módulo |
| -------------------- | ----------------------------------- | ---------------------- | ----------------- |
| 30 cm                | cartão de mesa, na mão              | 30 mm                  | 0,73 mm           |
| **50 cm**            | **cartaz A4 no ponto de inscrição** | **50 mm**              | **1,22 mm**       |
| 100 cm               | cartaz A3 em pé                     | 100 mm                 | 2,44 mm           |
| 200 cm               | banner na grade                     | 200 mm                 | 4,88 mm           |

O "lado do símbolo" **já inclui** a área de silêncio. Descontá-la é o erro mais
comum: quem divide a largura só pelos módulos de dado imprime um QR menor do que
a conta sugere.

Os números saem de `npm run qr` e são recalculados a partir do arquivo gerado —
se a URL definitiva for mais longa e o símbolo crescer, a tabela muda junto.

**Regra de bolso para conferir a prova de impressão:** meça o lado do quadrado
preto com uma régua. Se der menos do que a linha da tabela, não imprima.

---

## 3. Regras de impressão

- **Área de silêncio de 4 módulos** em branco, em volta do símbolo inteiro. Nada
  encosta: nem borda de papel, nem texto, nem moldura. É a parte que a
  diagramação mais come.
- **Preto sobre branco**, sem inversão. QR claro sobre fundo escuro falha em
  parte dos leitores.
- **Nada por cima.** Sem logotipo no meio, sem módulos arredondados, sem
  gradiente. A correção nível H aguentaria um logotipo pequeno — e o motivo de
  ter escolhido nível H não foi abrir espaço para enfeite, foi sobreviver a
  dobra, sol, chuva e dedo.
- **Papel fosco.** Papel brilhante e laminação reflexiva criam brilho sob o sol,
  e o brilho apaga módulos para a câmera.
- **Altura de fixação:** entre 1,2 m e 1,5 m do chão, na altura em que a pessoa
  segura o celular sem se abaixar nem esticar o braço.
- **Vetor até o fim.** O arquivo é SVG; não converta para PNG numa resolução
  escolhida hoje. Serrilhado em QR é falha de leitura.

---

## 4. O que vai escrito ao lado do QR

Nem todo mundo consegue escanear — câmera velha, lente riscada, aparelho sem
espaço para abrir a câmera, ou simplesmente não saber que a câmera lê QR. A
alternativa precisa estar na mesma peça, não numa segunda placa.

```
        INSCRIÇÃO NA CORRIDA

        [ QR CODE ]

        Aponte a câmera do celular.

        Ou digite no navegador:
        speedx.exemplo.br

        Sem celular? Fale com a organização
        aqui no ponto de inscrição.
```

- A URL por extenso em **corpo grande**, legível à mesma distância do QR, sem
  `https://` e sem `www` — a pessoa vai digitar, e cada caractere é um erro
  possível.
- A terceira linha existe por causa de T20: quem não tem celular, ou está com a
  rede fora do ar, se inscreve em papel. A ficha impressa carrega o mesmo termo
  de consentimento (D-09), e sem ela não há base legal para o cadastro de menor.

---

## 5. Verificação antes de mandar imprimir

- [ ] `npm run qr` rodado com a `APP_URL` **definitiva**, sem aviso de endereço
      provisório.
- [ ] `<title>` dentro do SVG mostra o endereço certo.
- [ ] Prova impressa medida com régua, contra a tabela da seção 2.
- [ ] Leitura testada com **três leitores distintos**: câmera nativa do iOS,
      câmera nativa do Android e um leitor de terceiros — cada um a partir da
      distância real da peça, com a peça na posição em que vai ficar.
- [ ] Leitura testada **sob sol direto** e sob luz artificial.
- [ ] A URL digitada à mão abre o formulário, sem redirecionamento.

Os quatro últimos itens dependem de aparelho e de material impresso; entram na
rodada de ensaio pré-evento, junto com o teste cronometrado de preenchimento
(RNF-15) e o checklist de T21.
