import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CAMPO_COCKPITS,
  CAMPOS_DO_PARTICIPANTE,
  CAMPOS_DO_RESPONSAVEL,
  type CampoDaFicha,
} from '@/contexts/inscricao'
import {
  assegurarTermoAprovado,
  type Bloco,
  type TermoConsentimento,
  TERMO_VIGENTE,
} from '@/contexts/inscricao/consentimento'
import { carregarAmbienteDoTerminal } from '@/shared/ambienteCli'
import { COCKPIT } from '@/shared/vocabulario'

/**
 * Material impresso da contingência offline (T20, RNF-06).
 *
 * `npm run fichas` · `npm run fichas -- 300` para outra tiragem
 *
 * Gera três peças em HTML pronto para impressão, em `docs/contingencia/`:
 *
 *  1. **`ficha-inscricao.html`** — uma ficha numerada por folha A4.
 *  2. **`termo-impresso.html`** — o termo integral, para ficar no balcão.
 *  3. **`planilha-tempos.html`** — a folha de tempos, uma por Cockpit.
 *
 * **HTML e não PDF**, e a razão é a de sempre neste projeto: um gerador de PDF
 * é uma dependência a instalar, versionar e manter viva até outubro, para
 * produzir o que qualquer navegador produz com Ctrl+P. O CSS de impressão já
 * fixa A4, margens e quebra de página.
 *
 * **O texto do termo é lido de `TERMO_VIGENTE`, nunca copiado.** É a razão de o
 * termo ser dado estruturado desde T03 (D-09): a mesma versão sai na tela, na
 * rota `/termo` e aqui. Papel e tela divergirem seria a pior espécie de defeito
 * — o participante assina uma coisa e o banco registra outra, e a divergência
 * só aparece se alguém for conferir.
 *
 * **E o gerador recusa rodar sob rascunho**, pela mesma função que barra o
 * cadastro (`assegurarTermoAprovado`, D-18). Imprimir duzentas fichas com um
 * texto não aprovado é gastar papel para coletar assinatura sem base legal.
 */

carregarAmbienteDoTerminal()

const DESTINO = resolve(process.cwd(), 'docs/contingencia')

/** Tiragem padrão: 10% do público esperado, como T20 §1 pede. */
const FICHAS_PADRAO = 200

const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Folha de estilo comum às três peças.
 *
 * Preto sobre branco, sem cinza claro em nada que precise ser lido: a
 * impressora do dia pode ser a que estiver disponível, e material de
 * contingência que sai ilegível é material que não existe.
 */
