# Retenção e exclusão de dados

Procedimento escrito da guarda e do descarte (T15, RNF-11, RF-09).

**Este arquivo é a contraparte operacional do termo de consentimento.** O termo
promete três coisas a quem se inscreve — um prazo, um canal de exclusão e o
desligamento do site. Promessa sem procedimento é promessa quebrada com atraso.
O que está aqui é quem faz, quando e como se confere que foi feito.

---

## 1. Em linguagem simples

Para o organizador ler antes de qualquer coisa, e para responder a quem
perguntar no dia.

**O que fica guardado.** Nome, sobrenome, e-mail, telefone e idade de quem se
inscreve. Se a pessoa tem menos de 18 anos, também nome, sobrenome e telefone de
um responsável. E o resultado da corrida: pista, tempo e horário do registro.
Não há documento, endereço, CPF nem dado de pagamento — o sistema nunca pediu.

**Por quanto tempo.** No máximo **10 dias depois da data do evento**. Passado
esse prazo, apaga-se tudo, mesmo que ninguém peça. Ficam só números que não
identificam ninguém: quantas pessoas correram, quantos tempos válidos, o melhor
tempo de cada pista.

**Como alguém pede para apagar antes disso.** Por e-mail para
`dhiegodev@hotmail.com`, a qualquer momento e sem precisar explicar o motivo.
Durante o evento, também pessoalmente no ponto de inscrição. O pedido é
atendido no mesmo dia em que chega.

**O site sai do ar no mesmo prazo.** A página pública de classificação deixa de
existir. Isso está escrito no termo e não é uma decisão de infraestrutura que se
possa adiar.

**Quem executa.** O responsável nomeado na seção 2. Ninguém mais tem como
executar: os comandos exigem a credencial do banco, que não é distribuída.

---

## 2. Quem faz e quando

| Campo                       | Valor                                                                      |
| --------------------------- | -------------------------------------------------------------------------- |
| Prazo de guarda             | **10 dias** após a data do evento (PE-02, decidido em 2026-08-19)          |
| Data-base                   | **24 de outubro de 2026** (`2026-10-24`) — PE-06, decidida em 2026-08-25   |
| Vencimento                  | **4 de novembro de 2026, 00:00** no fuso `America/Sao_Paulo`               |
| Responsável pela execução   | Dhiego (`dhiegodev@hotmail.com`)                                           |
| Canal de pedido de exclusão | `dhiegodev@hotmail.com`; durante o evento, também o ponto de inscrição     |
| Prazo de atendimento        | mesmo dia em que o pedido chega                                            |
| Forma de confirmação        | comprovante impresso pelo comando, com contagem zerada em todas as tabelas |

> **A data acima não é valor padrão de lugar nenhum.** O comando continua
> exigindo `--evento 2026-10-24` escrito à mão, mesmo agora que a data existe:
> quem apaga a base digita a data que está apagando. Este documento é onde se
> confere qual é ela, não de onde o programa a lê.

O prazo vence na **virada** do décimo dia, não em uma hora qualquer dele: evento
em 24/10 significa guarda até o fim de 03/11, e a partir de 04/11 às 00:00 em São
Paulo nada mais pode estar guardado.

---

## 3. Expurgo total, ao fim do prazo

A ordem importa. O passo 1 é irrecuperável depois do passo 3.

**1. Exportar a base.** Entrar no painel e baixar as três saídas de T14:

- `GET /api/exportacao?tipo=completa` — a base inteira, para prestação de contas;
- `GET /api/exportacao?tipo=repasse` — a lista autorizada, se ainda não foi enviada;
- `GET /api/exportacao?tipo=pendencias` — o relatório da métrica do PRD §7.

Guardar os arquivos fora do servidor, em lugar de acesso restrito. **Eles são a
base de 2000 pessoas em claro** — o `.gitignore` já barra `*.csv`, e isso
não substitui cuidado.

**2. Ensaiar.** Sem `--confirmar`, o comando conta e mostra, e não apaga nada:

```
npm run expurgar -- --evento AAAA-MM-DD
```

Conferir na saída: o prazo aparece como vencido, e o número de participantes é o
que se espera. Doze participantes onde deveriam estar duas mil significa que a
`DATABASE_URL` aponta para outro banco — pare aqui.

**3. Executar.**

```
npm run expurgar -- --evento AAAA-MM-DD --confirmar --responsavel "Nome de quem executa"
```

O comando pede a palavra `APAGAR` digitada por extenso. Sem terminal — num
pipe, num agendador — ele **cancela**, nunca prossegue.

