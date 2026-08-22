# PRD — Sistema de Cadastro e Classificação de Corrida

**Versão:** 2.0
**Escopo:** Evento presencial de um dia, duas pistas, 2000+ participantes

---

## 1. Visão do Produto

Um sistema que substitui a inscrição em papel e a planilha de resultados de uma corrida de evento por um fluxo digital ponta a ponta: o participante se cadastra sozinho pelo celular escaneando um QR code no local, um supervisor registra o tempo cronometrado assim que a corrida termina, e a classificação fica pública e atualizada durante todo o evento.

O produto tem sucesso quando o participante consegue se inscrever sem formar fila, o supervisor consegue lançar tempos no ritmo em que as corridas acontecem, e qualquer pessoa consegue descobrir sua posição sem perguntar para ninguém.

---

## 2. Problema

**A inscrição em papel cria gargalo na entrada.** Com 2000 participantes esperados num único dia, um posto de inscrição manual vira fila. Cada ficha ainda precisa ser digitada depois, com risco de erro de leitura e retrabalho.

**O resultado não existe durante o evento.** Hoje o participante corre e vai embora sem saber sua posição. A classificação só aparece depois, quando o interesse já passou. Isso desperdiça o principal momento de engajamento do evento.

**Associar pessoa e tempo é a operação mais frágil.** Duas pistas rodando em paralelo, alguém cronometrando manualmente, e uma lista com centenas de nomes. Em 2000 cadastros brasileiros, nomes repetidos são certeza. Um lançamento na pessoa errada compromete a credibilidade de toda a tabela.

**Há menores de idade participando.** A idade mínima é 13 anos, o que significa coletar dado pessoal de adolescente. Isso exige consentimento de responsável registrado e verificável, e impõe cuidado extra sobre o que aparece em tela pública.

**Não existe segunda chance.** O evento dura um dia. Não há janela de manutenção, não há correção na semana seguinte, e o pico de acesso é concentrado em poucas horas. O que falhar, falhou.

---

## 3. Personas

### P1 — Participante adulto

Chega ao evento, vê o QR code, quer se inscrever em menos de dois minutos usando o próprio celular, em rede móvel possivelmente congestionada. Depois de correr, quer conferir sua posição rapidamente. Pode optar por correr uma pista ou as duas.

**Precisa de:** formulário curto, feedback claro de sucesso ou erro, e uma forma óbvia de se achar na classificação.

### P2 — Participante adolescente (13 a 17 anos)

Mesmo fluxo do adulto, mas o cadastro só é válido com dados e consentimento de um responsável. Frequentemente está acompanhado no momento da inscrição.

**Precisa de:** um caminho que não trave o cadastro, mas que deixe explícito o que o responsável está autorizando.

### P3 — Responsável pelo menor

Não usa o sistema diretamente, mas é quem autoriza. Precisa entender, em linguagem simples, quais dados do adolescente estão sendo coletados, para quê, e o que ficará visível publicamente.

**Precisa de:** texto de consentimento claro e específico, não um bloco jurídico genérico.

### P4 — Supervisor

Opera o painel durante o dia inteiro. Cronometra com equipamento externo e digita o tempo no sistema. Trabalha sob pressão: as corridas não esperam. Ao longo de dez horas, o ritmo médio é de cerca de três lançamentos por minuto, sem pausa programada.

**Precisa de:** encontrar a pessoa certa em segundos, confirmar que é ela mesma antes de salvar, e nunca perder o lugar na fila. Qualquer fricção de interface se acumula em fila de gente esperando.

### P5 — Organizador

Não opera o sistema no dia. Antes do evento, define regras e valida o texto de consentimento. Depois do evento, precisa dos dados completos dos participantes para prestação de contas e contato.

**Precisa de:** exportação completa dos dados e clareza sobre retenção e exclusão.

---

## 4. Casos de Uso

