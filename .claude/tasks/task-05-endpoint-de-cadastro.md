# T05 — Endpoint de cadastro (idempotência, limite de taxa, anti-automação)

**Contexto SDD:** BC-01 · fluxo FL-03
**Depende de:** T04
**Bloqueia:** T06
**Requisitos:** RF-01, RNF-12, RNF-13, RNF-17

> `RF-13` constava aqui por engano — é o seletor de Pitch do painel (T10/T11). A matriz do [README](README.md) já listava RNF-12, RNF-13 e RNF-17 para esta tarefa; o cabeçalho passou a concordar com ela.

---

## Objetivo

Expor `registrarInscricao` pela rede com as garantias que o transporte confiável **não** oferece. O SDD é explícito: TCP garante entrega, não unicidade de efeito — a chave de idempotência é obrigatória na camada de aplicação.

## Escopo

### 1. Endpoint `POST /api/inscricao` (ou Server Action equivalente)

- Aceita apenas `Content-Type` esperado; rejeita o resto com 415.
- Executa **inteiramente no servidor**. Nenhuma credencial de banco alcança o cliente (restrição 3).
- Revalida toda a entrada com o esquema de T04, independentemente do que a interface tenha validado (RNF-13).

### 2. Idempotência (SDD §4.3, FL-03)

- O cliente gera uma chave (UUID v4) uma vez por tentativa de envio e a repete em reenvios do mesmo formulário.
- O servidor consulta `chave_idempotencia`; se existir, devolve a resposta armazenada sem executar de novo.
- Gravação da chave e do efeito ocorre na **mesma transação** do cadastro.
- Escopo da chave: `inscricao`.

### 3. Limite de taxa e anti-automação (RNF-12)

Três camadas, em ordem crescente de fricção:

1. **Campo honeypot** invisível: preenchido ⇒ resposta 2xx falsa, sem gravação.
2. **Limite por IP**: janela deslizante, ex. 5 cadastros por IP a cada 10 minutos e 30 por hora. Ajustar considerando NAT do local do evento — famílias inteiras podem sair do mesmo IP. Retornar 429 com mensagem legível.
3. **Tempo mínimo de preenchimento**: envio em menos de ~3 segundos após o carregamento é tratado como automatizado.

> Decisão: começar sem CAPTCHA. Adicionar desafio (ex.: Turnstile) apenas se o teste pré-evento indicar necessidade — CAPTCHA custa segundos no fluxo e conflita com RNF-15 e com a métrica de conclusão ≥ 95%.

### 4. Respostas

| Situação | Status | Corpo |
|---|---|---|
| Sucesso | 201 | `{ nome, pitches }` para a tela de confirmação (RF-10) |
| Validação | 422 | lista de `{ campo, codigo, mensagem }` (RNF-17) |
| Limite excedido | 429 | mensagem legível + `Retry-After` |
| Reenvio idempotente | 200 | resposta original armazenada |

### 5. Registro

Registrar em log de aplicação: instante, resultado, motivo de rejeição. **Nunca** registrar e-mail, telefone ou dado de responsável em log (RNF-08 por extensão).

## Critérios de aceitação

- [x] Requisição forjada fora do navegador com idade 12, sem consentimento, ou com bloco de responsável incompleto é rejeitada (RNF-13). — um teste por caso, e todos conferem que nada foi gravado. A validação roda **duas vezes**: aqui, para responder 422 sem abrir transação, e de novo dentro de `registrarInscricao` (D-25).
- [x] O mesmo envio repetido com a mesma chave de idempotência produz **um** participante e devolve a mesma resposta (FL-03). — inclui o reenvio depois de recarregar a página, que traz token novo e continua sendo reenvio.
- [x] O mesmo envio com chave diferente produz dois participantes.
- [x] Exceder o limite por IP retorna 429 e não grava (RNF-12). — com `Retry-After` calculado pela marca mais antiga que ainda ocupa a janela, e não por um valor fixo.
- [x] Preenchimento do honeypot não gera registro. — e a resposta é 201, indistinguível de sucesso.
- [x] Nenhum log contém e-mail ou telefone. — verificado por **teste**, e não por inspeção: a suíte captura tudo o que a rota escreve em stdout, em quatro desfechos diferentes, e falha se achar o e-mail ou o telefone da massa de teste.

## Resultado da execução — 2026-08-20

**57 testes novos, 254 no total.** `npm run check`, `npm test` e o build de produção passam.