**4. Guardar o comprovante.** A saída traz o instante, o responsável, quantas
linhas saíram de cada tabela e a conferência final, que precisa dar **zero em
todas**. Esse bloco é o registro da execução; salve-o junto dos arquivos do
passo 1.

**5. Tirar o site do ar.** O termo promete que a página de classificação deixa
de existir. Apagar o banco não faz isso sozinho: falta desligar a aplicação e o
domínio, o que é o mesmo procedimento de T19. Enquanto o site responder, a
promessa não está cumprida.

### O que sobrevive, e por quê

Só números. O comando imprime, antes de apagar, um resumo anônimo: quantos
participantes, quantos menores de idade, e por pista quantas tentativas, quantas
válidas, quantas ausentes, quantas pendentes, além do melhor tempo, da mediana e
do pior.

Nada disso volta para uma tabela. **A classificação com nome público não
sobrevive** — o termo autoriza guardar "apenas números que não identificam
ninguém", e nome identifica. Quem quiser o histórico com nomes precisa de um
termo diferente, aceito por quem se inscreveu, e não de uma exceção aqui.

A conta do Operador continua no banco: não é dado de participante, e é ela que
permite entrar no painel depois do expurgo para conferir que a base está vazia.

---

## 4. Exclusão individual, a pedido

Vale a qualquer momento, inclusive durante o evento, e não depende de o prazo ter
vencido.

**1. Achar de quem é o pedido.** O e-mail que chega pode não ser o mesmo da
inscrição, e uma família costuma compartilhar endereço:

```
npm run expurgar -- --email pessoa@exemplo.com
```

A busca não apaga nada. Devolve uma lista com identificador, nome e os quatro
últimos dígitos do telefone — o bastante para confirmar com a pessoa qual é ela,
sem apagar o irmão errado.

**2. Excluir.**

```
npm run expurgar -- --participante <uuid> --confirmar --responsavel "Nome"
```

Sai um comprovante. As tentativas da pessoa saem junto, e com elas a linha da
classificação pública — em menos de um minuto, que é o tempo dos caches de
leitura.

**3. Encaminhar, se o comprovante mandar.** Quando a pessoa tinha autorizado o
repasse do telefone, o comando avisa em letras maiúsculas. **O termo promete
encaminhar o pedido a quem recebeu a cópia** (a FIAP e a escolinha), e nós não
apagamos a cópia deles. Escrever no mesmo dia, e guardar a resposta junto do
comprovante.

Essa informação só existe **antes** da exclusão — depois não há mais linha de
consentimento para consultar. Por isso o comando lê antes de apagar, e por isso
o aviso não pode ser ignorado para resolver depois.

**Se o pedido chegar antes de a pessoa correr**, a exclusão encerra a
participação dela: sem os dados não há como identificar quem correu. O termo diz
isso, e quem atende o pedido deve repetir a frase à pessoa antes de executar.

**Se o identificador não existir mais**, o comando responde que não encontrou e
não apaga nada. Isso normalmente significa que o pedido já foi atendido — não é
erro.

---

## 5. Higiene contínua

Três tabelas guardam mecanismo, não domínio, e nenhuma precisa sobreviver ao
evento: chaves de idempotência, marcas de limite de taxa (que guardam o HMAC de
um endereço IP) e sessões de Operador.

**O sistema faz isso sozinho.** A varredura roda no máximo uma vez por hora, por
processo, disparada pela própria escrita que cria as linhas, e apaga o que passou
de 48 horas. Não é aguardada: se falhar, sai uma linha de log e a inscrição da
pessoa segue normalmente.

Sob demanda, quando o ambiente não colaborar:

```
npm run expurgar -- --higiene
```

Logs de aplicação são assunto à parte: eles não carregam dado pessoal por
construção (T05) e **sobrevivem ao expurgo de propósito** — é neles que fica o
registro de que o expurgo aconteceu. Um registro de auditoria que some junto com
o dado auditado não é auditoria.

---

## 6. Checklist da execução

Para marcar no dia, e anexar ao comprovante.

- [x] Data do evento definida e escrita na seção 2 (PE-06): **24/10/2026**.
- [ ] As três exportações de T14 baixadas e guardadas fora do servidor.
- [ ] Ensaio rodado; prazo vencido e contagem conferida.
- [ ] Expurgo executado, com responsável nomeado.
- [ ] Comprovante guardado, com zero em todas as tabelas.
- [ ] Site fora do ar: `/classificacao` não responde mais.
- [ ] Pedidos individuais recebidos durante o evento: todos com comprovante.
- [ ] Para cada pedido de quem autorizou o repasse: encaminhamento à FIAP e à
      escolinha enviado, e resposta guardada.
