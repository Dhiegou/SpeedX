# T06 — UI pública de cadastro

**Contexto SDD:** BC-01
**Depende de:** T03, T05
**Bloqueia:** T07
**Requisitos:** RF-02 a RF-10, RNF-15, RNF-17, RNF-18

---

## Objetivo

Entregar o formulário que a persona P1 preenche em menos de dois minutos, de celular, em rede congestionada, sem ajuda. É a única superfície do sistema que 2000 pessoas vão tocar.

## Escopo

### 1. Rota `/inscricao`

> **Entregue em `/`, não em `/inscricao`.** T07 resolveu a favor de zero redirecionamento: a raiz serve o formulário direto, porque cada salto extra a partir do QR code custa uma resolução de nome e um handshake.

- Renderização no servidor, carga inicial mínima. Sem biblioteca de gráfico, sem fonte externa pesada, sem imagem decorativa grande (RNF-04).
- Layout de coluna única, alvos de toque ≥ 44px, sem rolagem horizontal em 360px (RNF-18).

### 2. Campos (RF-02)

`nome` · `sobrenome` · `e-mail` · `telefone` · `idade` · `pitch`

- Tipos de teclado corretos no mobile: `inputMode="numeric"` para idade, `type="tel"` para telefone, `type="email"` para e-mail. Isso é o que compra segundos em RNF-15.
- `autocomplete` apropriado em todos os campos (`given-name`, `family-name`, `email`, `tel`).
- Máscara de telefone leve, mas o valor enviado é normalizado para dígitos.

### 3. Seleção de Pitch (RF-03)

- Dois controles de múltipla escolha (Pitch 1 / Pitch 2), ambos selecionáveis.
- Envio sem nenhuma seleção é bloqueado com mensagem específica.
- Texto curto explicando que é possível correr as duas.

### 4. Bloco condicional de responsável (RF-05, RF-06, RF-07)

- Aparece quando `idade` está entre 13 e 17; some quando ≥ 18.
- Campos: nome, sobrenome e telefone do responsável + caixa de consentimento do responsável, com o texto de T03.
- Ao subir a idade para ≥ 18, os campos são **limpos do estado do formulário**, não apenas escondidos — o envio não deve carregar resíduo (RF-07 é garantido também no servidor por T04, mas a UI não deve enviar lixo).
- Idade < 13: mensagem explicativa clara de que a idade mínima é 13 (RF-04), sem descartar o resto do preenchimento.

### 5. Consentimento (RF-08, RF-09)

- Caixa de aceite obrigatória, desmarcada por padrão, com resumo de uma linha e link para `/termo` (abre sem perder o preenchimento).
- **Caixa opcional de repasse do telefone** (D-23), desmarcada por padrão e visualmente distinta: o envio conclui com ela desmarcada. Renderizar as caixas a partir de `TERMO_VIGENTE.aceites`, usando `obrigatorio` e `aplicaSe` — não escrever `required` à mão, que é exatamente como um opcional vira bloqueante.
- Destaque visual para a frase sobre exposição pública de nome + inicial do sobrenome.

### 6. Validação e erros (RNF-17)

- Validação no cliente com o **mesmo esquema Zod** de T04 (importado, não reescrito).
- Erro exibido junto ao campo, com foco movido para o primeiro campo inválido.
- Erros de servidor (422) são mapeados de volta para os campos correspondentes.
- Estado de envio: botão desabilitado durante o envio, indicador visível, tratamento de falha de rede com opção de tentar novamente **reusando a mesma chave de idempotência** (T05).

### 7. Confirmação (RF-10)

Tela de sucesso exibindo o nome registrado e os Pitches escolhidos, mais um link para a Classificação pública.

### 8. Instrumentação (métricas do PRD §7)

Marcar início (carga do formulário) e conclusão (sucesso) para medir taxa de conclusão e tempo mediano. Evento anônimo, sem dado pessoal.

## Critérios de aceitação

