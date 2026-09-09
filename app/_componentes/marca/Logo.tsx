import PrinterX from './PrinterX'
import SpeedX from './SpeedX'
import estilos from './marca.module.css'

/**
 * O bloqueio oficial da marca: SpeedX com o selo da patrocinadora (PRD-front §5.2).
 *
 * **Existe para que o par não seja remontado à mão em cada tela.** Logotipo com
 * patrocinador tem proporção e alinhamento definidos; se cada lugar compuser os
 * dois SVG por conta própria, o segundo lugar já sai diferente do primeiro.
 *
 * **O tamanho é a decisão que este componente carrega.** O selo precisa de uns
 * 150px para o "POWERED BY" sair legível, o que põe o bloqueio em 200px de
 * largura mínima — 56% de um aparelho de 360px. Está em `marca.module.css`,
 * junto do porquê.
 *
 * **A âncora envolve só a marca SpeedX, e não o selo.** Se envolvesse os dois, o
 * nome do link viraria "SpeedX, powered by PrinterX", e a patrocinadora passaria
 * a fazer parte do rótulo de um botão de navegação. Assim o link diz para onde
 * vai, e o selo se anuncia sozinho, como a imagem que é.
 *
 * **Âncora comum, não o `Link` do Next**, pelo mesmo motivo medido do cabeçalho:
 * o roteador de cliente custa 4,7 KB gzip no primeiro carregamento.
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
      <PrinterX className={estilos.selo} />
    </div>
  )
}
