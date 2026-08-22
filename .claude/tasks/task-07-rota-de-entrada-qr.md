# T07 — Rota de entrada e QR code

**Contexto SDD:** BC-01 · fluxos FL-01, FL-02
**Depende de:** T06
**Bloqueia:** —
**Requisitos:** RF-01, RNF-04

---

## Objetivo

Garantir que escanear o QR code abra o formulário direto, sem etapa intermediária. Cada segundo e cada toque extra aqui viram fila no ponto do QR — um dos contraindicadores do PRD §7.

## Escopo

1. **URL curta e limpa**, sem parâmetros de rastreamento, sem redirecionamento em cadeia. Um redirecionamento a mais custa uma resolução de nome e um handshake (FL-01, FL-02).
2. Escolher entre servir o formulário na raiz (`/`) ou em `/inscricao` com a raiz redirecionando. **Preferir a raiz servir o formulário diretamente** — zero redirecionamento.
3. Gerar o QR code em alta correção de erro (nível H), em arquivo vetorial, com área de silêncio adequada, e documentar tamanho mínimo de impressão para leitura a ~50cm.
4. Testar leitura com **três leitores distintos** (câmera nativa iOS, câmera nativa Android, um leitor de terceiros).
5. Cabeçalhos: `Cache-Control` permitindo cache de borda dos ativos estáticos; HTML sempre revalidado.
6. Preparar sinalização impressa com a URL escrita por extenso, como alternativa para quem não conseguir escanear.

## Critérios de aceitação

- [ ] **Escanear com três leitores distintos abre o formulário sem etapa intermediária (RF-01).** Depende de aparelho e de material impresso. Checklist pronto em [`docs/sinalizacao.md`](../../docs/sinalizacao.md) §5, para a rodada de ensaio pré-evento.
- [x] Zero redirecionamentos entre a URL do QR e o HTML do formulário. — verificado com `curl`: `redirects=0`, `status=200`. E protegido daqui em diante por `tests/entrada.test.ts`, que falha se alguém acrescentar um redirecionamento, ligar `trailingSlash` ou criar uma segunda rota de inscrição.
- [ ] **Carga completa em ≤ 3 s com 3G lento (RNF-04).** Não fecha, e a conta está abaixo. Passa com folga em 3G rápido; não passa no perfil "3G lento". Medição real é de T18.
- [x] Peso total do primeiro carregamento documentado no README, com orçamento definido. — **139,0 KB gzip** contra o teto de 150 KB, e o teto é verificável: `npm run orcamento` falha se for ultrapassado.

## Resultado da execução — 2026-08-20

| Arquivo | Papel |
|---|---|
| `scripts/gerar-qr.ts` | Gera o QR a partir da `APP_URL`: nível H, SVG, área de silêncio, e a tabela de tamanhos de impressão |
| `scripts/orcamento.mjs` | Mede o primeiro carregamento e falha acima do teto |
| `src/shared/qr.ts` | O cálculo de tamanho mínimo, puro e testado |
| `docs/qr/inscricao.svg` | O QR, com o destino escrito dentro do arquivo |
| `docs/sinalizacao.md` | Especificação do material impresso (item 6 do escopo) |
| `tests/entrada.test.ts`, `src/shared/qr.test.ts` | 16 testes |

Dependência nova: `qrcode` (desenvolvimento). Escrever um codificador de QR — Reed-Solomon, máscaras, versões — para gerar um arquivo uma vez não se justifica.

### Cabeçalhos: nada a configurar

O item 5 do escopo já estava satisfeito pelos padrões do Next, e foi verificado em vez de suposto:

| Recurso | `Cache-Control` |
|---|---|
| HTML da raiz | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/_next/static/*` | `public, max-age=31536000, immutable` |

Exatamente o que o escopo pede: ativo estático cacheável na borda por um ano, HTML sempre revalidado. Acrescentar configuração aqui só criaria uma segunda fonte de verdade.

### A conta dos 3 segundos

O primeiro carregamento são 139,0 KB gzip. Com uma conexão de **400 kbit/s e 2 s de latência**, que são os parâmetros usuais do perfil "3G lento":

- transferência: 139 KB × 8 ÷ 400 kbit/s = **2,8 s**, só de bytes;
- mais o estabelecimento da conexão, que nesse perfil já custa alguns segundos por si só.

Ou seja: **o alvo de 3 s não é alcançável nesse perfil nem com página vazia** — a latência sozinha estoura o orçamento antes do primeiro byte útil. Com 1,6 Mbit/s e 560 ms ("3G rápido"), a mesma conta dá cerca de 2,4 s, e aí cabe.

Duas consequências práticas:

1. O critério precisa ser reescrito contra um perfil de rede nomeado, medido em aparelho real. Isso é T18.
2. O HTTP/3 do SDD (FL-02) deixa de ser preferência e vira o que segura a conta: em rede com perda alta, é o estabelecimento de conexão e o bloqueio de cabeça de fila do TCP que dominam, não os bytes. T19 precisa confirmar o `alt-svc`.

### O QR ainda não é o definitivo

Gerado contra `https://speedx.exemplo.br`, que é espaço reservado enquanto a hospedagem não for escolhida (PE-05). O script avisa em voz alta quando o endereço é provisório, e o destino fica gravado no `<title>` do SVG — conferir o cartaz depois de impresso é abrir o arquivo, não escanear. Uma URL definitiva mais longa muda o número de módulos e, com ele, a tabela de tamanhos: por isso a tabela é gerada, não escrita à mão.

## Estado

**Concluída em 2026-08-20**, com dois critérios abertos que dependem do mundo físico: o teste com três leitores e a medição de carga em rede real.

Com isto a trilha de Inscrição (T03–T07) está fechada. As próximas frentes são Cronometragem (T08–T11) e Classificação (T12–T13), que partem da T02 e não dependem de nada aqui.
