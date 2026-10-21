/**
 * O cabeçalho com que a troca de tema pede para não recarregar a página (D-110).
 *
 * Mora fora de `tema.ts` porque aquele arquivo lê `next/headers`, que só existe
 * no servidor, e este nome precisa ser lido dos dois lados: por quem envia
 * (`TrocaDeTema.tsx`, no navegador) e por quem responde (`/api/tema`).
 */
export const CABECALHO_SEM_RECARGA = 'x-tema-sem-recarga'
