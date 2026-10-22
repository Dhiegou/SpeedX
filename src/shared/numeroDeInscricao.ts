/**
 * O número de inscrição, do jeito que a pessoa o vê e o digita (D-112).
 *
 * No banco é um inteiro; os zeros à esquerda são só exibição. Mora em `shared/`
 * porque três lugares precisam da mesma regra e nenhum pode importar o outro: a
 * tela de confirmação (Inscrição), a busca no navegador (Classificação) e a
 * busca do painel (Cronometragem). Se a leitura divergir, "0847" acha a pessoa
 * na arquibancada e não acha no painel, ou o contrário.
 */

/** Quatro dígitos: 2000 inscritos previstos cabem com folga. */
const DIGITOS = 4

/** 847 → "0847". Acima de 9999 sai como é, sem cortar nada. */
export function formatarNumero(numero: number): string {
  return String(numero).padStart(DIGITOS, '0')
}

/**
 * O que a pessoa digitou, lido como número de inscrição, ou `null` se não for.
 *
 * Aceita "847", "0847" e "#847": é como o número aparece na confirmação e como
 * alguém o repete em voz alta. Nenhum nome contém dígito, porque o validador
 * só aceita letras, espaço, hífen e apóstrofo, então não há ambiguidade entre
 * as duas buscas.
 */
export function lerNumero(termo: string): number | null {
  const limpo = termo.trim().replace(/^#/, '')

  if (!/^\d{1,9}$/.test(limpo)) return null

  const numero = Number(limpo)

  return numero > 0 ? numero : null
}
