import type { Metadata } from 'next'
import { TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'
import type { Bloco, Secao } from '@/contexts/inscricao/consentimento'

/**
 * `/termo` — texto integral do consentimento (T03, item 5 do escopo).
 *
 * Rota própria, e não modal dentro do formulário, por três motivos: o
 * participante precisa conseguir abrir o termo antes de começar a preencher,
 * o organizador precisa de um endereço para citar por escrito, e a ficha de
 * papel de T20 precisa apontar para algum lugar.
 *
 * É Server Component e não recebe nem envia nada: o texto é constante do
 * módulo de Inscrição, resolvido em build. Nenhuma consulta parte do navegador
 * (restrição 3 do anexo do PRD), porque não há consulta.
 */

export const metadata: Metadata = {
  title: 'Termo de consentimento — SpeedX',
  description: 'Quais dados a corrida coleta, para que servem e como pedir exclusão.',
}

const CINZA_BORDA = '#d4d4d4'

function BlocoDoTermo({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === 'lista') {
    return (
      <ul>
        {bloco.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  return <p>{bloco.texto}</p>
}

function SecaoDoTermo({ secao }: { secao: Secao }) {
  // O destaque vem do dado, não de uma decisão tomada aqui: RF-09 exige que a
  // exposição pública do nome seja declarada de forma destacada, e é o termo
  // que sabe qual seção é essa.
  const estilo = secao.destaque
    ? {
        border: `2px solid ${CINZA_BORDA}`,
        borderLeftWidth: '6px',
        borderLeftColor: '#111',
        padding: '0.25rem 1rem 1rem',
        background: '#fafafa',
      }
    : undefined

  return (
    <section id={secao.id} style={estilo}>
      <h2 style={{ fontSize: '1.125rem' }}>{secao.titulo}</h2>
      {secao.blocos.map((bloco, indice) => (
        <BlocoDoTermo key={`${secao.id}-${String(indice)}`} bloco={bloco} />
      ))}
    </section>
  )
}

export default function TermoPage() {
  const termo = TERMO_VIGENTE

  return (
    <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>{termo.titulo}</h1>

      <p style={{ color: '#555', fontSize: '0.875rem' }}>
        Versão {termo.versao}, publicada em {termo.publicadoEm}.
      </p>

      {/*
        O aviso de rascunho é intencionalmente visível ao público. Enquanto
        faltar o canal de exclusão (PE-03) e a aprovação do organizador
        (PE-04), esconder a situação da versão seria apresentar como definitivo
        um texto que ainda pode mudar.
      */}
      {termo.situacao === 'rascunho' && (
        <aside
          style={{
            border: `1px solid ${CINZA_BORDA}`,
            padding: '0.75rem 1rem',
            margin: '1rem 0',
            background: '#fff8e1',
          }}
        >
          <strong>Rascunho.</strong> Esta versão ainda está em revisão e não vale como termo
          definitivo. Pendências:
          <ul>
            {termo.pendencias.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </aside>
      )}

      {termo.secoes.map((secao) => (
        <SecaoDoTermo key={secao.id} secao={secao} />
      ))}

      <section id="aceite">
        <h2 style={{ fontSize: '1.125rem' }}>O que você marca no formulário</h2>

        {termo.aceites.map((aceite) => (
          <div key={aceite.id}>
            <h3 style={{ fontSize: '1rem' }}>
              {aceite.aplicaSe === 'menor-de-18'
                ? 'Se o participante tem menos de 18 anos'
                : aceite.obrigatorio
                  ? 'Obrigatório'
                  : 'Opcional (pode ficar desmarcado)'}
            </h3>
            <blockquote
              style={{ borderLeft: `3px solid ${CINZA_BORDA}`, margin: 0, padding: '0 1rem' }}
            >
              <p>{aceite.texto}</p>
            </blockquote>
          </div>
        ))}
      </section>
    </main>
  )
}
