# O que falta, e é com você

Tudo o que o repositório podia resolver sozinho está resolvido: 22 tarefas, 636
testes, auditoria de privacidade executada. **O que sobrou não se resolve
escrevendo código** — depende de decidir, contratar, imprimir e reunir gente.

Esta é a sua lista, em ordem de prazo. Cada item diz **quanto tempo leva**, **o
que acontece se ficar de fora** e, quando existe, **o comando exato**.

> A auditoria formal, com evidência item a item, está em
> [`checklist-pre-evento.md`](checklist-pre-evento.md). Este documento aqui é a
> versão prática: o que fazer, na ordem.

**Evento: 24/10/2026. Faltam 57 dias.**

---

## Agora — trava tudo o mais

### 1. Escolher e registrar o domínio · 1 hora + propagação

**É o item de maior prazo do projeto**, e não porque é difícil.

O QR code que vai no material impresso codifica a URL. Uma URL diferente muda o
número de módulos do QR, então **o material impresso não se corrige: se refaz**.
Enquanto o domínio não existir, tudo o que for para a gráfica é provisório.

Ele também segura quatro verificações que ninguém consegue fazer sem um endereço
publicado: HTTP/3 anunciado, cache de borda funcionando, relógio do servidor
conferido e o monitor externo apontado.

Depois de registrar:

```bash
# 1. aponte o domínio na Vercel, então:
APP_URL="https://seu-dominio.com.br" npm run qr    # regera docs/qr/inscricao.svg
npm run fichas                                      # regera o material de papel
```

**Se ficar de fora:** o evento roda numa URL `.vercel.app` longa, o QR fica pior
de escanear e a fila no ponto de inscrição cresce — que é um contraindicador
explícito do PRD.

### 2. Criar as três contas e publicar · 2 a 3 horas

| serviço         | plano          | para quê                                       |
| --------------- | -------------- | ---------------------------------------------- |
| **Vercel**      | Hobby (grátis) | a aplicação, região `gru1`                     |
| **Neon**        | grátis         | o Postgres, região `aws-sa-east-1` (São Paulo) |
| **UptimeRobot** | grátis         | avisar quando o site cair                      |

O passo a passo, com as variáveis de ambiente e as duas pegadinhas que custam
caro, está em [`deploy.md`](deploy.md). As duas pegadinhas, em resumo:

- **`DATABASE_URL` de produção é a string do _pooler_** do Neon (o host com
  `-pooler`). Sem isso o banco fica sem conexões no pico de cadastro.
- **`npm run db:migrate` quer a string direta**, sem `-pooler`. Uma migração
  pela string do pooler falha no meio, e o meio de uma migração é o pior lugar
  para falhar.

### 3. Decidir o limite de cadastros · 15 minutos

**Este é o item que mais provavelmente estragaria o seu evento**, e o teste de
carga já provou: 200 cadastros legítimos vindos do mesmo IP viraram **30
aceitos e 170 recusados**.

No local, dezenas de celulares saem do mesmo IP pelo Wi-Fi, e na rede móvel a
operadora coloca milhares de assinantes atrás de um endereço só. Com o valor
atual, o 31º da fila é recusado e não tem como saber que o problema não é ele.

Configure na Vercel, em _Settings → Environment Variables_:

| variável                          | hoje | ponha    |
| --------------------------------- | ---- | -------- |
| `RATE_LIMIT_CADASTROS_POR_JANELA` | 30   | **300**  |
| `RATE_LIMIT_CADASTROS_POR_HORA`   | 100  | **1200** |

A conta que chega nesses números está em [`relatorio-carga.md`](relatorio-carga.md) §4.

---

## Nas próximas semanas

### 4. Imprimir o material · meio dia, contando a gráfica

Rode `npm run fichas` **depois** de o domínio existir e leve para imprimir:

| peça                         | quantidade             | arquivo                             |
| ---------------------------- | ---------------------- | ----------------------------------- |
| Ficha de inscrição em papel  | 200                    | `contingencia/ficha-inscricao.html` |
| Termo de consentimento       | 5 cópias               | `contingencia/termo-impresso.html`  |
| Folha de tempos              | 5 por Cockpit          | `contingencia/planilha-tempos.html` |
| QR code                      | conforme a sinalização | `qr/inscricao.svg`                  |
| Plano do dia                 | 3 cópias               | `plano-do-dia.md`                   |
| Procedimento de contingência | 3 cópias               | `contingencia.md`                   |

Abra o HTML no navegador e use Ctrl+P, A4, **sem cabeçalho e rodapé do
navegador**. Os tamanhos mínimos do QR por distância de leitura estão em
[`sinalizacao.md`](sinalizacao.md).

**Se ficar de fora:** a internet cai e o cadastro para. É exatamente o cenário
que a contingência existe para cobrir.

### 5. Testar a restauração do backup · 1 hora

No Neon, restaure o banco para um ponto anterior **em homologação** e confira
que os dados voltaram. Anote a data no checklist.

**Backup não testado não é backup.** A hora de descobrir que a restauração pede
um parâmetro que ninguém tem não é às onze da manhã de sábado.

### 6. Criar as contas dos Operadores · 20 minutos

Uma conta por pessoa que vai operar, e **cada uma testa a própria antes do
dia**:

```bash
npm run criar-operador -- --usuario marina --nome "Marina Costa"
# a senha é digitada no prompt, sem eco — ela nunca vai por argumento
```

**Se ficar de fora:** o Operador descobre que a senha está errada com a fila já
formada.

---

## Uma tarde de ensaios · reserve 3 horas com o time

