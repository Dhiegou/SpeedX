# Monitoramento do dia do evento

O que observar, com que frequência, e quem é acordado quando (T16, RNF-05, PRD §7).

**O evento dura um dia e não tem segunda chance.** Descobrir um problema pelo
relato de um participante é tarde demais — é essa frase do PRD que justifica
tudo o que está aqui.

---

## 1. A regra que vale acima das outras

A coleta **jamais adiciona latência ao caminho da requisição nem falha junto com
ele** (SDD FL-12). Perder amostra de métrica é aceitável; perder o serviço por
causa do instrumento, não.

Neste sistema isso é verdade por construção, e não por disciplina: **não existe
coletor**. O transporte da telemetria é a saída padrão, uma linha JSON por
operação, escrita dentro de um `try` que engole a própria falha
(`src/shared/log.ts`). Não há URL para configurar, não há fila para encher e não
há serviço externo cuja queda derrube um cadastro.

A variável `TELEMETRY_URL`, declarada em T01 e nunca usada, foi removida em T16
(D-66). Uma configuração que promete um caminho inexistente é pior que nenhuma.

---

## 2. As três superfícies, e o que cada uma responde

|                     | pergunta                   | quem olha       | frequência         |
| ------------------- | -------------------------- | --------------- | ------------------ |
| `GET /api/saude`    | o processo está de pé?     | monitor externo | 60 s               |
| `GET /api/metricas` | o evento está indo bem?    | o time, no dia  | sob demanda        |
| `npm run metricas`  | o que aconteceu na janela? | quem investiga  | por hora, e depois |

As três são necessárias e nenhuma substitui outra. `/api/saude` cai junto com a
aplicação, e é justamente esse silêncio que o monitor externo interpreta.
`/api/metricas` só existe enquanto há banco. O relatório do log responde
depois, inclusive sobre um período em que ninguém estava olhando.

### `GET /api/saude`

Público — um monitor não sabe autenticar-se. Devolve:

```json
{
  "situacao": "ok",
  "versao": "abc1234",
  "instante": "...",
  "banco": { "alcancavel": true, "latenciaMs": 3 }
}
```

- **200** quando o banco responde; **503** quando não. A má notícia vai no
  código de status, nunca escondida num campo do corpo: monitor de provedor
  decide por status, e um 200 com `ok: false` é uma indisponibilidade que
  ninguém é avisado.
- **Não conta por quê.** Host, porta, usuário e mensagem do driver ficam no log.
- **Medido:** 13 a 33 ms em regime. A primeira chamada depois de subir o
  processo chega a ~190 ms, porque inclui abrir a primeira conexão do pool — é
  por isso que o teto da sondagem é de 1 s e não de 200 ms (ver `infra/saude.ts`).

### `GET /api/metricas`

Exige sessão de Operador. Devolve contagens: inscritos no total e na última
hora, inscritos por hora no fuso do evento, situação de cada Cockpit, ritmo de
Lançamentos, taxa de correção e **pendências**.

Só responde "quantos", nunca "quem". Para saber quem falta existe o relatório de
pendências de T14 — que é uma exportação, e baixá-la é uma decisão consciente de
mexer com dado pessoal.

**Medido:** seis agregações em 190 ms contra a base de 2000.

### `npm run metricas`

```
npm run metricas -- --arquivo evento.log --inscritos 2000
cat evento.log | npm run metricas
npm run metricas -- --arquivo evento.log --json
```

Lê o log estruturado e imprime as métricas técnicas, as de produto com a meta do
PRD ao lado, e os alertas de §6 que teriam disparado. **Sai com código 1 se
algum disparar** — o gancho mais portátil que existe para pendurar num
agendador: qualquer plataforma sabe notificar um comando que falhou.

Atravessa o ruído que a plataforma imprime no meio do log (banner, avisos de
compilação). Um analisador que quebra na primeira linha estranha é um analisador
que nunca roda contra o log de verdade.

---

## 3. Monitor externo — **UptimeRobot**, decidido em T19

**Não está implementado, e não pode estar.** Se a aplicação caiu, ela não
escreve log; a ausência de linha é indistinguível de um período tranquilo. Só
algo **de fora** distingue as duas coisas, e por isso este é o único item de T16
que depende de contratar um serviço.

**O serviço é o UptimeRobot, plano gratuito** (D-82). Falta configurá-lo, o que
depende do domínio (PE-05).

|               | pedido em T16                                | o que o plano gratuito dá       |
| ------------- | -------------------------------------------- | ------------------------------- |
| Alvos         | `/api/saude`, `/` e `/classificacao`         | os três, sem custo              |
| Intervalo     | 60 s                                         | **5 min** — ver abaixo          |
| Falha         | 2 verificações seguidas                      | 2 seguidas, configurável        |
| Canal         | **SMS, WhatsApp ou Telegram** — nunca e-mail | **push do aplicativo** + e-mail |
| Destinatários | pelo menos duas pessoas                      | ilimitado                       |

**Duas diferenças ficam registradas, e nenhuma das duas é silenciosa:**

1. **O intervalo é de 5 minutos, não 60 segundos.** Uma queda pode passar até
   cinco minutos sem alerta. Aceitável porque, na janela do evento, quem
   descobre uma queda antes disso é o Operador na frente da fila. O monitor
   existe para o resto do calendário: a madrugada anterior, o intervalo do
   almoço, a hora em que ninguém está olhando.
