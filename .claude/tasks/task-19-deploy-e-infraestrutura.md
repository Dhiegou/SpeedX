# T19 — Deploy e infraestrutura

**Contexto SDD:** §4 (transporte) e §5 (modos de falha)
**Depende de:** T01, T16
**Bloqueia:** T18, T21
**Requisitos:** RNF-01, RNF-04, RNF-05, RF-23, RF-31

---

## Objetivo

Colocar em pé o ambiente que sustenta as decisões de transporte do SDD. Duas delas dependem inteiramente da infraestrutura e não do código: **HTTP/3 anunciado** e **relógio do servidor confiável**.

### O que já está decidido — 2026-08-25

**A aplicação vai para a Vercel, plano gratuito** (D-76). Isso encaminha três itens desta task sem trabalho: a borda anuncia HTTP/3 (§1) e comprime com Brotli, honra `s-maxage` e `stale-while-revalidate` (§3), e o deploy sai de commit com reversão em minutos (§6). Nenhum deles está **verificado** — §1 continua exigindo o `curl --http3` contra o domínio de verdade.

**Quatro coisas continuam abertas, e são elas que seguram T18 e T21:**

1. **Onde roda o Postgres.** A Vercel não hospeda o banco. Vale tudo o que §5 pede — TLS obrigatório, backup automático, restauração testada — mais duas questões que só existem por causa do ambiente sem servidor: **limite de conexões** visto de funções efêmeras, e **região**. A página da Classificação é `force-dynamic` (D-59): cada primeira pintura atravessa a distância entre a função e o banco, e a região padrão da Vercel não é São Paulo.
2. **O domínio.** Enquanto não existir, o QR de T07 é provisório (D-35).
3. **O monitor externo** de T16, com o teste real de disparo.
4. **O plano Hobby é para uso não comercial.** Se o evento é patrocinado, cobra inscrição ou carrega marca de terceiro, confirmar os termos antes — ou orçar o plano pago. A consequência de errar isso não é uma fatura, é o site sair do ar no dia.

**A data do evento é 24 de outubro de 2026** (PE-06), o que data o congelamento de deploys de §6 e o desligamento programado: **4 de novembro de 2026**, o mesmo instante em que a retenção vence.

## Escopo

### 1. Hospedagem com HTTP/3 (FL-02, FL-07)

O SDD justifica QUIC pelo cenário real: centenas de celulares na mesma célula, perda de pacote alta, bloqueio de cabeça de fila do TCP prejudicando RNF-04. **A hospedagem escolhida precisa anunciar HTTP/3.**

- Verificar com `curl --http3 -I https://<dominio>` e conferir o cabeçalho `alt-svc: h3=...`.
- Se a plataforma não anunciar HTTP/3, isso vira risco declarado: FL-02 e FL-07 caem para TCP e RNF-04 fica ameaçado. Registrar no checklist e decidir conscientemente.

### 2. TLS e domínio

- Certificado válido, HSTS, redirecionamento de HTTP para HTTPS.
- Domínio curto para o QR code (T07), com DNS de TTL adequado (FL-01).

### 3. Cache de borda (RNF-01)

- Configurar a borda para respeitar `s-maxage` e `stale-while-revalidate` de T12.
- Confirmar que a resposta pública é servida **da borda**, sem atingir a aplicação a cada leitura.
- Compressão Brotli habilitada.
- Garantir que rotas do painel e de exportação **nunca** sejam cacheadas (`no-store`).

### 4. Relógio do servidor (FL-10, RF-23, RF-31)

- Sincronização NTP ativa no host (ou garantia equivalente do provedor gerenciado), documentada.
- Confirmar que **todo** instante gravado (`inscrito_em`, `resolvido_em`, `lancamento.ocorrido_em`) vem do servidor — nunca do dispositivo do Operador. Verificado por leitura do código, conforme a restrição 1 do anexo.
- Fuso horário do banco e da aplicação em UTC, com conversão só na apresentação.

### 5. Banco de dados

- Instância gerenciada com TLS obrigatório (FL-09), pool de conexões dimensionado.
- **Backup automático** e, principalmente, um *snapshot manual* no início do evento.
- Testar a **restauração** antes do evento. Backup não testado não é backup.

### 6. Ambientes

- `producao` e `homologacao` com o mesmo formato de configuração.
- Segredos fora do repositório, injetados por variável de ambiente.
- Deploy reprodutível a partir de commit, com possibilidade de reverter em minutos. **Congelar deploys no dia do evento**, exceto correção crítica.
- **Desligamento programado:** o termo de consentimento promete que, 10 dias após o evento, o site sai do ar (D-22). Precisa haver um responsável, uma data e um procedimento — tirar do ar, não só apagar o banco. Executado junto com o expurgo de T15.

### 7. Plano de resposta no dia

Documento curto (uma página) com: quem é acionado, como reverter, como acessar log, como rodar o expurgo de emergência do cache, telefone das pessoas relevantes.

## Critérios de aceitação

- [ ] `curl --http3 -I` confirma HTTP/3 anunciado — ou o risco está registrado e aceito por escrito.
- [ ] Requisição repetida a `/api/classificacao` retorna `HIT` de cache de borda dentro da janela.
- [ ] Rotas do painel e exportação retornam `no-store`.
- [ ] Sincronia de relógio do servidor verificada e documentada.
- [ ] Nenhum timestamp gravado vem do cliente (verificado por leitura do código).
- [ ] Restauração de backup testada com sucesso em homologação.
- [ ] Plano de resposta escrito e distribuído ao time do evento.