- [x] Os seis campos existem e são obrigatórios (RF-02). — com o teclado certo em cada um: `type="tel"`, `inputMode="numeric"`, `type="email"`, e `autocomplete` que deixa o preenchimento automático do celular funcionar.
- [x] Idades 13 e 17 exibem o bloco de responsável; 18 e 19 não exibem (RF-05). — um teste por idade de fronteira.
- [x] Preencher como menor, alterar idade para 18 e enviar resulta em registro sem dado de responsável (RF-07). — o teste inspeciona o **corpo enviado**, não a tela: esconder o bloco e continuar mandando os campos passaria numa verificação visual.
- [x] Envio sem aceite do termo é bloqueado com mensagem (RF-08).
- [x] Envio com a caixa de repasse desmarcada **conclui normalmente** (D-23). — e um teste separado confirma que a caixa obrigatória tem `required` e a opcional não, os dois vindos de `TERMO_VIGENTE.aceites`.
- [x] Envio sem Pitch é bloqueado; com um e com dois é aceito (RF-03).
- [x] Cada regra de validação produz mensagem própria, nomeando o campo (RNF-17). — mensagem no resumo do topo **e** junto do campo, com o foco indo para o primeiro inválido. O 422 do servidor é mapeado de volta para o campo pelo mesmo caminho.
- [x] Em viewport de 360px não há rolagem horizontal (RNF-18). — verificado por leitura do CSS, que é o método que a restrição 1 do anexo do PRD manda usar. Coluna única, `max-width: 32rem`, nada com largura fixa, `overflow-wrap: anywhere` contra palavra longa, e os dois cartões de Pitch somam 288px na base de 8rem. Alvos de toque: 48px nos campos, 52px no botão, 56px nos cartões, 24px nas caixas.
- [ ] **Teste cronometrado com 5 adultos ≤ 2 min e 5 fluxos de menor ≤ 3 min (RNF-15).** Depende de pessoas, não de código. Fica para a rodada de ensaio antes do evento, junto com o teste dos três leitores de QR de T07.
- [x] Falha de rede seguida de nova tentativa não gera cadastro duplicado. — a chave de idempotência é preservada na falha de rede e descartada quando a pessoa edita um campo; dois testes, um para cada metade da regra.

## Resultado da execução — 2026-08-20

**25 testes novos, 279 no total.** `npm run check`, `npm test` e o build passam.

| Arquivo | Papel |
|---|---|
| `app/page.tsx` | Server Component: emite o token, resolve o termo, conta a abertura |
| `app/_componentes/FormularioInscricao.tsx` | O formulário |
| `app/_componentes/formulario.module.css` | Estilo; nenhuma fonte externa, nenhuma imagem |
| `src/shared/vocabulario.ts` | A palavra "Pitch" num lugar só — ver abaixo |
| `src/contexts/inscricao/idades.ts` | As três idades, sem dependência, para a interface ler sem carregar o Zod |

Ferramentas novas de teste: `@testing-library/react`, `@testing-library/user-event` e `happy-dom`. Metade dos critérios desta tarefa é comportamento de tela — o bloco que aparece com a idade, a caixa que não bloqueia — e não existe como verificar isso sem renderizar.

### Quatro decisões

1. **A PE-01 deixou de bloquear.** O organizador ainda não confirmou se é Pitch ou Pista, então a palavra saiu da copy e virou `src/shared/vocabulario.ts`, com gênero e artigo junto — "o Pitch" e "a Pista" concordam diferente, e uma constante só com o substantivo espalharia "escolha o Pista" por três telas. Trocar custa uma linha. Ver D-31.

2. **O Zod não entra no pacote inicial** (D-32). A task pede validação no cliente com o esquema de T04, e cumprir isso literalmente colocava 286 KB no caminho crítico da única página que 2000 pessoas abrem em rede móvel ruim. O esquema é carregado logo depois da montagem, em paralelo com a pessoa digitando, e aguardado só no envio. Verificado no build: o pedaço com o Zod não aparece no HTML da raiz.

3. **A raiz virou dinâmica.** O token de T05 carrega o instante da carga; prerenderizado, todo participante receberia o mesmo token, emitido no dia do deploy. `connection()` resolve. O custo é uma renderização por acesso — sem consulta ao banco.

4. **A métrica do PRD §7 saiu do navegador** (D-33). A task pedia eventos de início e conclusão emitidos pela interface. O servidor já sabe as duas coisas: a abertura do formulário é uma renderização, e o tempo de preenchimento está assinado dentro do token. Nenhum evento de telemetria sai do navegador, e a métrica funciona mesmo para quem bloqueia rastreamento.

### Um risco anotado

O peso do JavaScript inicial é de ~570 KB não comprimidos, quase tudo React e Next. Não foi T06 que trouxe — é o piso da stack escolhida em T01 — mas é o número que T18 precisa medir contra RNF-04 em rede real. Se não couber, a saída é o formulário funcionar sem JavaScript (`<form action>` com Server Action), o que exigiria repensar a idempotência do lado do cliente.

## Estado

**Concluída em 2026-08-20**, com um critério aberto: o ensaio cronometrado com pessoas (RNF-15).

**Para T07:** a raiz já serve o formulário sem redirecionamento. Falta gerar o QR code apontando para `APP_URL`, testar com três leitores e definir os cabeçalhos de cache — lembrando que a raiz agora é dinâmica e o HTML não pode ser cacheado na borda.
