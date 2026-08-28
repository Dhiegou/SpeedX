# Relatório de carga — medição de 2026-08-28

Números medidos, não impressões (T18, RNF-01 a RNF-04).

**Leia primeiro isto:** esta medição rodou **inteira numa máquina local**, com o
gerador de carga, a aplicação e o Postgres disputando os mesmos núcleos, e
**sem cache de borda no meio**. Não é o ambiente do evento e não substitui a
medição contra o alvo publicado — que depende do domínio (T19 §9).

O que ela vale, e não é pouco: **é o pior caso.** Em produção a borda absorve o
pico e o banco vê uma consulta a cada quinze segundos (T12). Aqui cada
requisição atravessou aplicação e banco. Se aguenta assim, com cache só melhora.

---

## Ambiente

|           |                                                                                     |
| --------- | ----------------------------------------------------------------------------------- |
| Aplicação | artefato de produção (`next build && next start`), Node 24, uma instância           |
| Banco     | PostgreSQL 18 local, `speedx_carga`, `DB_POOL_MAX=5`                                |
| Massa     | **2000 Participantes, 4000 Tentativas** (3227 válidas, 347 ausentes, 426 pendentes) |
| Gerador   | Artillery 2, na mesma máquina                                                       |
| Rede      | laço local — sem latência, sem perda, sem borda                                     |

Reproduzir:

```bash
npm run perf:preparar          # cria e popula speedx_carga
# suba a aplicação contra ele, então:
npm run test:carga             # leitura da Classificação
npm run test:carga:cadastro    # pico de cadastro
npm run perf:medir             # documento, consultas, índices, propagação
```

---

## 1. Leitura da Classificação (RNF-01) — **passou**

500 concorrentes por 5 minutos, modelados como 100 chegadas/s × ~5 s de vida.

|                  | medido                    | meta      |
| ---------------- | ------------------------- | --------- |
| Vazão sustentada | **200 req/s**             | —         |
| p95 em regime    | **7,9 ms**                | ≤ 2000 ms |
| p99 em regime    | **16 ms**                 | —         |
| Respostas 5xx    | **0** em 101.917 leituras | 0         |
| Códigos vistos   | apenas 200 e 304          | —         |

**A metade das requisições volta 304**, sem corpo: é o polling de T13 com
`If-None-Match` (FL-08), e é ele que torna sustentável 2000 aparelhos
atualizando a tabela.

### O que deu errado, e por que não é da aplicação

A primeira execução saturou aos ~200 req/s com **411 `ECONNREFUSED`**, e uma
execução posterior acumulou **1639 `ERR_SOCKET_TIMEOUT`** numa janela de três
minutos no meio do teste, com tempos de resposta subindo a 1,6 s.

**Nenhum desses erros é uma resposta do servidor.** Não houve um único 5xx no
log da aplicação; os códigos vistos foram 200 e 304. São falhas de transporte no
laço local: o gerador abrindo uma conexão por requisição esgota as portas
efêmeras do Windows. A correção foi `pool: 50` no gerador — reuso de conexão,
que é o que um navegador faz de qualquer jeito. Depois disso, regime estável.

**Fica registrado como limite da bancada:** com gerador e servidor na mesma
máquina, o teto medido é o da máquina. O número que decide RNF-01 sai do
ambiente publicado.

---

## 2. Tamanho do documento público — **melhor que a estimativa**

|                    | medido      | estimado                      |
| ------------------ | ----------- | ----------------------------- |
| 3227 linhas, bruto | **83,1 KB** | 106 KB (extrapolação de T12)  |
| 3227 linhas, gzip  | **14,0 KB** | ~40 KB (SDD §3) · 18 KB (T12) |

O formato compacto de T12 continua valendo. **Nenhuma mudança necessária.**

---

## 3. Escrita simultânea (RNF-16) — **passou**

Dois Operadores, um por Cockpit, lançando enquanto a carga de leitura rodava.

|                         | medido       | meta                              |
| ----------------------- | ------------ | --------------------------------- |
| Lançamentos aceitos     | **16** (201) | todos                             |
| Falhas                  | **0**        | 0                                 |
| p95 do painel sob carga | **172 ms**   | folgado dentro dos 15 s de RNF-16 |
| p99                     | 242 ms       | —                                 |

**Nenhuma escrita perdida e nenhum conflito não tratado.** Vale registrar o
caminho até aqui, porque as duas falhas iniciais foram do teste e ensinaram
sobre o sistema:

1. **33 respostas `401`.** O cookie de sessão nasce `__Host-` e `Secure` em
   produção, e um cliente correto não o devolve por HTTP. O gerador estava
   certo, o alvo local é HTTP, e o código está certo — quem estava errada era a
   bancada. Contra o ambiente publicado, em HTTPS, o desvio some.
2. **46 respostas `409 chave_em_conflito`.** O `$uuid` do Artillery é resolvido
   uma vez por usuário virtual, não por requisição: o teste reenviava a **mesma
   chave** com uma Tentativa **diferente** a cada volta. O servidor recusou,
   como FL-06 promete. A leitura preguiçosa seria "não aguenta escrita
   concorrente"; a leitura certa é que a idempotência fez exatamente o trabalho
   dela.

