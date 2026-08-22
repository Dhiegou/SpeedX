import { env } from '@/shared/env'
import { identificar, type Politica } from '@/infra/limiteDeTaxa'

/**
 * A política de limite do cadastro público (RNF-12).
 *
 * O mecanismo — janela deslizante sobre `limite_taxa` — mudou-se para
 * `@/infra/limiteDeTaxa` em T08, quando o login do Operador passou a precisar
 * dele e Identidade não pôde importar Inscrição. O que ficou aqui é a única
 * parte que é decisão de Inscrição: quantos cadastros, em quanto tempo, e o que
 * conta como consumo.
 *
 * **Só cadastro concluído consome cota.** Errar a validação não gasta nada. O
 * contrário — contar toda requisição — transforma alguém que digitou o telefone
 * errado quatro vezes em suspeito, e o custo de bloquear participante legítimo
 * é maior que o de aceitar um cadastro falso a mais (RNF-15, PRD §7).
 */

export const ESCOPO_CADASTRO = 'cadastro'

/** HMAC do endereço de origem. O endereço em claro nunca chega ao banco. */
export function identificarOrigem(endereco: string | null): string | null {
  return identificar(endereco, 'origem')
}

/**
 * Faixas vigentes, lidas do ambiente a cada chamada.
 *
 * `RATE_LIMIT_ATIVO` desliga o limite devolvendo **nenhuma faixa**, e não um
 * sinalizador que o mecanismo comum teria de conhecer. A alavanca existe para o
 * dia do evento: se o limite começar a recusar gente de verdade, a alternativa
 * seria publicar código novo com o ponto de inscrição em fila. Ela vale só para
 * o cadastro — o limite de tentativas de senha do painel não obedece a ela.
 */
export function politicaCadastro(): Politica {
  const config = env()

  if (!config.RATE_LIMIT_ATIVO) return { escopo: ESCOPO_CADASTRO, faixas: [] }

  return {
    escopo: ESCOPO_CADASTRO,
    faixas: [
      {
        limite: config.RATE_LIMIT_CADASTROS_POR_JANELA,
        janelaMs: config.RATE_LIMIT_JANELA_SEGUNDOS * 1000,
      },
      { limite: config.RATE_LIMIT_CADASTROS_POR_HORA, janelaMs: 60 * 60 * 1000 },
    ],
  }
}

export { consumirLimite, verificarLimite, type VereditoLimite } from '@/infra/limiteDeTaxa'
