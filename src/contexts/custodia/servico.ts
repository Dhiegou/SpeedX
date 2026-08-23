import { db } from '@/db'
import {
  fluxoDaExportacaoCompleta,
  gerarListaDeRepasse,
  gerarPendencias,
  type TipoDeExportacao,
} from './exportacao'

/**
 * Composição do contexto: liga as exportações à conexão real.
 *
 * Mesmo papel de `inscricao/servico.ts`, `identidade/servico.ts` e
 * `cronometragem/servico.ts`. A rota não conhece banco — o lint recusa `@/db`
 * em `app/**`, e é essa proibição que sustenta a restrição 3 do anexo do PRD.
 */

/** A completa é fluxo; as outras duas cabem numa cadeia sem apertar nada. */
export function exportar(tipo: TipoDeExportacao): ReadableStream<Uint8Array> | Promise<string> {
  switch (tipo) {
    case 'completa':
      return fluxoDaExportacaoCompleta(db())
    case 'repasse':
      return gerarListaDeRepasse(db())
    case 'pendencias':
      return gerarPendencias(db())
  }
}
