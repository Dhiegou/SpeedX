# Plano de resposta — 24 de outubro de 2026

Uma página. **Para imprimir e levar**, porque o dia em que ela é necessária pode
ser o dia em que a rede do local não abre um site (T19 §7, RNF-05).

Contingência em papel do cadastro é outro documento — é T20, e vale quando o
problema é a internet, não o sistema.

---

## Quem é acionado

| papel                 | quem    | telefone | decide                                    |
| --------------------- | ------- | -------- | ----------------------------------------- |
| Responsável técnico   | _______ | _______  | reverter, desligar limite, mexer no banco |
| Suplente técnico      | _______ | _______  | o mesmo, quando o primeiro não atende     |
| Organizador do evento | _______ | _______  | parar a fila, anunciar, adiar             |
| Operador Cockpit 1    | _______ | _______  | —                                         |
| Operador Cockpit 2    | _______ | _______  | —                                         |

**Preencher antes do dia.** Uma linha em branco aqui é uma ligação que não
acontece.

**Regra de acionamento:** quem percebe avisa o responsável técnico direto, sem
passar por grupo de mensagens. Grupo é para registrar depois, não para pedir
socorro.

---

## As quatro coisas que se faz

### 1. Ver o que está acontecendo (30 segundos)

```
https://<dominio>/api/saude        de qualquer celular, sem senha
https://<dominio>/api/metricas     com sessão de Operador aberta
```

`saude` responde se o processo e o banco estão de pé, e **qual versão está no
ar** — o campo `versao` é o commit publicado. `metricas` responde se o evento
está indo bem: inscritos na última hora, pendências por Cockpit, ritmo de
lançamento.

O painel da Vercel mostra o log ao vivo em **Deployments → o deploy atual →
Logs**. Uma linha JSON por operação; o campo `evento` diz qual.

### 2. Reverter (2 minutos)

Painel da Vercel → **Deployments** → o deploy anterior que estava bom →
**Promote to Production**.

**Reverter é a primeira resposta, não a última.** Publicar código novo no dia do
evento é a resposta que não temos: não há tempo de teste e não há segunda
chance. Se o problema apareceu depois de uma publicação, volte a anterior e
investigue com o site no ar.

### 3. Destravar a inscrição sem publicar código

Se o limite de cadastro começar a recusar gente de verdade — dezenas de
celulares saem do mesmo IP por NAT, e a operadora móvel piora isso:

Painel da Vercel → **Settings → Environment Variables** →
`RATE_LIMIT_ATIVO = false` → **Redeploy** da publicação atual.

É reversível, não passa por código novo e não derruba a proteção do login: o
limite de tentativas de senha do painel é outro, e este botão não o alcança.

### 4. Forçar a Classificação a atualizar

A borda guarda a tabela por 15 segundos. Se alguém lançou um tempo e a tela
pública insiste em não mostrar, **espere quinze segundos antes de fazer
qualquer coisa** — é o comportamento normal, escrito em RNF-03.

Se passar disso, o problema não é o cache. Confira `/api/saude` e o log.

---

## Sintoma → primeira coisa a fazer

| o que se vê                              | o que fazer                                                           |
| ---------------------------------------- | --------------------------------------------------------------------- |
| site fora do ar                          | `/api/saude` de outro celular; se cair, reverter (2)                  |
| `/api/saude` responde 503                | é o banco: painel do Neon, ver se a instância está de pé              |
| participantes não conseguem se cadastrar | ver o log; se for `limite_excedido`, desligar o limite (3)            |
| painel lento com a fila cheia            | conferir latência do banco em `/api/saude`; não republicar            |
| classificação parada há mais de 1 min    | `/api/classificacao` direto no navegador — se responde, é a tela      |
| Operador não consegue entrar             | sessão expirada, ou limite de login por senha errada — esperar 15 min |
| tudo de pé e a fila parada               | não é o sistema. Falar com o organizador                              |

---

## Duas coisas que **não** se faz

1. **Não publicar código novo.** Congelamento de deploy vale das 00h às 23h59 do
   dia 24, exceto correção crítica com duas pessoas de acordo (T19 §6).
2. **Não apagar nem editar dado no banco à mão.** Toda correção de tempo tem
   caminho pelo painel, e ele grava trilha de auditoria (RF-23). Um `UPDATE`
   direto some da trilha, e é a trilha que responde a uma contestação de pódio.

---

## Depois do evento

- Guardar o log do dia antes que a plataforma o descarte — é o que responde a
  qualquer pergunta feita depois (`npm run metricas -- --arquivo evento.log`).
- **4 de novembro de 2026:** expurgo e desligamento do site, conforme
  [`retencao.md`](retencao.md) e [`deploy.md`](deploy.md) §6.
