import type { Comando } from './fluxo'

/**
 * As chamadas do painel à API de T10.
 *
 * Separado do componente para que o tratamento de falha seja legível — e ele é
 * a parte que mais importa aqui. O escopo 4 da T11 pede três comportamentos que
 * um `fetch` cru não dá:
 *
 *  1. **rede caída é diferente de recusa do servidor.** A primeira se repete
 *     com a mesma chave; a segunda não adianta repetir.
 *  2. **a mensagem do 409 vem pronta do servidor** (T10 monta "Tempo 01:23.45
 *     já registrado por Marina Costa às 14:32"). A tela exibe, não reescreve.
 *  3. **nada some da tela por causa de erro.** Quem decide isso é o redutor,
 *     que guarda o comando; aqui só se classifica o que aconteceu.
 */

export type Falha = {
  readonly mensagem: string
  /**
   * Se repetir tem chance de dar certo.
   *
   * Rede e 5xx: sim, e com a **mesma chave**, que é o que impede o reenvio de
   * virar um segundo Lançamento. Um 409 ou 422: não — repetir produz o mesmo
   * resultado, e um botão que promete o contrário faz o Operador insistir em
   * vez de olhar para o que a mensagem diz.
   */
  readonly podeRepetir: boolean
}

export type Resultado<T> =
  { readonly ok: true; readonly dados: T } | { readonly ok: false; readonly falha: Falha }

const SEM_REDE = 'Sem conexão com o servidor. O que você digitou está guardado — toque em repetir.'

async function chamar<T>(url: string, init?: RequestInit): Promise<Resultado<T>> {
  let resposta: Response

  try {
    resposta = await fetch(url, init)
  } catch {
    return { ok: false, falha: { mensagem: SEM_REDE, podeRepetir: true } }
  }

  if (resposta.ok) return { ok: true, dados: (await resposta.json()) as T }

  if (resposta.status === 401) {
    return {
      ok: false,
      falha: { mensagem: 'Sua sessão terminou. Entre de novo para continuar.', podeRepetir: false },
    }
  }

  let mensagem = 'Não foi possível concluir a operação.'

  try {
    const corpo = (await resposta.json()) as {
      erro?: { mensagem?: string }
      erros?: { mensagem?: string }[]
    }
    // A mensagem do servidor é a que já vem escrita para quem está com fila na
    // frente. Substituí-la por uma genérica apagaria o nome e a hora do conflito.
    mensagem = corpo.erro?.mensagem ?? corpo.erros?.[0]?.mensagem ?? mensagem
  } catch {
    /* corpo ilegível: fica a frase genérica */
  }

  return { ok: false, falha: { mensagem, podeRepetir: resposta.status >= 500 } }
}

const JSON_POST = (corpo: unknown, metodo = 'POST'): RequestInit => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo),
})

export type ItemDaFila = {
  tentativaId: string
  participanteId: string
  nome: string
  sobrenome: string
  ultimos4Telefone: string
  inscritoEm: string
}

export type RespostaDaFila = {
  cockpit: number
  pendentes: number
  truncado: boolean
  itens: ItemDaFila[]
}

export function buscarFila(cockpit: number, busca: string, sinal?: AbortSignal) {
  const parametros = new URLSearchParams({ cockpit: String(cockpit) })
  if (busca.trim() !== '') parametros.set('busca', busca.trim())

  return chamar<RespostaDaFila>(`/api/painel/fila?${parametros.toString()}`, { signal: sinal })
}

export type TentativaEncontrada = {
  tentativaId: string
  cockpit: number
  estado: 'pendente' | 'valida' | 'ausente'
  tempoMs: number | null
  tempo: string | null
  resolvidoEm: string | null
}

export type ParticipanteEncontrado = {
  participanteId: string
  nome: string
  sobrenome: string
  ultimos4Telefone: string
  tentativas: TentativaEncontrada[]
}

export function buscarParticipantes(busca: string, sinal?: AbortSignal) {
  return chamar<{ truncado: boolean; itens: ParticipanteEncontrado[] }>(
    `/api/painel/participante?busca=${encodeURIComponent(busca.trim())}`,
    { signal: sinal },
  )
}

export type Lancamento = {
  id: string
  tipo: string
  tempoAnterior: string | null
  tempoNovo: string | null
  operador: string
  hora: string
}

export function buscarHistorico(tentativaId: string) {
  return chamar<{ lancamentos: Lancamento[] }>(`/api/painel/tentativa/${tentativaId}/historico`)
}

export function incluirNoCockpit(participanteId: string, cockpit: number) {
  return chamar<unknown>('/api/painel/tentativa', JSON_POST({ participanteId, cockpit }))
}

/**
 * Executa o comando que a confirmação aprovou.
 *
 * Recebe o `Comando` inteiro, com a chave que nasceu junto dele — é isto que
 * faz a retentativa reusar a mesma chave em vez de gerar outra (FL-06).
 */
export function executar(comando: Comando): Promise<Resultado<unknown>> {
  switch (comando.tipo) {
    case 'registrar':
      return chamar(
        '/api/painel/tempo',
        JSON_POST({
          tentativaId: comando.alvo.tentativaId,
          tempo: comando.tempoTexto,
          chave: comando.chave,
        }),
      )

    case 'corrigir':
      return chamar(
        '/api/painel/tempo',
        JSON_POST(
          {
            tentativaId: comando.alvo.tentativaId,
            tempo: comando.tempoTexto,
            chave: comando.chave,
          },
          'PATCH',
        ),
      )

    case 'ausentar':
      return chamar(
        '/api/painel/ausencia',
        JSON_POST({
          tentativaId: comando.alvo.tentativaId,
          chave: comando.chave,
        }),
      )
  }
}
