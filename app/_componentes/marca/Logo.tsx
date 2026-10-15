import SpeedX from './SpeedX'
import estilos from './marca.module.css'

/**
 * A marca SpeedX no cabeçalho.
 *
 * **O selo "POWERED BY PrinterX" saiu em 2026-10-14**, a pedido de quem decide
 * a identidade. O componente continua existindo por um motivo que não mudou:
 * logotipo tem proporção e alinhamento definidos, e se cada tela compuser o
 * SVG por conta própria, a segunda já sai diferente da primeira.
 *
 * O vetor do selo não se perdeu — ele vive em `docs/marca/`, que é arquivo e
 * não é servido. Voltar é acrescentar o componente aqui de novo.
 *
 * **A âncora envolve a marca e nada mais**, para que o nome do link diga apenas
 * para onde ele vai.
 *
 * **Âncora comum, não o `Link` do Next**, pelo mesmo motivo medido do
 * cabeçalho: o roteador de cliente custa 4,7 KB gzip no primeiro carregamento.
 */
export default function Logo({ href }: { href?: string }) {
  const marca = <SpeedX className={estilos.speedx} />

  return (
    <div className={estilos.bloco}>
      {href === undefined ? (
        marca
      ) : (
        <a href={href} className={estilos.link} aria-label="SpeedX, ir para a inscrição">
          {marca}
        </a>
      )}
    </div>
  )
}
