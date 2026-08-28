import type { ResultadoDeLancamento, TentativaResolvida } from '@/contexts/cronometragem'
import { formatHoraDoEvento, formatTempo } from '@/shared/tempo'
import { falha, responder, type Registro } from './_apoio'

/**
 * Situação do domínio → resposta HTTP, para as três rotas que fazem transição.
 *
 * O `switch` é exaustivo sobre a união fechada de `ResultadoDeLancamento`: uma
 * situação nova sem tradução aqui **não compila**, em vez de virar 500
 * silencioso no meio do evento.
 */

/**
 * A Tentativa como o painel a recebe.
 *
 * `tempo` vem formatado ao lado de `tempoMs` porque RF-17 pede que o valor seja
 * "reexibido idêntico", e a única formatação autorizada no sistema é a de
 * `shared/tempo.ts`. Deixar o navegador formatar criaria a segunda
 * implementação de arredondamento que aquele módulo existe para impedir.
 */
export function serializarTentativa(t: TentativaResolvida) {
  return {
    tentativaId: t.id,
    participanteId: t.participanteId,
    cockpit: t.cockpit,
    estado: t.estado,
    tempoMs: t.tempoMs,
    tempo: t.tempoMs === null ? null : formatTempo(t.tempoMs),
    resolvidoEm: t.resolvidoEm?.toISOString() ?? null,
  }
}

/**
 * A mensagem de conflito de RF-12, montada para ser exibida sem edição.
 *
 * A task pede literalmente "Tempo já registrado por {operador} às {hora}". Só
 * dá para dizer isso quando há operador e instante — o que acontece no caso
 * comum, dois Operadores lançando a mesma pessoa. Nos demais (corrigir quem não
 * tem tempo, ausentar quem já correu) vale a explicação do domínio, que já é
 * escrita para quem está com fila de gente esperando.
 */
function mensagemDeConflito(
  resultado: Extract<ResultadoDeLancamento, { situacao: 'transicao_recusada' }>,
): string {
  const { estadoAtual, tempoMsAtual, resolvidoEmAtual, operadorAtual } = resultado

  if (estadoAtual !== 'valida' || tempoMsAtual === null) return resultado.mensagem
  if (operadorAtual === null || resolvidoEmAtual === null) return resultado.mensagem

  return (
    `Tempo ${formatTempo(tempoMsAtual)} já registrado por ${operadorAtual} ` +
    `às ${formatHoraDoEvento(resolvidoEmAtual)}. Para trocar o valor, use a correção.`
  )
}

export function traduzirLancamento(resultado: ResultadoDeLancamento): {
  resposta: Response
  registro: Registro
} {
  switch (resultado.situacao) {
    case 'aplicado':
      return {
        resposta: responder({ tentativa: serializarTentativa(resultado.tentativa) }, 201),
        registro: { resultado: 'sucesso', referencia: resultado.tentativa.id },
      }

    case 'repetida':
      // 200, e não 201: nada foi criado agora. O corpo é o da primeira vez.
      return {
        resposta: responder({ tentativa: serializarTentativa(resultado.tentativa) }, 200),
        registro: { resultado: 'repetida', motivo: 'idempotencia' },
      }

    case 'transicao_recusada':
      return {
        resposta: falha('estado_conflitante', mensagemDeConflito(resultado), 409),
        registro: { resultado: 'recusada', motivo: `estado_${resultado.estadoAtual}` },
      }

    case 'tentativa_inexistente':
      return {
        resposta: falha('tentativa_inexistente', 'Esta tentativa não existe.', 404),
        registro: { resultado: 'recusada', motivo: 'tentativa_inexistente' },
      }

    case 'chave_ausente':
      return {
        resposta: falha(
          'chave_idempotencia_ausente',
          'Campo `chave` obrigatório, com um UUID gerado uma vez por lançamento.',
          400,
        ),
        registro: { resultado: 'recusada', motivo: 'chave_ausente' },
      }

    case 'chave_em_conflito':
      return {
        resposta: falha(
          'chave_idempotencia_em_conflito',
          'Esta chave já foi usada para outro lançamento. Gere uma nova.',
          409,
        ),
        registro: { resultado: 'recusada', motivo: 'chave_em_conflito' },
      }

    case 'tempo_invalido':
      return {
        resposta: responder({ erros: [{ campo: 'tempo', mensagem: resultado.mensagem }] }, 422),
        registro: { resultado: 'recusada', motivo: 'validacao', campos: ['tempo'] },
      }
  }
}
