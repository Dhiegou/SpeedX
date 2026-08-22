---
name: manter-readme
description: Mantém o README.md da raiz sempre atualizado. Use SEMPRE que mudar stack, estrutura de pastas, scripts, variáveis de ambiente, rotas, forma de rodar/testar/implantar o projeto, ou quando uma task for concluída e alterar o estado do projeto. Use também quando o usuário pedir para "atualizar o README".
---

# Skill — Manter o README.md atualizado

## Função

Garantir que o `README.md` da raiz descreva **o projeto como ele é agora**, não como era quando foi escrito. README desatualizado é pior que README ausente: ele faz alguém seguir instruções que não funcionam mais.

## Quando atualizar

Obrigatoriamente, sempre que mudar:

- a **stack** ou qualquer dependência estruturante;
- a **estrutura de pastas** ou os limites entre contextos;
- os **scripts** de `package.json` (rodar, testar, migrar, criar operador, exportar, expurgar);
- as **variáveis de ambiente** — toda variável nova entra no README e no `.env.example` na mesma mudança;
- as **rotas** públicas ou autenticadas;
- o procedimento de **deploy** ou de **contingência**;
- o **estado das tasks** — quando uma task de `.claude/tasks/` for concluída.

## Estrutura obrigatória do README.md

1. **O que é** — uma linha sobre o sistema e o evento que ele atende.
2. **Documentos** — links para `PRD.md`, `SDD.md`, `.claude/tasks/README.md` e `CONTEXT.md`, dizendo o que cada um responde.
3. **Stack** — o que está em uso, com uma linha de justificativa por peça.
4. **Estrutura de pastas** — árvore comentada, com a regra de fronteira entre contextos.
5. **Como rodar** — pré-requisitos, instalação, variáveis de ambiente, migrações, seed, subir local.
6. **Scripts** — tabela comando → o que faz.
7. **Rotas** — tabela rota → público/autenticado → função.
8. **Testes** — como rodar unidade, integração, e2e e carga.
9. **Deploy** — ambiente, o que verificar antes, como reverter.
10. **Estado do projeto** — progresso das tasks, resumido.

## Regras

- **Português**, consistente com os demais documentos.
- Comandos exatos, copiáveis, testados. Nunca escrever um comando sem ter certeza de que ele existe no `package.json`.
- Nenhum segredo, credencial ou URL interna no README. Variáveis de ambiente aparecem **por nome e propósito**, nunca por valor.
- Terminologia do projeto: usar **Pitch**, não "Pista" (SDD §3), até que o organizador decida o contrário.
- Não duplicar o PRD nem o SDD. O README diz **como operar o repositório**; o PRD diz o que o produto faz; o SDD diz por que a arquitetura é essa.
- Seção que ficou falsa é removida ou corrigida na mesma mudança que a tornou falsa — nunca deixada "para depois".

## Procedimento

1. Ler o `README.md` atual.
2. Comparar cada seção com o estado real do repositório: `package.json`, estrutura de `src/`, rotas em `app/`, `.env.example`, `.claude/tasks/`.
3. Corrigir o que divergiu; acrescentar o que faltou; remover o que deixou de existir.
4. Verificar que todo comando citado existe de fato.
5. Se a mudança envolveu decisão ou raciocínio, aplicar também a skill `documentar-contexto`.
6. Informar ao usuário, em uma linha, o que foi atualizado.
