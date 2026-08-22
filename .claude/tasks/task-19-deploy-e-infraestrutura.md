# T19 — Deploy e infraestrutura

**Contexto SDD:** §4 (transporte) e §5 (modos de falha)
**Depende de:** T01, T16
**Bloqueia:** T18, T21
**Requisitos:** RNF-01, RNF-04, RNF-05, RF-23, RF-31

---

## Objetivo

Colocar em pé o ambiente que sustenta as decisões de transporte do SDD. Duas delas dependem inteiramente da infraestrutura e não do código: **HTTP/3 anunciado** e **relógio do servidor confiável**.

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
