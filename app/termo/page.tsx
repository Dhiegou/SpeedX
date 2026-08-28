import type { Metadata } from 'next'
import estilos from './termo.module.css'
import Cabecalho from '../_componentes/Cabecalho'
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
 *
 * **A apresentação foi refeita depois de T21.** Os estilos eram atributos
 * `style` no meio do componente — os únicos do projeto que não liam os tokens,
 * o que deixava esta página com cara de outro produto. Vieram junto duas
 * coisas que faltavam a quem lê: um **índice**, porque a pergunta que traz
 * alguém aqui costuma ser uma só ("o que vocês publicam?"), e um **caminho de
 * volta** para a inscrição, que só existia pelo botão do navegador.
 */

export const metadata: Metadata = {
  title: 'Termo de consentimento — SpeedX',
  description: 'Quais dados a corrida coleta, para que servem e como pedir exclusão.',
}

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
  const classe =
    secao.destaque === true ? `${estilos.secao} ${estilos.secaoDestaque}` : estilos.secao

  return (
    <section id={secao.id} className={classe}>
      <h2 className={estilos.secaoTitulo}>{secao.titulo}</h2>
      {secao.blocos.map((bloco, indice) => (
        <BlocoDoTermo key={`${secao.id}-${String(indice)}`} bloco={bloco} />
      ))}
    </section>
  )
}

export default function TermoPage() {
  const termo = TERMO_VIGENTE

  return (
    <>
      <Cabecalho atual="termo" />

      <main className={estilos.pagina}>
        <h1 className={estilos.titulo}>{termo.titulo}</h1>

        <p className={estilos.versao}>
          Versão {termo.versao}, publicada em {termo.publicadoEm}.
        </p>

        {/*
          O aviso de rascunho é intencionalmente visível ao público. Enquanto a
          versão não estiver aprovada, esconder a situação seria apresentar como
          definitivo um texto que ainda pode mudar — e sob rascunho o sistema
          recusa registrar consentimento de qualquer forma (D-18).
        */}
        {termo.situacao === 'rascunho' && (
          <aside className={estilos.rascunho}>
            <strong>Rascunho.</strong> Esta versão ainda está em revisão e não vale como termo
            definitivo. Pendências:
            <ul>
              {termo.pendencias.map((pendencia) => (
                <li key={pendencia}>{pendencia}</li>
              ))}
            </ul>
          </aside>
        )}

        {/*
          O índice sai das próprias seções, e não de uma lista escrita à mão:
          uma seção nova no termo aparece aqui sozinha. Uma lista paralela seria
          mais uma coisa a esquecer de atualizar quando o texto mudar.
        */}
        <nav className={estilos.indice} aria-label="Seções do termo">
          <p className={estilos.indiceTitulo}>Neste termo</p>
          <ul className={estilos.indiceLista}>
            {termo.secoes.map((secao) => (
              <li key={secao.id}>
                <a className={estilos.indiceLink} href={`#${secao.id}`}>
                  {secao.titulo}
                </a>
              </li>
            ))}
            <li>
              <a className={estilos.indiceLink} href="#aceite">
                O que você marca no formulário
              </a>
            </li>
          </ul>
        </nav>

        {termo.secoes.map((secao) => (
          <SecaoDoTermo key={secao.id} secao={secao} />
        ))}

        <section id="aceite" className={estilos.secao}>
          <h2 className={estilos.secaoTitulo}>O que você marca no formulário</h2>

          {termo.aceites.map((aceite) => (
            <div
              key={aceite.id}
              className={`${estilos.aceite} ${aceite.obrigatorio ? '' : estilos.aceiteOpcional}`}
            >
              <p className={estilos.etiqueta}>
                {aceite.aplicaSe === 'menor-de-18'
                  ? 'Se o participante tem menos de 18 anos'
                  : aceite.obrigatorio
                    ? 'Obrigatório'
                    : 'Opcional — pode ficar desmarcado'}
              </p>
              <p className={estilos.textoAceite}>{aceite.texto}</p>
            </div>
          ))}
        </section>

        <footer className={estilos.rodape}>
          {/* Âncora comum pelo mesmo motivo do cabeçalho: peso (RNF-04). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className={estilos.voltar} href="/">
            Voltar para a inscrição
          </a>
        </footer>
      </main>
    </>
  )
}