---

## 4. Pico de cadastro (RNF-12) — **o limite de taxa reprova, e era isto que o teste existia para descobrir**

200 cadastros legítimos partindo do **mesmo IP**, como acontece atrás de um NAT.

|                                        | medido      |
| -------------------------------------- | ----------- |
| Criados (201)                          | **30**      |
| Recusados por limite (429 `limite_ip`) | **170**     |
| Falhas de aplicação                    | 0           |
| Latência do cadastro                   | p95 27,9 ms |

**Trinta é exatamente `RATE_LIMIT_CADASTROS_POR_JANELA`.** O limite funcionou
como configurado — e é a configuração que está errada para o evento.

No local, dezenas de celulares saem do mesmo IP pelo Wi-Fi, e na rede móvel a
operadora coloca milhares de assinantes atrás de um endereço. **Com os padrões
atuais, o 31º participante de uma fila é recusado**, e ele não tem como saber
que o problema não é ele.

### Recomendação, com a conta

O evento tem 2000 participantes num dia. Supondo chegada concentrada em quatro
horas e três a cinco IPs de saída (Wi-Fi do local + operadoras), o pico
plausível é de **~150 cadastros por IP a cada 10 minutos**.

| variável                          | hoje | proposto | por quê                                             |
| --------------------------------- | ---- | -------- | --------------------------------------------------- |
| `RATE_LIMIT_CADASTROS_POR_JANELA` | 30   | **300**  | o dobro do pico plausível, para não recusar ninguém |
| `RATE_LIMIT_CADASTROS_POR_HORA`   | 100  | **1200** | acomoda a chegada em massa da abertura              |
| `RATE_LIMIT_JANELA_SEGUNDOS`      | 600  | 600      | sem mudança                                         |

Um limite de 300 por IP a cada 10 minutos ainda barra automação em escala — que
é o que RNF-12 pede — e deixa de barrar a fila. **A decisão é de T21**, como o
plano previa; o que T18 entrega é o número medido em vez do palpite.

---

## 5. Propagação do lançamento (RNF-03) — **passou**

|                                            | medido    | meta   |
| ------------------------------------------ | --------- | ------ |
| Do lançamento à linha na página, sem borda | **5,1 s** | —      |
| Somando `s-maxage=15` da borda             | **~20 s** | ≤ 30 s |

Os 5,1 s são o memo de 5 s da projeção (D-59) mais o intervalo de sondagem. Com
a borda no meio, o pior caso soma a janela de 15 s e continua dentro de RNF-03,
com 10 s de folga.

---

## 6. Consultas e índices — **D-56 se resolve: os três saem**

`EXPLAIN (ANALYZE, BUFFERS)` contra a massa de 4000:

| consulta                           | tempo        | plano                |
| ---------------------------------- | ------------ | -------------------- |
| projeção da Classificação (T12)    | **3,7 ms**   | varredura sequencial |
| fila do painel, um Cockpit (RF-14) | **0,068 ms** | `tentativa_fila_idx` |
| busca por trecho de nome (RF-16)   | **0,334 ms** | varredura sequencial |

E o que o Postgres diz sobre uso, em `pg_stat_user_indexes`, depois da carga:

| índice                        | varreduras | veredito                      |
| ----------------------------- | ---------- | ----------------------------- |
| `tentativa_fila_idx`          | usado      | **fica** — é a fila do painel |
| `participante_nome_idx`       | **0**      | sai                           |
| `participante_sobrenome_idx`  | **0**      | sai                           |
| `tentativa_classificacao_idx` | **0**      | sai                           |

**Os três criados por raciocínio em T02 nunca são escolhidos**, e agora há
medida em vez de suspeita (D-56). A projeção lê a tabela inteira — com 3227 de
4000 linhas qualificando, o planejador está certo em não usar índice: ele
pagaria a busca e leria o heap de qualquer forma. A busca por trecho confirma o
que `busca.ts` já argumentava: nesta escala o índice não compra nada.

**Ação:** uma migração que remove os três. Fica para uma tarefa própria, com o
número deste relatório como justificativa — cada índice removido é escrita mais
barata em cada cadastro do dia.

---

## 7. O que este relatório **não** mediu

| item                                          | por quê                                            |
| --------------------------------------------- | -------------------------------------------------- |
| **Taxa de acerto do cache de borda** (T18 §2) | não há borda local. Depende do domínio (T19 §9)    |
| **Carga em 3G lento** (T18 §5, RNF-04)        | precisa de limitação de rede real em aparelho; T21 |
| **HTTP/3 sob perda de pacote** (FL-02, FL-07) | idem — é a bancada do dia, não esta                |
| **30 minutos contínuos de escrita**           | medidos 5 min. O ensaio longo é o de T21           |
| **Restauração de backup sob carga**           | T19, e depende do banco provisionado               |

Nenhum deles é impedido por código. Todos dependem do ambiente publicado, e
todos estão no checklist de T21.
