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

/* As cores são as mesmas de `globals.css`. Aqui elas são literais porque esta
   imagem é montada fora do navegador, onde não existe variável de CSS. */
const MARCA = '#12306b'
const MARCA_ESCURA = '#0b1f47'
const SOBRE_MARCA = '#ffffff'
const SOBRE_MARCA_SUAVE = '#cbd5e1'
const ACENTO = '#b45309'

export default function CartaoDeCompartilhamento(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: MARCA_ESCURA,
        padding: '72px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* A mesma faixa que abre toda página do site. */}
      <div style={{ display: 'flex', width: '100%', height: 14 }}>
        <div style={{ display: 'flex', width: '55%', background: MARCA }} />
        <div style={{ display: 'flex', width: '45%', background: ACENTO }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 148,
            fontWeight: 800,
            color: SOBRE_MARCA,
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
            color: SOBRE_MARCA_SUAVE,
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
          color: SOBRE_MARCA_SUAVE,
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