| ID | Caso de uso | Ator |
|---|---|---|
| CU-01 | Inscrever-se escaneando o QR code | P1 |
| CU-02 | Inscrever-se sendo menor de idade, com consentimento do responsável | P2, P3 |
| CU-03 | Escolher em qual pista ou pistas vai correr | P1, P2 |
| CU-04 | Localizar o próximo participante da fila de uma pista | P4 |
| CU-05 | Registrar o tempo de um participante que terminou a corrida | P4 |
| CU-06 | Marcar um inscrito como ausente | P4 |
| CU-07 | Corrigir um tempo lançado incorretamente | P4 |
| CU-08 | Incluir uma segunda tentativa para quem decidiu correr a outra pista | P4 |
| CU-09 | Consultar a classificação geral | P1, P2 |
| CU-10 | Filtrar a classificação por pista | P1, P2 |
| CU-11 | Buscar a própria posição pelo nome | P1, P2 |
| CU-12 | Exportar todos os dados do evento | P5 |

---

## 5. Requisitos Funcionais

### Cadastro

**RF-01** — O sistema deve permitir cadastro sem autenticação, acessível diretamente por um endereço único codificado em QR code.
*Verificação:* escanear o QR com três leitores distintos abre o formulário sem etapa intermediária.

**RF-02** — O formulário deve coletar nome, sobrenome, e-mail, telefone, idade e escolha de pista.
*Verificação:* todos os seis campos estão presentes e são obrigatórios.

**RF-03** — O sistema deve permitir que o participante selecione uma pista ou ambas no mesmo cadastro, exigindo ao menos uma seleção.
*Verificação:* enviar sem seleção é rejeitado; enviar com uma e com duas seleções é aceito.

**RF-04** — O sistema deve rejeitar cadastros com idade inferior a 13 anos.
*Verificação:* idade 12 é rejeitada com mensagem explicativa; idade 13 é aceita.

**RF-05** — Ao informar idade inferior a 18, o formulário deve exibir campos adicionais de nome, sobrenome e telefone do responsável, além de declaração de consentimento.
*Verificação:* testar nas idades 13, 17, 18 e 19; o bloco aparece nas duas primeiras e não nas duas últimas.

**RF-06** — Cadastro de menor de idade só pode ser concluído com todos os campos do responsável preenchidos e o consentimento marcado.
*Verificação:* tentativa de envio com bloco incompleto é rejeitada.

**RF-07** — Se a idade for corrigida de menor para maior durante o preenchimento, os campos de responsável devem ser descartados.
*Verificação:* preencher como menor, alterar idade para 18, enviar; o registro não contém dado de responsável.

**RF-08** — O sistema deve exigir aceite explícito do termo de consentimento antes de concluir qualquer cadastro.
*Verificação:* envio sem aceite é rejeitado.

**RF-09** — O termo de consentimento deve informar quais dados são coletados, a finalidade, o prazo de retenção, o meio de solicitar exclusão, e declarar explicitamente que nome e inicial do sobrenome ficarão visíveis em página pública.
*Verificação:* revisão do texto contra esta lista, com validação do organizador.

**RF-10** — Após o cadastro, o sistema deve confirmar em tela o nome registrado e a pista ou pistas escolhidas.
*Verificação:* a confirmação exibe exatamente os dados enviados.

### Operação do supervisor

**RF-11** — O painel deve ser acessível apenas mediante autenticação.
*Verificação:* acesso sem sessão válida é bloqueado.

**RF-12** — O painel deve permitir múltiplos operadores autenticados simultaneamente sem conflito de dados.
*Verificação:* dois operadores lançando na mesma pista ao mesmo tempo não sobrescrevem lançamentos um do outro.

**RF-13** — O painel deve separar a visualização por pista.
*Verificação:* alternar entre pistas altera a lista exibida.

**RF-14** — Por padrão, cada pista deve exibir apenas os inscritos que ainda não têm tempo registrado, ordenados do cadastro mais antigo para o mais recente.
*Verificação:* a lista inicial não contém registros já lançados nem ausentes, e respeita a ordem de inscrição.

**RF-15** — Cada item da lista deve exibir nome, sobrenome e os últimos quatro dígitos do telefone.
*Verificação:* dois participantes homônimos são distinguíveis apenas pelo que a lista mostra.

**RF-16** — O painel deve permitir buscar um inscrito por nome dentro da pista selecionada.
*Verificação:* busca parcial retorna correspondências.

**RF-17** — O sistema deve permitir registrar o tempo em formato de minutos, segundos e centésimos.
*Verificação:* um tempo de 1 minuto, 23 segundos e 45 centésimos é aceito e reexibido idêntico.

**RF-18** — Antes de gravar um tempo, o sistema deve exigir confirmação exibindo o nome do participante em destaque.
*Verificação:* nenhum lançamento é gravado sem a etapa de confirmação.