| Arquivo | Papel |
|---|---|
| `app/api/inscricao/route.ts` | Só tradução: lê a requisição, chama o caso de uso, mapeia situação para status |
| `src/contexts/inscricao/submeterInscricao.ts` | Toda a regra de borda: honeypot, idempotência, token, validação, limite, transação |
| `src/contexts/inscricao/servico.ts` | Composição: liga o caso de uso à conexão real |
| `src/contexts/inscricao/limiteDeTaxa.ts` | Janela deslizante em duas faixas, sobre a tabela `limite_taxa` |
| `src/contexts/inscricao/tokenFormulario.ts` | Carimbo de hora assinado, emitido na renderização do formulário |
| `src/shared/log.ts` | Registro estruturado, com forma fechada e saneamento de texto livre |
| `src/shared/requisicao.ts` | Leitura de `Content-Type` e do endereço de origem |
| `src/db/migrations/0002_limite_de_taxa.sql` | Tabela nova |

### Cinco decisões que a tarefa não previa

1. **A rota não pode importar `@/db`** — o lint de T01 proíbe, e a proibição é o que sustenta a restrição 3 do anexo do PRD. A nota deixada pela T04 (`o endpoint chama registrarInscricao(db(), ...)`) não passaria no lint. Entrou `servico.ts`: um arquivo nomeado, dentro do contexto, cuja única responsabilidade é escolher o banco.

2. **A chave de idempotência é comparada com a digestão do envio** (D-28). Sem isso, duas pessoas que por acidente compartilhassem a chave fariam a segunda receber a confirmação **com o nome da primeira**. Não é defeito de idempotência, é vazamento (RNF-08).

3. **O tempo mínimo de preenchimento virou token assinado pelo servidor** (D-29), em vez do campo "quantos segundos levei" que a tarefa sugeria. Perguntar ao suspeito se ele é culpado não funciona: qualquer script escreve `4000` no campo.

4. **O limite conta cadastro concluído, não requisição** (D-27). Contar tentativa recusada transforma quem digitou o telefone errado quatro vezes em suspeito.

5. **O termo em rascunho responde 503, não 500** — o sistema está íntegro; a base legal é que não está. `termoEstaAprovado()` é consultado antes, para que o guard de D-25 nunca precise virar exceção não tratada em produção.

### Um risco que continua aberto

**O limite por IP pode recusar participante legítimo em massa.** Em rede móvel a operadora coloca milhares de assinantes atrás do mesmo endereço, e no local do evento dezenas de celulares saem do mesmo NAT. Os padrões foram afrouxados (30 por 10 minutos, 100 por hora) e existe `RATE_LIMIT_ATIVO=false` como desligamento de emergência, com teste próprio — mas nenhum número escolhido no escritório substitui a medição de T18. Ver D-27.

## Estado

**Concluída em 2026-08-20.** `POST /api/inscricao` responde 201/200/400/409/413/415/422/429/503, sempre com `Cache-Control: no-store`.

**Para T06,** o formulário precisa de quatro coisas além dos campos:

1. **Renderizar o token**: chamar `emitirTokenFormulario()` no servidor e mandá-lo de volta no campo `token`. Sem ele o envio é recusado como automação.
2. **Renderizar o honeypot**: campo `empresa`, escondido de gente e visível para robô — `aria-hidden`, `tabindex="-1"`, `autocomplete="off"`, fora da tela por CSS, **nunca** `type="hidden"`, que os robôs conhecem.
3. **Gerar a chave de idempotência** uma vez por tentativa de envio (`crypto.randomUUID()`) e **repeti-la** nos reenvios; muda só quando o participante altera o que preencheu. Vai no cabeçalho `Idempotency-Key`.
4. **Tratar os códigos de erro**: `formulario_expirado` pede recarga da página; `envio_rapido_demais` e `limite_excedido` pedem espera, com o valor de `Retry-After`; o 422 traz a lista de `{ campo, codigo, mensagem }` de RNF-17.

**Para T19/T21:** o limite de taxa só existe se a borda da hospedagem **sobrescrever** `X-Forwarded-For`. Se ela apenas acrescentar, o primeiro elemento é o que o cliente mandar. Sem endereço de origem, o cadastro passa sem limite algum — de propósito, porque um balde único para "origem desconhecida" travaria o evento inteiro. T21 precisa conferir o valor que chega, inão supor.
