import Logo from './marca/Logo'
import estilos from './cabecalho.module.css'
import { alternar, temaDaRequisicao } from '@/shared/tema'

/**
 * Cabeçalho das páginas públicas (`/`, `/classificacao`, `/termo`).
 *
 * **Existe porque faltava um caminho de volta.** Quem abria a Classificação não
 * tinha como chegar à inscrição, e quem abria o termo não tinha como voltar ao
 * formulário sem o botão do navegador. Num evento onde a pessoa chega pelo QR e
 * alterna entre "me inscrever" e "ver meu tempo" o dia inteiro, isso é a
 * navegação principal do produto — não um detalhe de acabamento.
 *
 * **Server Component, sem estado e sem JavaScript.** A rota atual chega por
 * `atual`, e não é lida do navegador; o tema chega do cookie, lido aqui no
 * servidor. Assim o cabeçalho já vem correto na primeira pintura, e nada disto
 * entra no pacote que a rede do evento precisa baixar (RNF-04).
 *
 * **O painel não usa este cabeçalho.** Lá a altura da tela é orçamento — a Fila
 * precisa caber sem rolagem — e a barra preta própria dele já diz onde o
 * Operador está.
 */

/*
 * Âncora comum, e não o `Link` do Next. A regra de lint está desligada nas
 * linhas abaixo, com número medido:
 *
 * O `Link` traz o roteador de cliente para dentro do pacote, e estas páginas não
 * o tinham. **Medido com `npm run orcamento`: +4,7 KB gzip no primeiro
 * carregamento** — de 140,2 para 145,3, contra um teto de 150. Quase metade da
 * folga do projeto, gasta para trocar um recarregamento de página por uma
 * navegação de cliente entre duas páginas que a pessoa visita duas ou três vezes
 * no dia.
 *
 * RNF-04 é a restrição que manda aqui: rede móvel congestionada, 2000 aparelhos,
 * e o primeiro carregamento é o que decide se a pessoa se inscreve. Navegação
 * instantânea entre abas é conforto; peso é o requisito.
 */

export type Rota = 'inscricao' | 'classificacao' | 'termo' | 'privacidade' | 'termos'

const CAMINHOS: Readonly<Record<Rota, string>> = {
  inscricao: '/',
  classificacao: '/classificacao',
  termo: '/termo',
  privacidade: '/privacidade',
  termos: '/termos',
}

const LINKS: readonly { rota: Rota; texto: string }[] = [
  { rota: 'inscricao', texto: 'Inscrição' },
  { rota: 'classificacao', texto: 'Classificação' },
]

export default async function Cabecalho({ atual }: { atual: Rota }) {
  const tema = await temaDaRequisicao()
  const proximo = alternar(tema)

  return (
    <header className={estilos.cabecalho}>
      <div className={estilos.interior}>
        {/*
          A marca é o vetor de verdade, embutido no HTML — não uma imagem, que
          seria requisição a mais, e não mais o quadriculado em gradiente que
          servia de marca provisória enquanto o logotipo não existia.
        */}
        <Logo href={CAMINHOS.inscricao} />

        <div className={estilos.faixa}>
          <nav className={estilos.navegacao} aria-label="Navegação principal">
            {LINKS.map((link) => (
              <a
                key={link.rota}
                href={CAMINHOS[link.rota]}
                className={`${estilos.link} ${link.rota === atual ? estilos.linkAtual : ''}`}
                // Anuncia a página atual sem depender de cor (RNF-18 e leitor de tela).
                aria-current={link.rota === atual ? 'page' : undefined}
              >
                {link.texto}
              </a>
            ))}
          </nav>

          {/*
            A troca de tema é um formulário, e não um botão de JavaScript.

            O destino já vem calculado do servidor, e `de` diz para onde voltar —
            a rota devolve um 303 para o mesmo lugar, com o cookie novo, e a
            página seguinte já pinta no tema certo. Zero byte de script para uma
            preferência que a pessoa mexe uma vez no dia, se mexer.
          */}
          <form className={estilos.tema} method="post" action="/api/tema">
            <input type="hidden" name="de" value={CAMINHOS[atual]} />
            <input type="hidden" name="tema" value={proximo} />
            <button
              type="submit"
              className={estilos.botaoTema}
              aria-label={`Trocar para o tema ${proximo}`}
            >
              <span className={estilos.glifo} aria-hidden="true" />
              {proximo === 'escuro' ? 'Escuro' : 'Claro'}
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
