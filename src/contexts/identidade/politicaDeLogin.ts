import { identificar, type Politica } from '@/infra/limiteDeTaxa'
import { env } from '@/shared/env'

/**
 * Contenção de tentativas de login.
 *
 * Duas contagens independentes, porque os dois ataques são diferentes:
 *
 *  - **por origem** trava quem varre muitas contas a partir de um lugar só;
 *  - **por usuário** trava quem varre muitas senhas contra uma conta só, de
 *    onde quer que venha. Sem esta, uma botnet distribuída passa direto.
 *
 * O que consome cota é a tentativa **recusada** — o oposto da regra do cadastro
 * público (D-27), e de propósito. No cadastro, contar a falha castigaria quem
 * digitou o telefone errado; aqui, contar só o sucesso não conteria nada.
 *
 * O desligamento de emergência `RATE_LIMIT_ATIVO` não alcança estas políticas.
 * Ele existe para destravar a fila de inscrição no dia do evento; destravar
 * junto a força bruta contra o painel seria um efeito colateral que ninguém
 * decidiu.
 */

export const ESCOPO_LOGIN_ORIGEM = 'login_origem'
export const ESCOPO_LOGIN_USUARIO = 'login_usuario'

function faixas(): readonly { limite: number; janelaMs: number }[] {
  const config = env()

  return [
    {
      limite: config.LOGIN_TENTATIVAS_POR_JANELA,
      janelaMs: config.LOGIN_JANELA_SEGUNDOS * 1000,
    },
  ]
}

export function politicaPorOrigem(): Politica {
  return { escopo: ESCOPO_LOGIN_ORIGEM, faixas: faixas() }
}

/**
 * Por conta, com o dobro da janela.
 *
 * Uma conta sob ataque distribuído recebe tentativas de muitos lugares, e cada
 * um deles tem sua própria cota por origem. A faixa por usuário precisa ser
 * mais paciente no tempo para que a soma delas ainda esbarre em algo.
 */
export function politicaPorUsuario(): Politica {
  const config = env()

  return {
    escopo: ESCOPO_LOGIN_USUARIO,
    faixas: [
      {
        limite: config.LOGIN_TENTATIVAS_POR_JANELA,
        janelaMs: config.LOGIN_JANELA_SEGUNDOS * 2 * 1000,
      },
    ],
  }
}

/** HMAC do endereço de origem. O endereço em claro nunca chega ao banco. */
export function identificarOrigem(endereco: string | null): string | null {
  return identificar(endereco, 'origem')
}

/**
 * HMAC do nome de usuário, sem distinção de caixa.
 *
 * Sem o `toLowerCase`, `Marina` e `marina` teriam baldes separados e a
 * contenção por conta seria contornável trocando a caixa da primeira letra.
 */
export function identificarUsuario(usuario: string | null): string | null {
  return identificar(usuario?.toLowerCase() ?? null, 'usuario')
}