**RF-19** — Todo o fluxo de lançamento — buscar, selecionar, digitar tempo, confirmar — deve ser executável somente pelo teclado.
*Verificação:* completar cinco lançamentos consecutivos sem tocar no mouse.

**RF-20** — Após gravar um lançamento, o sistema deve limpar os campos e devolver o foco ao início do fluxo.
*Verificação:* o lançamento seguinte começa sem ação adicional do operador.

**RF-21** — O sistema deve permitir marcar um inscrito como ausente, removendo-o da fila sem excluir o cadastro.
*Verificação:* o marcado some da lista padrão, permanece nos dados exportados, e não aparece na classificação.

**RF-22** — O sistema deve permitir corrigir um tempo já registrado.
*Verificação:* o valor corrigido substitui o anterior e a classificação reflete a mudança.

**RF-23** — Toda gravação ou alteração de tempo deve registrar qual operador a realizou e quando.
*Verificação:* consultar um lançamento revela autor e momento.

**RF-24** — O sistema deve permitir incluir uma tentativa em pista adicional para um participante já cadastrado, sem exigir novo cadastro.
*Verificação:* participante inscrito apenas na pista 1 passa a constar também na fila da pista 2, mantendo um único registro pessoal.

**RF-25** — O sistema deve impedir mais de um tempo registrado por participante por pista.
*Verificação:* tentativa de segundo lançamento na mesma pista é bloqueada ou tratada como correção.

### Classificação pública

**RF-26** — A classificação deve ser acessível publicamente, sem autenticação.
*Verificação:* abre em sessão anônima.

**RF-27** — A classificação deve exibir posição, nome, inicial do sobrenome, pista e tempo.
*Verificação:* as cinco informações estão presentes e nenhuma outra.

**RF-28** — Cada tentativa deve ocupar uma linha própria; quem correu as duas pistas aparece duas vezes.
*Verificação:* participante com dois tempos gera duas linhas distintas.

**RF-29** — A classificação deve oferecer filtro por pista, com a posição recalculada conforme o filtro aplicado.
*Verificação:* filtrar por pista renumera as posições a partir de 1.

**RF-30** — A classificação deve permitir busca por nome, destacando o resultado encontrado.
*Verificação:* buscar um nome cadastrado localiza e evidencia a linha correspondente.

**RF-31** — Empates de tempo devem ser resolvidos pelo lançamento mais antigo.
*Verificação:* dois tempos idênticos aparecem em ordem estável e previsível.

**RF-32** — A classificação deve indicar quando foi atualizada pela última vez e permitir atualização manual.
*Verificação:* o indicador existe e o botão força nova leitura.

**RF-33** — A classificação deve exibir ao menos as 100 primeiras posições, com acesso ao restante.
*Verificação:* as posições 1 a 100 são visíveis sem interação adicional; a 101 é alcançável.

### Dados

**RF-34** — O sistema deve permitir exportar todos os cadastros com seus tempos, incluindo dados pessoais e de responsáveis, em formato tabular.
*Verificação:* a exportação abre em planilha e contém todos os registros do evento.

**RF-35** — A exportação deve ser restrita a usuários autenticados.
*Verificação:* acesso anônimo ao recurso é negado.

---

## 6. Requisitos Não Funcionais

### Desempenho e capacidade

**RNF-01** — A classificação deve responder em até 2 segundos com 500 acessos simultâneos.
*Verificação:* teste de carga antes do evento.

**RNF-02** — O sistema deve suportar ao menos 2000 cadastros e 4000 tempos registrados sem degradação perceptível.
*Verificação:* teste com massa de dados equivalente.

**RNF-03** — Um tempo registrado deve aparecer na classificação pública em até 30 segundos.
*Verificação:* cronometrar do lançamento até a atualização visível.

**RNF-04** — A página de cadastro deve carregar em até 3 segundos em conexão móvel lenta.
*Verificação:* medição com limitação de rede simulando 3G.

### Disponibilidade

**RNF-05** — O sistema deve permanecer disponível durante toda a janela do evento, sem interrupção programada.
*Verificação:* monitoramento contínuo no dia.

**RNF-06** — Deve existir procedimento alternativo de coleta caso a conectividade do local falhe, com digitação posterior.
*Verificação:* procedimento documentado e material impresso disponível no local.

