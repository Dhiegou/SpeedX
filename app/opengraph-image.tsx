import { ImageResponse } from 'next/og'
import { COCKPIT } from '@/shared/vocabulario'

/**
 * O cartão que aparece quando alguém compartilha o link (PRD-front §5.7).
 *
 * **Não custa nada ao participante.** Quem baixa esta imagem é o rastreador do
 * WhatsApp, uma vez, do lado dele. O navegador de quem abre o site nunca a
 * pede, então ela fica inteiramente fora do orçamento de RNF-04 — que é o
 * motivo de ser a única imagem do projeto.
 *
 * Gerada por código, e não guardada como arquivo, por duas razões: um PNG de
 * 1200×630 no repositório é um binário que ninguém revisa, e a imagem lê as
 * mesmas cores e o mesmo vocabulário (D-73) que as telas — se o Cockpit voltar
 * a se chamar outra coisa, o cartão acompanha sem alguém lembrar de reexportar.
 *
 * É estática: o Next a gera no build e serve de cache. Nada aqui roda por
 * requisição.
 */

export const alt = 'SpeedX — inscrição e classificação da corrida'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* As cores são as da marca, e são literais porque esta imagem é montada fora do
   navegador, onde não existe variável de CSS.

   O cartão é preto pelo mesmo motivo que o cabeçalho é: as quatro cores da marca
   reprovam em contraste sobre branco e passam sobre preto, e a prévia de um link
   é o primeiro lugar onde alguém vê esta identidade. */
const PRETO = '#000000'
const ROSA = '#ED145B'
const LARANJA = '#E46124'
const AMARELO = '#FFE206'
const SOBRE_AREA = '#ffffff'
const SOBRE_AREA_SUAVE = '#c9c9ce'

export default function CartaoDeCompartilhamento(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: PRETO,
        padding: '72px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* A mesma faixa que abre toda página do site: as três cores do logotipo,
          na mesma ordem em que aparecem nele. */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 14,
          background: `linear-gradient(90deg, ${ROSA} 0%, ${LARANJA} 55%, ${AMARELO} 100%)`,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 148,
            fontWeight: 800,
            color: SOBRE_AREA,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          SpeedX
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 46,
            color: SOBRE_AREA_SUAVE,
            letterSpacing: '-0.01em',
          }}
        >
          Inscrição e classificação da corrida
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: 30,
          color: SOBRE_AREA_SUAVE,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {COCKPIT.plural} · Resultados ao vivo
      </div>
    </div>,
    size,
  )
}
