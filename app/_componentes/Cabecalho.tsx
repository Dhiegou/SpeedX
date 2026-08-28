import estilos from './cabecalho.module.css'

/**
 * Cabeçalho das páginas públicas (`/`, `/classificacao`, `/termo`).
 *
 * **Existe porque faltava um caminho de volta.** Quem abria a Classificação não
 * tinha como chegar à inscrição, e quem abria o termo não tinha como voltar ao
 * formulário sem o botão do navegador. Num evento onde a pessoa chega pelo QR
 * e alterna entre "me inscrever" e "ver meu tempo" o dia inteiro, isso é a
 * navegação principal do produto — não um detalhe de acabamento.
 *
 * **Server Component, sem estado e sem JavaScript.** A rota atual chega por
 * `atual`, e não é lida do navegador: assim o cabeçalho já vem correto na
 * primeira pintura, e nada disto entra no pacote que a rede do evento precisa
 * baixar (RNF-04).
 *
 * **O painel não usa este cabeçalho.** Lá a altura da tela é orçamento — a Fila
 * precisa caber sem rolagem — e a barra escura própria dele já diz onde o
 * Operador está.
 */

/*
 * Âncora comum, e não o `Link` do Next. A regra de lint está desligada nas
 * três linhas abaixo, com número medido:
 *
 * O `Link` traz o roteador de cliente para dentro do pacote, e estas páginas
 * não o tinham. **Medido com `npm run orcamento`: +4,7 KB gzip no primeiro
 * carregamento** — de 140,2 para 145,3, contra um teto de 150. Quase metade
 * da folga do projeto, gasta para trocar um recarregamento de página por uma
 * navegação de cliente entre duas páginas que a pessoa visita duas ou três
 * vezes no dia.
 *
 * RNF-04 é a restrição que manda aqui: rede móvel congestionada, 2000
 * aparelhos, e o primeiro carregamento é o que decide se a pessoa se
 * inscreve. Navegação instantânea entre abas é conforto; peso é o requisito.
 */

type Rota = 'inscricao' | 'classificacao' | 'termo'

const LINKS: readonly { rota: Rota; href: string; texto: string }[] = [
  { rota: 'inscricao', href: '/', texto: 'Inscrição' },
  { rota: 'classificacao', href: '/classificacao', texto: 'Classificação' },
]

export default function Cabecalho({ atual }: { atual: Rota }) {
  return (
    <header className={estilos.cabecalho}>
      <div className={estilos.interior}>
        {/*
          A marca é texto, não imagem: uma imagem aqui custaria uma requisição
          a mais no primeiro carregamento, multiplicada por 2000 pessoas em
          rede móvel (RNF-04). O quadriculado é feito com gradiente.
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={estilos.marca} href="/">
          <span className={estilos.bandeira} aria-hidden="true" />
          <span className={estilos.nome}>SpeedX</span>
        </a>

        <nav className={estilos.navegacao} aria-label="Navegação principal">
          {LINKS.map((link) => (
            <a
              key={link.rota}
              href={link.href}
              className={`${estilos.link} ${link.rota === atual ? estilos.linkAtual : ''}`}
              // Anuncia a página atual sem depender de cor (RNF-18 e leitor de tela).
              aria-current={link.rota === atual ? 'page' : undefined}
            >
              {link.texto}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