### Privacidade e conformidade

**RNF-07** — Dados de menores de idade só podem ser coletados com consentimento registrado do responsável.
*Verificação:* nenhum registro de menor existe sem consentimento associado.

**RNF-08** — Nenhuma tela pública pode exibir e-mail, telefone, idade ou qualquer dado de responsável.
*Verificação:* inspeção de todas as respostas públicas confirma ausência desses campos.

**RNF-09** — Em tela pública, o Participante maior de idade aparece com nome e sobrenome completos; o menor de 18 aparece com o nome e apenas a inicial do sobrenome. *(Revisado em 2026-08-19 — a versão anterior exigia a inicial para todos; motivo em [CONTEXT.md](CONTEXT.md) D-21.)*
*Verificação:* nenhum sobrenome completo de participante menor de 18 é visível publicamente; participante maior aparece por extenso.

**RNF-10** — Dados pessoais completos devem ser acessíveis apenas mediante autenticação.
*Verificação:* tentativa de acesso anônimo a dados completos é negada.

**RNF-11** — Deve existir prazo de retenção definido e um procedimento de exclusão dos dados após o evento.
*Verificação:* prazo acordado com o organizador e registrado por escrito.

### Segurança

**RNF-12** — O cadastro público deve conter mecanismo de proteção contra envios automatizados em massa.
*Verificação:* envios repetidos além do limite definido são bloqueados.

**RNF-13** — Toda validação aplicada no cadastro deve ser reaplicada de forma independente do navegador do usuário.
*Verificação:* envio manipulado que burla a validação de tela é rejeitado.

**RNF-14** — Contas de operador devem ser criadas apenas pelo administrador, sem auto-cadastro.
*Verificação:* não existe caminho público de criação de conta.

### Usabilidade

**RNF-15** — O cadastro deve ser concluível em até 2 minutos por um participante adulto, e até 3 minutos no fluxo de menor.
*Verificação:* teste cronometrado com cinco pessoas reais em cada perfil.

**RNF-16** — Um lançamento de tempo no painel deve ser concluível em até 15 segundos.
*Verificação:* teste cronometrado com o supervisor do evento.

**RNF-17** — Toda rejeição de formulário deve indicar qual campo falhou e por quê.
*Verificação:* cada regra de validação produz mensagem específica.

**RNF-18** — A interface de cadastro e a de classificação devem ser operáveis em tela de celular.
*Verificação:* teste em largura de 360px sem rolagem horizontal.

---

## 7. Métricas de Sucesso

### Métricas primárias

| Métrica | Meta | Como medir |
|---|---|---|
| Taxa de conclusão do cadastro | ≥ 95% dos que abrem o formulário | Iniciados x concluídos |
| Tempo mediano de cadastro | ≤ 90 segundos | Registro de início e conclusão |
| Lançamentos corrigidos após gravação | ≤ 1% do total | Contagem de correções |
| Inscritos sem tempo nem marcação de ausência ao fim do evento | 0 | Auditoria da base |
| Indisponibilidade durante o evento | 0 minutos | Monitoramento |

### Métricas secundárias

| Métrica | Meta | Como medir |
|---|---|---|
| Consultas à classificação por participante | ≥ 2 | Acessos ÷ inscritos |
| Uso da busca por nome | ≥ 30% das sessões | Interações com o campo |
| Participantes que correram as duas pistas | acompanhar | Tentativas ÷ participantes |
| Cadastros de menores com bloco completo na primeira tentativa | ≥ 90% | Rejeições no bloco de responsável |

### Contraindicadores

Sinais de que algo falhou mesmo com as metas atingidas:

- Fila visível no ponto do QR code em qualquer momento do dia
- Supervisor pedindo para participantes repetirem o nome mais de uma vez
- Qualquer contestação de resultado que o sistema não consiga esclarecer
- Qualquer dado pessoal visível em tela pública

---

## Anexo — Restrições de implementação

Fora do escopo do PRD, mantidas como acordo de trabalho com quem for implementar:

1. Verificação de resultado deve ser feita pela leitura do código produzido, não pela renderização no navegador.
2. Validação existente na interface deve ser sempre reaplicada de forma independente no lado servidor.
3. Consultas a dados não devem partir do navegador do usuário final.
