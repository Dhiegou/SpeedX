import { db } from '@/db'
import type { Pitch } from '@/contexts/inscricao/contrato'
import {
  adicionarTentativa,
  type ComandoDeInclusao,
  type ResultadoDeInclusao,
} from './adicionarTentativa'
import {
  buscarParticipantes,
  contarPendentes,
  estadoDaTentativa,
  historicoDaTentativa,
  listarFila,
  type Pagina,
} from './consultas'
import {
  corrigirTempo,
  marcarAusente,
  registrarTempo,
  type ComandoDeLancamento,
  type ResultadoDeLancamento,
} from './lancamento'
import type {
  EstadoDaTentativa,
  ItemDaFila,
  LancamentoRegistrado,
  ParticipanteEncontrado,
} from './modelo'

/**
 * Composição do contexto: liga os casos de uso à conexão real.
 *
 * Mesmo papel de `inscricao/servico.ts` e `identidade/servico.ts`. O lint
 * proíbe `app/**` de importar `@/db`, e é essa proibição que sustenta a
 * restrição 3 do anexo do PRD — nenhuma consulta parte de rota ou componente.
 * As rotas de T10 entram por aqui.
 *
 * Deixar cada caso de uso receber o banco por parâmetro é o que permite ao
 * teste rodar contra Postgres em WebAssembly sem simular nada do que importa.
 */

export function registrar(comando: ComandoDeLancamento): Promise<ResultadoDeLancamento> {
  return registrarTempo(db(), comando)
}

export function corrigir(comando: ComandoDeLancamento): Promise<ResultadoDeLancamento> {
  return corrigirTempo(db(), comando)
}

export function ausentar(
  comando: Omit<ComandoDeLancamento, 'tempoMs'>,
): Promise<ResultadoDeLancamento> {
  return marcarAusente(db(), comando)
}

export function incluirTentativa(comando: ComandoDeInclusao): Promise<ResultadoDeInclusao> {
  return adicionarTentativa(db(), comando)
}

export function fila(
  pitch: Pitch,
  filtro?: { busca?: string; limite?: number },
): Promise<Pagina<ItemDaFila>> {
  return listarFila(db(), pitch, filtro)
}

export function procurarParticipantes(filtro: {
  busca: string
  limite?: number
}): Promise<Pagina<ParticipanteEncontrado>> {
  return buscarParticipantes(db(), filtro)
}

export function estadoDe(tentativaId: string): Promise<EstadoDaTentativa | null> {
  return estadoDaTentativa(db(), tentativaId)
}

export function pendentes(pitch: Pitch): Promise<number> {
  return contarPendentes(db(), pitch)
}

export function historico(tentativaId: string): Promise<readonly LancamentoRegistrado[]> {
  return historicoDaTentativa(db(), tentativaId)
}
