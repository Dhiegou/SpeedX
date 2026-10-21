import estilos from './rodape.module.css'

/**
 * Rodapé das páginas públicas: os três documentos legais (D-109).
 *
 * O termo é o que a pessoa aceita; a política e os termos de uso informam. Os
 * três ficam juntos, em todas as páginas públicas, porque é ali que se procura
 * "quem cuida dos meus dados" e "como contesto o meu tempo".
 *
 * Server Component, âncoras comuns, nenhum script: o mesmo motivo de peso do
 * `Cabecalho` (RNF-04).
 */

const DOCUMENTOS = [
  { href: '/termo', texto: 'Termo de consentimento' },
  { href: '/privacidade', texto: 'Política de privacidade' },
  { href: '/termos', texto: 'Termos de uso' },
] as const

export default function Rodape() {
  return (
    <footer className={estilos.rodape}>
      <nav className={estilos.interior} aria-label="Documentos legais">
        {DOCUMENTOS.map((documento) => (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a key={documento.href} className={estilos.link} href={documento.href}>
            {documento.texto}
          </a>
        ))}
      </nav>
    </footer>
  )
}
