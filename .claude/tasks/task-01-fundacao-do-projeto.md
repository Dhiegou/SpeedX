# T01 — Fundação do projeto e tooling

**Contexto SDD:** transversal
**Depende de:** —
**Bloqueia:** todas as demais

---

## Objetivo

Criar o esqueleto do monólito modular com as fronteiras de contexto já materializadas em estrutura de pastas, de modo que a barreira de privacidade descrita no SDD §1 seja imposta pela organização do código, não por disciplina.

## Stack adotada (premissa)

O PRD e o SDD não fixam tecnologia. Adoto o conjunto abaixo por ser o que satisfaz as restrições declaradas com menos peças móveis. **Se o organizador ou o time definir outra stack, esta é a única tarefa que precisa mudar** — as demais descrevem comportamento, não framework.

| Peça | Escolha | Por quê |
|---|---|---|
| App | Next.js (App Router) + TypeScript | Renderização e acesso a dados no servidor por padrão, atendendo à restrição 3 (nenhuma consulta parte do navegador) |
| Banco | PostgreSQL gerenciado | Consistência forte para Inscrição e Cronometragem (SDD §5) |
| Acesso a dados | Drizzle ORM + migrações versionadas | Esquema em código, migração auditável |
| Validação | Zod, esquemas compartilhados cliente/servidor | Mesma regra, revalidada no servidor (restrição 2) |
| Hospedagem | Plataforma com HTTP/3 e cache de borda | FL-02 e FL-07 do SDD; verificado em T19 |
| Testes | Vitest (unidade/integração) + Playwright (e2e) | T17 |

## Escopo

1. Inicializar o projeto Next.js + TypeScript em modo estrito (`strict: true`, sem `any` implícito).
2. Criar a estrutura de módulos espelhando os bounded contexts:

```
src/
  contexts/
    inscricao/        # BC-01 — domínio, validação, casos de uso
    cronometragem/    # BC-02
    classificacao/    # BC-03 — modelo SEM email/telefone/idade/responsável
    identidade/       # BC-04
    custodia/         # BC-05 — único autorizado a cruzar pessoal + resultado
  shared/             # tipos primitivos, formatação de Tempo, erros
  db/                 # conexão, esquema, migrações
app/                  # rotas: /inscricao, /classificacao, /painel, /api/*
```

3. Regra de importação imposta por lint: `classificacao/` não pode importar de `inscricao/` nem de `db/` fora da sua própria projeção. Configurar `eslint-plugin-boundaries` (ou equivalente) com essa regra como **erro**, não aviso.
4. Configurar ESLint + Prettier + `tsc --noEmit` em script único `npm run check`.
5. Configurar `.env.example` com todas as variáveis necessárias e leitura tipada e validada na inicialização (falha rápida se faltar variável).
6. Configurar CI (lint + typecheck + testes) em pull request.
7. `README.md` do projeto: como rodar local, como rodar migrações, como criar operador.

## Critérios de aceitação

- [x] `npm run check` passa em repositório limpo. — lint + `tsc --noEmit` + `prettier --check`.
- [x] Um import de `src/contexts/classificacao` para `src/contexts/inscricao` faz o lint falhar com erro. — verificado, e coberto permanentemente por `tests/fronteiras.test.ts`.
- [x] Subir a aplicação sem uma variável de ambiente obrigatória falha na inicialização com mensagem nomeando a variável. — `next start` sem as variáveis recusa iniciar e lista `DATABASE_URL`, `SESSION_SECRET` e `APP_URL`.
- [x] CI bloqueia merge com lint, tipo ou teste quebrado. — `.github/workflows/ci.yml` roda `check`, `test` e `build` em pull request. *Só entra em vigor quando o repositório tiver remoto no GitHub.*

## Resultado da execução — 2026-08-18

**Versões instaladas:** Next 16.3.1, React 19.2.8, TypeScript 6.0.3, Zod 4.4.3, ESLint 9.39.5, Prettier 3.9.6, Vitest 4.1.11.

**Três desvios em relação ao plano, todos descobertos ao verificar e não ao escrever:**

1. A regra de fronteira deixava passar o import de fachada (`@/contexts/x` sem subcaminho), porque `patterns` usa semântica gitignore. Corrigido separando `paths` (exato) de `patterns` (subcaminho) — sem isso a exceção do `contrato` não é expressável. Registrado como D-11 no CONTEXT.
2. Next 16 removeu a chave `eslint` do `next.config`: o build não reprova mais por lint. Quem barra é `npm run check` e o CI.
3. `outputFileTracingRoot` precisou ser fixado — sob OneDrive, o Next inferia a raiz como o diretório do usuário e ignorava o `package-lock.json`.

**Antecipado de T12:** `paraNomePublico` e o tipo `LinhaClassificacao` foram escritos aqui, com teste, para que a regra de isolamento de Classificação tivesse conteúdo real a proteger (D-13).

**Não feito:** nenhum commit. O repositório git foi inicializado e os arquivos preparados no índice.

## Notas

- Não instalar biblioteca de acesso a dados no cliente. Nenhum pacote de cliente deve receber credencial de banco.
- Modo estrito de TypeScript é pré-requisito para as invariantes de T04 e T09 serem verificáveis em tipo.
