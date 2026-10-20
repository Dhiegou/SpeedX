/**
 * Palavras que o participante lê na tela.
 *
 * **PE-01 fechada em 2026-08-25: o termo oficial é Cockpit.** Não era escolha
 * entre "Pitch" e "Pista" — as duas estavam erradas. O evento não tem pista:
 * tem um cockpit, que é onde fica o simulador. A palavra que o supervisor vai
 * dizer no dia é a palavra que a tela mostra (SDD §3).
 *
 * **Eram dois até 2026-10-19** (D-107). Com um só, as telas deixaram de nomear
 * o Cockpit, e saíram daqui as formas que só existiam para "os dois" e "nos
 * dois". `nomeDoCockpit` ficou porque o resumo do expurgo ainda o imprime.
 *
 * O arquivo continua existindo depois de a pendência fechar, e por um motivo
 * melhor do que o que o criou: foi ele que fez a troca custar duas linhas em
 * vez de uma varredura por três telas. Se o organizador mudar de ideia de novo,
 * muda aqui.
 *
 * O gênero acompanha a palavra de propósito: "o Cockpit" e "a Pista" concordam
 * diferente, e uma constante só com o substantivo deixaria "escolha o Pista"
 * espalhado pela interface no dia da troca.
 *
 * **O identificador interno acompanhou a palavra** (T22, 2026-08-25). Por dois
 * dias o código chamou de `pitch` o que a tela chamava de Cockpit; a decisão de
 * manter assim durou o tempo de alguém perguntar se não era melhor renomear, e
 * era. O nome de uma coluna é lido por quem depura às sete da noite do dia do
 * evento, e nesse momento duas palavras para a mesma coisa custam mais que uma
 * migração feita com calma seis semanas antes.
 */
export const COCKPIT = {
  singular: 'Cockpit',
  plural: 'Cockpits',
  /** Artigo definido: `o` para Cockpit, `a` para Pista. */
  artigo: 'o',
  /** Artigo indefinido: `um` para Cockpit, `uma` para Pista. */
  artigoIndefinido: 'um',
} as const

/** `Cockpit 1` — o rótulo pelo número gravado em `tentativa.cockpit`. */
export function nomeDoCockpit(numero: number): string {
  return `${COCKPIT.singular} ${String(numero)}`
}
