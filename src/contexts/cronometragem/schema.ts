import { z } from 'zod'
import { parseTempo, TempoInvalidoError } from '@/shared/tempo'

/**
 * A forma dos comandos que chegam pela rede (T10, regra 7).
 *
 * Separado do caso de uso de propósito. `lancamento.ts` já confere a faixa do
 * Tempo e recusa chave malformada — e continua conferindo, porque o mesmo caso
 * de uso é alcançável pela digitação das fichas de papel de T20, que não passa
 * por aqui. Este arquivo cuida do que só existe no transporte: o corpo é um
 * objeto, os campos vieram, o Tempo veio como `mm:ss.cc` e não como número
 * inventado pelo cliente.
 *
 * O painel valida antes de enviar (T11). Isto aqui revalida do zero, porque
 * validação de interface é conveniência e a do servidor é a que vale
 * (restrição 2 do anexo do PRD).
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
  error: 'Identificador inválido: esperado um UUID.',
})

export const esquemaPitch = z.coerce
  .number()
  .int()
  .refine((v): v is 1 | 2 => v === 1 || v === 2, { error: 'Pitch deve ser 1 ou 2.' })

/**
 * O Tempo chega como texto `mm:ss.cc`, nunca como milissegundos.
 *
 * O Operador digita `01:23.45`; deixar o cliente mandar `83450` transferiria a
 * conversão para o navegador e criaria uma segunda implementação de
 * arredondamento — que é exatamente o que `shared/tempo.ts` existe para
 * impedir. Duas conversões divergentes produzem duas classificações diferentes
 * para os mesmos dados.
 */
export const esquemaTempo = z.string().transform((texto, ctx) => {
  try {
    return parseTempo(texto)
  } catch (erro) {
    ctx.addIssue({
      code: 'custom',
      message: erro instanceof TempoInvalidoError ? erro.message : 'Tempo inválido.',
    })
    return z.NEVER
  }
})

export const esquemaLancamento = z.object({
  tentativaId: uuid,
  tempo: esquemaTempo,
  chave: uuid,
})

export const esquemaAusencia = z.object({
  tentativaId: uuid,
  chave: uuid,
})

export const esquemaInclusao = z.object({
  participanteId: uuid,
  pitch: esquemaPitch,
})

/**
 * Termo de busca.
 *
 * Teto de 60 caracteres: um nome cabe, e uma cadeia de dez mil caracteres
 * enviada de propósito faria o `LIKE` percorrer a tabela comparando lixo.
 */
export const esquemaBusca = z.string().max(60, { error: 'Busca longa demais.' }).optional()

export type ComandoLancamentoValidado = z.infer<typeof esquemaLancamento>
export type ComandoAusenciaValidado = z.infer<typeof esquemaAusencia>
export type ComandoInclusaoValidado = z.infer<typeof esquemaInclusao>
