import type { NextRequest } from 'next/server'
import { incluirTentativa } from '@/contexts/cronometragem/servico'
import { esquemaInclusao } from '@/contexts/cronometragem/schema'
import { exigirOperadorNaApi } from '@/contexts/identidade/servico'
import { comRegistro, falha, lerCorpo, responder } from '../_apoio'
import { serializarTentativa } from '../_traduzir'

/**
 * `POST /api/painel/tentativa` — inclui alguém num Pitch adicional (RF-24).
 *
 * O caso real: a pessoa se inscreveu só no Pitch 1, viu a corrida e resolveu
 * disputar o 2. Sem isto, o Operador a mandaria preencher o formulário de novo
 * e o evento acabaria com dois cadastros da mesma pessoa — o que estraga a
 * Exportação, a Classificação e o expurgo de T15 de uma vez só.
 *
 * **Sem chave de idempotência, e isso é deliberado.** A unicidade
 * `(participante_id, pitch)` no banco já torna a operação idempotente por
 * construção: o reenvio esbarra na constraint e volta como `409 ja_existe`, que
 * é a mesma informação que uma chave devolveria. Acrescentar chave aqui seria
 * cerimônia sem efeito.
 *
 * A Tentativa nasce Pendente e **sem autoria** — a constraint de T02 exige
 * `operador_id` nulo nesse estado. Consequência conhecida e anotada em T21:
 * não fica registrado quem incluiu.
 */

export function POST(request: NextRequest): Promise<Response> {
  return comRegistro('cronometragem.inclusao', async () => {
    const guarda = await exigirOperadorNaApi()
    if (!guarda.autorizado) {
      return {
        resposta: guarda.resposta,
        registro: { resultado: 'recusada', motivo: 'sem_sessao' },
      }
    }

    const corpo = await lerCorpo(request)
    if (!corpo.ok) {
      return { resposta: corpo.resposta, registro: { resultado: 'recusada', motivo: corpo.motivo } }
    }

    const analise = esquemaInclusao.safeParse(corpo.corpo)
    if (!analise.success) {
      const erros = analise.error.issues.map((i) => ({
        campo: i.path.join('.') || '(raiz)',
        mensagem: i.message,
      }))

      return {
        resposta: responder({ erros }, 422),
        registro: { resultado: 'recusada', motivo: 'validacao', campos: erros.map((e) => e.campo) },
      }
    }

    const resultado = await incluirTentativa(analise.data)

    switch (resultado.situacao) {
      case 'criada':
        return {
          resposta: responder({ tentativa: serializarTentativa(resultado.tentativa) }, 201),
          registro: { resultado: 'sucesso', referencia: resultado.tentativa.id },
        }

      case 'ja_existe':
        return {
          resposta: falha(
            'tentativa_ja_existe',
            'Esta pessoa já tem uma tentativa neste Pitch.',
            409,
          ),
          registro: { resultado: 'recusada', motivo: 'ja_existe' },
        }

      case 'participante_inexistente':
        return {
          resposta: falha('participante_inexistente', 'Este participante não existe.', 404),
          registro: { resultado: 'recusada', motivo: 'participante_inexistente' },
        }

      case 'pitch_invalido':
        return {
          resposta: falha('pitch_invalido', 'Informe pitch 1 ou 2.', 400),
          registro: { resultado: 'recusada', motivo: 'pitch_invalido' },
        }
    }
  })
}