const ESTILO = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #000;
    margin: 0;
  }
  .folha { page-break-after: always; }
  .folha:last-child { page-break-after: auto; }
  h1 { font-size: 15pt; margin: 0 0 1mm; }
  h2 { font-size: 11pt; margin: 4mm 0 2mm; text-transform: uppercase; letter-spacing: .04em; }
  h3 { font-size: 10.5pt; margin: 3mm 0 1mm; }
  p { margin: 0 0 2mm; }
  ul { margin: 0 0 2mm; padding-left: 6mm; }
  .cabecalho { display: flex; justify-content: space-between; align-items: flex-start;
               border-bottom: 2px solid #000; padding-bottom: 2mm; }
  .numero { font-size: 20pt; font-weight: bold; font-family: monospace; }
  .numero small { display: block; font-size: 7pt; font-weight: normal; letter-spacing: .1em; }
  .aviso { border: 1px solid #000; padding: 2mm 3mm; margin: 3mm 0; font-size: 9.5pt; }
  .campos { display: flex; flex-wrap: wrap; gap: 0 4mm; }
  .campo { margin-bottom: 4mm; flex: 1 1 100%; }
  .campo.metade { flex: 1 1 calc(50% - 4mm); }
  .campo label { display: block; font-size: 8.5pt; text-transform: uppercase;
                 letter-spacing: .05em; margin-bottom: 1mm; }
  .linha { border-bottom: 1px solid #000; height: 7mm; }
  .ajuda { font-size: 8pt; margin-top: .5mm; }
  .caixa { display: inline-block; width: 4.5mm; height: 4.5mm; border: 1.5px solid #000;
           margin-right: 2mm; vertical-align: -.8mm; }
  .aceite { display: flex; gap: 2mm; margin-bottom: 3mm; font-size: 9.5pt; page-break-inside: avoid; }
  .assinatura { margin-top: 6mm; }
  .assinatura .linha { height: 10mm; }
  .rodape { margin-top: 4mm; padding-top: 2mm; border-top: 1px solid #000; font-size: 8pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 1px solid #000; padding: 2mm 1.5mm; text-align: left; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
  td { height: 9mm; }
  .destaque { border: 2px solid #000; padding: 2mm 3mm; }
`

function pagina(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${corpo}
</body>
</html>
`
}

function campoHtml(campo: CampoDaFicha): string {
  return `      <div class="campo ${campo.largura === 'metade' ? 'metade' : ''}">
        <label>${escapar(campo.rotulo)}</label>
        <div class="linha"></div>
        ${campo.ajuda === undefined ? '' : `<div class="ajuda">${escapar(campo.ajuda)}</div>`}
      </div>`
}

function blocoHtml(bloco: Bloco): string {
  if (bloco.tipo === 'lista') {
    return `<ul>${bloco.itens.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`
  }
  return `<p>${escapar(bloco.texto)}</p>`
}

/**
 * Uma ficha, numerada.
 *
 * A numeração não é enfeite: é ela que o procedimento usa para saber o que já
 * foi digitado e o que não foi (T20 §3). Vai grande e em fonte monoespaçada,
 * no alto, porque quem confere às onze da noite lê uma pilha de canto.
 */
function ficha(numero: number, termo: TermoConsentimento): string {
  const obrigatorios = termo.aceites.filter((a) => a.aplicaSe === undefined)
  const doResponsavel = termo.aceites.filter((a) => a.aplicaSe === 'menor-de-18')

  /**
   * O rótulo só aparece no aceite obrigatório.
   *
   * O texto do aceite opcional já começa por "Opcional:" — é assim que ele sai
   * na tela, e mudar isso aqui faria papel e tela dizerem coisas diferentes
   * sobre a mesma caixa. Prefixar de novo produzia "Opcional — Opcional:".
   */
  const aceiteHtml = (texto: string, obrigatorio: boolean): string =>
    `      <div class="aceite"><span class="caixa"></span><span>${obrigatorio ? '<strong>Obrigatório —</strong> ' : ''}${escapar(texto)}</span></div>`

  return `<section class="folha">
  <div class="cabecalho">
    <div>
      <h1>Inscrição na corrida — ficha de papel</h1>
      <p style="font-size:9pt;margin:1mm 0 0">
        Use esta ficha somente quando o sistema estiver fora do ar.
        Escreva em <strong>letra de forma</strong>.
      </p>
    </div>
    <div class="numero">${String(numero).padStart(4, '0')}<small>FICHA Nº</small></div>
  </div>

  <h2>Quem vai correr</h2>
  <div class="campos">
${CAMPOS_DO_PARTICIPANTE.map(campoHtml).join('\n')}
    <div class="campo">
      <label>${escapar(CAMPO_COCKPITS.rotulo)} (marque ao menos um)</label>
      <div style="margin-top:1mm">
        <span class="caixa"></span>${escapar(COCKPIT.singular)} 1
        <span class="caixa" style="margin-left:8mm"></span>${escapar(COCKPIT.singular)} 2
      </div>
    </div>
  </div>

  <h2>Se tem menos de 18 anos — dados do responsável</h2>
  <div class="campos">
${CAMPOS_DO_RESPONSAVEL.map(campoHtml).join('\n')}
  </div>

  <h2>Autorizações</h2>
  <div class="aviso">
    O texto completo do termo está impresso e disponível aqui no ponto de
    inscrição. Peça para ler antes de assinar. Versão ${escapar(termo.versao)}.
  </div>

${obrigatorios.map((a) => aceiteHtml(a.texto, a.obrigatorio)).join('\n')}

  <h3>Só para participante com menos de 18 anos</h3>
${doResponsavel.map((a) => aceiteHtml(a.texto, a.obrigatorio)).join('\n')}

  <div class="campos assinatura">
    <div class="campo metade">
      <label>Assinatura de quem vai correr</label>
      <div class="linha"></div>
    </div>
    <div class="campo metade">
      <label>Assinatura do responsável (se menor de 18)</label>
      <div class="linha"></div>
    </div>
    <div class="campo metade">
      <label>Data e hora do preenchimento</label>
      <div class="linha"></div>
    </div>
    <div class="campo metade">
      <label>Iniciais de quem atendeu</label>
      <div class="linha"></div>
    </div>
  </div>

  <div class="rodape">
    <strong>Não escreva abaixo desta linha.</strong>
    Digitado no sistema por ______________________ em ____ / ____ às ____:____
    &nbsp;&nbsp; <span class="caixa"></span> conferido
  </div>
</section>`
}

function gerarFichas(quantidade: number, termo: TermoConsentimento): string {
  const folhas = Array.from({ length: quantidade }, (_, i) => ficha(i + 1, termo)).join('\n')
  return pagina(`Fichas de inscrição em papel — ${termo.versao}`, folhas)
}

/**
 * O termo integral, para ficar no balcão.
 *
 * **Por que não basta o endereço da rota `/termo` impresso na ficha:** a ficha
 * de papel só é usada quando não há internet. Mandar quem vai assinar consultar
 * uma URL é oferecer exatamente o que acabou de cair.
 */
function gerarTermo(termo: TermoConsentimento): string {
  const secoes = termo.secoes
    .map(
      (secao) => `  <section${secao.destaque === true ? ' class="destaque"' : ''}>
    <h2>${escapar(secao.titulo)}</h2>
${secao.blocos.map((b) => `    ${blocoHtml(b)}`).join('\n')}
  </section>`,
    )
    .join('\n')

  return pagina(
    `${termo.titulo} — ${termo.versao}`,
    `<article>
  <div class="cabecalho">
    <div>
      <h1>${escapar(termo.titulo)}</h1>
      <p style="font-size:9pt;margin:1mm 0 0">
        Versão ${escapar(termo.versao)}, publicada em ${escapar(termo.publicadoEm)}.
      </p>
    </div>
  </div>
${secoes}
  <div class="rodape">
    Este é o mesmo texto que aparece na tela de inscrição. Se você preencheu uma
    ficha de papel, é este o termo que a sua assinatura aceita.
  </div>
</article>`,
  )
}

/**
 * A folha de tempos, uma por Cockpit (T20 §2).
 *
 * **A coluna do horário real existe por causa de RF-31.** Quando o tempo é
 * digitado horas depois, o instante que o sistema grava é o da digitação, e o
 * desempate por ordem de lançamento fica prejudicado no intervalo da queda.
 * O horário escrito à mão aqui é o único registro capaz de arbitrar um empate
 * daquele período — e por isso a coluna não é opcional.
 */
function gerarPlanilha(): string {
  const LINHAS = 22

  const folha = (cockpit: number): string => `<section class="folha">
  <div class="cabecalho">
    <div>
      <h1>Tempos em papel — ${escapar(COCKPIT.singular)} ${String(cockpit)}</h1>
      <p style="font-size:9pt;margin:1mm 0 0">
        Use somente com o sistema fora do ar. Uma linha por corrida.
      </p>
    </div>
    <div class="numero">${String(cockpit)}<small>${escapar(COCKPIT.singular.toUpperCase())}</small></div>
  </div>

  <div class="aviso">
    <strong>Preencha o horário real da corrida.</strong> Quando estes tempos
    forem digitados, o sistema vai registrar a hora da digitação, não a da
    corrida. Em caso de empate, é este horário escrito à mão que decide.
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:34%">Nome e sobrenome</th>
        <th style="width:14%">4 últimos dígitos do telefone</th>
        <th style="width:16%">Tempo (mm:ss.cc)</th>
        <th style="width:16%">Horário real (hh:mm)</th>
        <th style="width:10%">Iniciais</th>
        <th style="width:10%">Digitado</th>
      </tr>
    </thead>
    <tbody>
${Array.from({ length: LINHAS }, () => '      <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('\n')}
    </tbody>
  </table>

  <div class="rodape">
    Folha ______ de ______ &nbsp;·&nbsp; Data ____ / ____ &nbsp;·&nbsp;
    Digitada por ______________________ &nbsp; <span class="caixa"></span> conferida
  </div>
</section>`

  return pagina('Folhas de tempo em papel', [1, 2].map(folha).join('\n'))
}

function principal(): void {
  const termo = TERMO_VIGENTE

  // A mesma barreira do cadastro (D-18). Papel impresso sob rascunho é pior que
  // papel nenhum: ele parece válido e colhe assinatura que não vale.
  assegurarTermoAprovado(termo)

  const argumento = process.argv[2]
  const quantidade = argumento === undefined ? FICHAS_PADRAO : Number(argumento)

  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 2000) {
    throw new Error(`Tiragem inválida: "${String(argumento)}". Informe um inteiro de 1 a 2000.`)
  }

  mkdirSync(DESTINO, { recursive: true })

  const pecas: [string, string][] = [
    ['ficha-inscricao.html', gerarFichas(quantidade, termo)],
    ['termo-impresso.html', gerarTermo(termo)],
    ['planilha-tempos.html', gerarPlanilha()],
  ]

  for (const [nome, conteudo] of pecas) {
    writeFileSync(resolve(DESTINO, nome), conteudo, 'utf8')
    console.log(`  ${nome} — ${(Buffer.byteLength(conteudo) / 1024).toFixed(0)} KB`)
  }

  console.log(
    `\n${String(quantidade)} fichas numeradas de 0001 a ${String(quantidade).padStart(4, '0')}.`,
  )
  console.log(`Termo ${termo.versao}, aprovado em ${termo.publicadoEm}.`)
  console.log('\nImprimir: abrir no navegador e Ctrl+P, A4, sem cabeçalho nem rodapé do navegador.')
  console.log('Procedimento completo em docs/contingencia.md.')
}

try {
  principal()
} catch (erro) {
  console.error('Falha ao gerar as fichas:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
}
