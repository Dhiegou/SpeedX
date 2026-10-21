import { createHash } from 'node:crypto'
import type { TermoConsentimento } from './modelo'

/**
 * Amarra o texto ao identificador de versão (critério de aceitação da T03).
 *
 * O risco real não é alguém publicar uma versão errada de propósito; é alguém
 * corrigir uma vírgula num arquivo de termo já aprovado e não trocar o
 * identificador. Os cadastros anteriores continuariam apontando para
 * `v1.0-…` — só que `v1.0-…` já não seria mais o texto que aquelas pessoas
 * leram, e ninguém perceberia.
 *
 * Por isso o hash do conteúdo de cada versão é declarado aqui, num arquivo
 * separado do texto: mexer no texto quebra a suíte, e a única forma de
 * fazê-la passar é registrar uma versão nova.
 *
 * **Este módulo importa `node:crypto` e por isso não é reexportado pela
 * fachada** — o texto do termo chega ao formulário de T06, que roda no
 * navegador. Quem precisa dele é a suíte de testes e a verificação de CI.
 */

/**
 * Serialização determinística do que é *conteúdo* do termo.
 *
 * Uma linha por elemento, cada uma com prefixo do seu tipo (`p:`, `i:`, …).
 * O prefixo é o que impede duas estruturas diferentes de produzirem a mesma
 * cadeia: um parágrafo e um item de lista com o mesmo texto não colidem.
 *
 * Fora do hash de propósito: `versao`, `situacao`, `publicadoEm` e
 * `pendencias`. São metadados do ciclo de publicação — aprovar um rascunho sem
 * tocar numa palavra do texto não pode exigir versão nova, e exigir tornaria a
 * regra tão incômoda que alguém acabaria contornando.
 *
 * Não se usa `JSON.stringify` porque a ordem das chaves e a presença de campos
 * opcionais entrariam no resultado: renomear um campo do modelo mudaria o hash
 * de textos idênticos.
 */
export function conteudoCanonico(termo: TermoConsentimento): string {
  const partes: string[] = [`titulo:${termo.titulo}`]

  for (const secao of termo.secoes) {
    const destaque = secao.destaque === true ? 'destaque' : 'normal'
    partes.push(`secao:${secao.id}:${destaque}:${secao.titulo}`)

    for (const bloco of secao.blocos) {
      if (bloco.tipo === 'paragrafo') {
        partes.push(`p:${bloco.texto}`)
        continue
      }

      partes.push(`lista:${bloco.itens.length}`)
      for (const item of bloco.itens) {
        partes.push(`i:${item}`)
      }
    }
  }

  for (const aceite of termo.aceites) {
    // `obrigatorio` entra no hash porque transformar uma caixa opcional em
    // obrigatória muda o que a pessoa consentiu, ainda que nenhuma palavra do
    // texto mude. É alteração de termo, e precisa de versão nova.
    const condicao = aceite.aplicaSe ?? 'sempre'
    const exigencia = aceite.obrigatorio ? 'obrigatorio' : 'opcional'
    partes.push(`aceite:${aceite.id}:${exigencia}:${condicao}:${aceite.texto}`)
  }

  return partes.join('\n')
}

/** SHA-256 do conteúdo canônico, em hexadecimal. */
export function hashDoConteudo(termo: TermoConsentimento): string {
  return createHash('sha256').update(conteudoCanonico(termo), 'utf8').digest('hex')
}

/**
 * Hash declarado de cada versão publicada.
 *
 * Ao publicar uma versão nova: acrescente a entrada aqui, **sem alterar as
 * existentes**. Alterar uma entrada antiga para "consertar" um teste é
 * exatamente o defeito que este arquivo existe para impedir.
 */
export const HASHES_PUBLICADOS: Readonly<Record<string, string>> = {
  'v1.0-2026-08-19': '9614118b061d5922172c67b63eb1e2408cf745c3a13045edbee241f64e3541c4',
  'v1.1-2026-10-14': 'eb93b14a7e24c5566262cbb083e7ad926251e3f535b4b845cd1b42617695b753',
  'v1.2-2026-10-21': '43f42f5a8b2527a0efd868220df2ae1ce60ef75bdb3cf1ab3f12d2d0c89cafdb',
}