2. **O canal é push do aplicativo, e não SMS.** O requisito escrito em T16 não
   era "SMS"; era **vibrar no bolso de quem pode agir**, porque no dia ninguém
   abre caixa de entrada. O aplicativo do UptimeRobot instalado nos dois
   celulares atende a isso; o e-mail fica como segundo canal, não como o
   primeiro. **Testar o disparo antes do dia** — um alerta que ninguém viu
   chegar é um alerta que não existe (item do checklist de T21).

---

## 4. Alertas

Os quatro de T16 §6. Os três primeiros são avaliados por `npm run metricas` e
têm teste; o de indisponibilidade só o monitor externo pode dar.

| Alerta                  | Limiar                                        | Gravidade | Quem dá           |
| ----------------------- | --------------------------------------------- | --------- | ----------------- |
| `saude_indisponivel`    | qualquer sondagem sem alcançar o banco        | crítico   | log **e** monitor |
| `classificacao_lenta`   | p95 > 2 s por 2 minutos **seguidos** (RNF-01) | crítico   | log               |
| `erros_5xx`             | > 1% das respostas (RNF-05)                   | crítico   | log               |
| `cadastro_silencioso`   | 10 min sem cadastro concluído                 | atenção   | log               |
| indisponibilidade total | 2 verificações seguidas sem resposta          | crítico   | **só** o monitor  |

Dois detalhes que separam um alerta útil de um que se aprende a ignorar:

- **Minutos seguidos são seguidos no relógio.** Dois picos separados por um
  minuto bom são dois incidentes curtos, não um problema que persiste.
- **O silêncio de cadastro só conta entre o primeiro e o último do dia.** Antes
  do primeiro o evento não começou; depois do último, acabou. Alertar sobre
  qualquer um dos dois é acordar alguém para dizer que a noite está quieta.

---

## 5. Métricas do PRD §7 — origem de cada uma

| Métrica                                    | Meta     | Origem                                               | Situação               |
| ------------------------------------------ | -------- | ---------------------------------------------------- | ---------------------- |
| Taxa de conclusão do cadastro              | ≥ 95%    | `inscricao.cadastro` ÷ `inscricao.formulario_aberto` | ✅ log                 |
| Tempo mediano de cadastro                  | ≤ 90 s   | `preenchimentoMs` do token assinado                  | ✅ log                 |
| Lançamentos corrigidos                     | ≤ 1%     | `cronometragem.correcao` ÷ total                     | ✅ log e banco         |
| Tentativas não resolvidas                  | 0 ao fim | `tentativa.estado = 'pendente'`                      | ✅ `/api/metricas`     |
| Consultas à classificação por participante | ≥ 2      | `classificacao.leitura` ÷ inscritos                  | ✅ log + `--inscritos` |
| Rejeições no bloco de responsável          | ≤ 10%    | `campos` dos 422                                     | ✅ log                 |
| Uso da busca por nome                      | ≥ 30%    | —                                                    | ❌ **não mensurável**  |

O denominador da taxa de conclusão é servidor puro: `/` emite
`inscricao.formulario_aberto` ao renderizar. D-33 tirou essa métrica do cliente,
e é por isso que ela não depende de telemetria de navegador.

O tempo de preenchimento sai do token assinado na emissão da página, não de um
relógio que o cliente escolhe (D-29). E é **mediana**, não média: quem abriu o
formulário e voltou meia hora depois não desloca o número que a meta descreve.

### A métrica que não fecha, e por quê

**Uso da busca por nome.** A busca da Classificação roda inteira no navegador,
sobre o documento já carregado — os testes de T13 contam as chamadas a `fetch`
durante a busca e exigem **zero**. É isso que a torna instantânea e que a faz
não gastar rede em 3G. Pelo mesmo motivo, o servidor não a vê.

Medir exigiria telemetria de navegador: uma URL de coletor exposta na página
mais pública do evento, para responder uma métrica secundária. D-33 tirou a
telemetria do cliente do cadastro justamente para não ter isso.

O adendo de T13 a esta task sugeria derivar a métrica da razão entre 200 e 304
no log. Isso mede **revalidação**, que é outra coisa: diz quantas leituras
saíram sem corpo, não quantas pessoas digitaram um nome. Está no relatório, com
esse nome e essa ressalva — o que não se pode é chamá-lo de uso da busca.

**Encaminhado a T21** como risco aceito, para decisão explícita: ou a métrica
cai do PRD, ou alguém aceita a telemetria de navegador com os olhos abertos.

---

## 6. Checklist de prontidão

- [ ] `APP_VERSION` preenchida com o commit publicado (T19).
- [ ] Monitor externo contratado, com os três alvos e intervalo de 60 s.
- [ ] Canal de alerta testado com **disparo real**, não só configurado.
- [ ] Pelo menos duas pessoas recebendo, com telefone conferido.
- [ ] Indisponibilidade simulada detectada em ≤ 2 minutos.
- [ ] `npm run metricas` rodando por hora no dia, contra o log recolhido.
- [ ] Painel do provedor aberto, com taxa de acerto da borda à vista — é a única
      métrica de §3 que não chega ao servidor.
- [ ] Decisão registrada sobre a métrica de uso da busca (T21).