Nada aqui precisa de código. Tudo aqui precisa de gente, e **procedimento nunca
ensaiado falha na hora**.

| #   | ensaio                                                  | quem        | o que provar                                                                  |
| --- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| 1   | **Contingência**: preencher 5 fichas, digitar, conferir | 2 pessoas   | O procedimento funciona e o time sabe onde as fichas estão                    |
| 2   | **Lançamento cronometrado** no painel                   | supervisor  | Cabe em 15 s: buscar, selecionar, digitar, confirmar                          |
| 3   | **Cadastro cronometrado** com 5 pessoas de cada perfil  | 10 pessoas  | Cabe em 2 minutos, inclusive com responsável                                  |
| 4   | **QR com três leitores diferentes**                     | 3 celulares | Abre de primeira, sem terceira tentativa                                      |
| 5   | **Classificação em celular de 360 px**, sob sol         | 1 pessoa    | Nada rola de lado; dá para ler na arquibancada                                |
| 6   | **Exportações no Excel em português**                   | 1 pessoa    | Acento certo, colunas separadas, e um nome começando com `=` não vira fórmula |
| 7   | **Cadastro em 3G de verdade**, com o cache vazio        | 1 celular   | Abre em até 3 segundos                                                        |
| 8   | **Disparo do alerta**: derrube o site de propósito      | técnico     | O aviso chega no celular de quem pode agir                                    |
| 9   | **Atalhos do painel** com o supervisor                  | supervisor  | `Alt+1`/`Alt+2` trocam de Cockpit, `F2` ausência, `F3` busca, `Esc` cancela   |

---

## Quatro decisões que só você pode tomar

### D1 · O termo ainda diz "pista"

O texto aprovado (`v1.0-2026-08-19`) fala em "pista"; o sistema inteiro fala
**Cockpit**. Trocar a palavra significa **versão nova do termo**, e versão nova
nasce rascunho — e **sob rascunho o sistema recusa cadastrar qualquer pessoa**,
de propósito.

Ou seja: só mude se puder aprovar a versão nova por escrito antes do evento.
Manter como está é uma escolha defensável — a divergência está registrada.

### D2 · A métrica de uso da busca não é mensurável

O PRD pede "≥ 30% usam a busca por nome". Como a busca roda dentro do navegador
e não gasta rede, **o servidor não vê nada disso**. As duas saídas:

1. tirar a métrica do PRD; ou
2. aceitar telemetria de navegador na página mais pública do evento.

Recomendo a primeira. A segunda coloca rastreamento exatamente onde o termo
promete o contrário.

### D3 · Quem incluiu alguém no Cockpit errado?

Hoje não há registro. Se um Operador incluir uma pessoa no Cockpit 2 por engano,
não há como saber quem foi. Está dentro do requisito (RF-23 cobre gravação e
alteração de **tempo**), mas é uma decisão consciente.

Custo de mudar: uma migração pequena. Se quiser, é um pedido.

### D4 · Existe patrocinador com logotipo na página?

O plano gratuito da Vercel é para uso não comercial. Ficou registrado que o
site é iniciação científica, sem marca de patrocinador. **Se alguém pedir um
logotipo na página de inscrição, a pergunta volta** — e a consequência de errar
não é uma fatura, é o site sair do ar no dia.

---

## No dia do evento

Está tudo em [`plano-do-dia.md`](plano-do-dia.md), impresso. O resumo:

- **Antes de abrir:** tirar um snapshot manual do banco no Neon
- **Durante:** nenhum deploy, exceto correção crítica com duas pessoas de acordo
- **Se algo quebrar:** reverter é a primeira resposta, não a última
- **Se o cadastro recusar gente:** `RATE_LIMIT_ATIVO=false` na Vercel + redeploy

---

## Dez dias depois — 4 de novembro de 2026

O termo promete que o site sai do ar e os dados são apagados. **As duas coisas**,
e apagar o banco não cumpre a promessa sozinho:

```bash
npm run expurgar -- --evento 2026-10-24 --confirmar --responsavel "Seu Nome"
```

Depois: remover o domínio, desativar o projeto na Vercel, apagar o projeto no
Neon e desligar o monitor. Procedimento completo em
[`retencao.md`](retencao.md) e [`deploy.md`](deploy.md) §6.

**Marque na agenda hoje.** É uma promessa por escrito para 2000 pessoas.

---

## Sobre a senha do painel

**Não existe senha para eu te passar, e isso é o sistema funcionando.**

As senhas são guardadas como hash `scrypt`, que é uma função de mão única: o
banco guarda o resultado, não a senha, e não há como voltar atrás. Não existe
senha em texto em lugar nenhum do repositório — nem em arquivo, nem em variável,
nem em comentário.

Existem duas contas no banco de desenvolvimento: `seed` (criada pela massa de
teste, com hash inválido de propósito — ela **não loga**) e `dhiego`, criada em
22/08. Se você lembra a senha dessa, ela funciona.

Se não lembra, **crie outra conta** — leva vinte segundos:

```bash
npm run criar-operador -- --usuario dhiego2 --nome "Dhiego"
```

A senha é digitada no prompt, sem eco. Ela não entra por argumento de propósito:
argumento aparece no histórico do shell e na lista de processos da máquina, onde
qualquer usuário do sistema lê.

**Uma lacuna que vale registrar:** não existe comando para _redefinir_ a senha de
uma conta existente — só `--desativar` e `--destravar`. Criar uma segunda conta
resolve, mas se você quiser um `--redefinir-senha` antes do evento, é um pedido
pequeno.
