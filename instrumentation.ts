/**
 * Executado uma vez, no start do servidor, antes de atender qualquer requisição.
 *
 * É aqui que a configuração inválida vira falha imediata e visível, em vez de
 * virar erro 500 no meio do evento (RNF-05).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { env } = await import('@/shared/env')
  env()
}
