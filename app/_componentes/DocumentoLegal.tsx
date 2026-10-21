import estilos from '../termo/termo.module.css'
import Cabecalho, { type Rota } from './Cabecalho'
import Rodape from './Rodape'
import type { BlocoDeDocumento, DocumentoLegal } from '@/contexts/inscricao/documentos'

/**
 * Página de documento informativo: `/privacidade` e `/termos` (D-109).
 *
 * Usa as classes do `/termo`, e não um módulo próprio: os três são texto para
 * ser lido, com a mesma medida de linha e o mesmo índice. Um segundo módulo
 * com as mesmas regras divergiria na primeira correção feita em um só.
 */

function Bloco({ bloco }: { bloco: BlocoDeDocumento }) {
  if (bloco.tipo === 'lista') {
    return (
      <ul>
        {bloco.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  if (bloco.tipo === 'remissao') {
    return (
      <p>
        {bloco.texto}{' '}
        <a className={estilos.linkEmTexto} href={bloco.href}>
          {bloco.rotulo}
        </a>
        .
      </p>
    )
  }

  return <p>{bloco.texto}</p>
}

export default function PaginaDeDocumento({
  documento,
  atual,
}: {
  documento: DocumentoLegal
  atual: Rota
}) {
  return (
    <>
      <Cabecalho atual={atual} />

      <main className={estilos.pagina}>
        <h1 className={estilos.titulo}>{documento.titulo}</h1>

        <p className={estilos.versao}>
          Versão {documento.versao}, publicada em {documento.publicadoEm}.
        </p>

        <nav className={estilos.indice} aria-label={`Seções: ${documento.titulo}`}>
          <p className={estilos.indiceTitulo}>Nesta página</p>
          <ul className={estilos.indiceLista}>
            {documento.secoes.map((secao) => (
              <li key={secao.id}>
                <a className={estilos.indiceLink} href={`#${secao.id}`}>
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {documento.secoes.map((secao) => (
          <section key={secao.id} id={secao.id} className={estilos.secao}>
            <h2 className={estilos.secaoTitulo}>{secao.titulo}</h2>
            {secao.blocos.map((bloco, indice) => (
              <Bloco key={`${secao.id}-${String(indice)}`} bloco={bloco} />
            ))}
          </section>
        ))}
      </main>

      <Rodape />
    </>
  )
}
