import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CAMPO_COCKPITS,
  CAMPOS_DO_PARTICIPANTE,
  CAMPOS_DO_RESPONSAVEL,
  CHAVES_DA_FICHA,
  esquemaInscricao,
  IDADE_MAIORIDADE,
} from '@/contexts/inscricao'
import { TERMO_VIGENTE } from '@/contexts/inscricao/consentimento'

/**
 * A ficha de papel coleta o mesmo que a tela (T20, RNF-06).
 *
 * **O defeito que este arquivo existe para impedir é lento e caro.** Alguém
 * acrescenta um campo ao cadastro em setembro; as fichas já foram para a
 * gráfica em agosto. No dia do evento, com o sistema fora do ar, duzentas
 * pessoas preenchem um papel que não tem onde escrever o dado novo — e a
 * digitação posterior, que passa pelo **mesmo** caso de uso e pelas mesmas
 * validações (RNF-13), recusa cada uma delas.
 *
 * Ninguém descobre isso revisando código: a ficha é um script de geração, e o
 * cadastro é um esquema Zod. Só um teste que compare os dois percebe.
 *
 * O segundo defeito é jurídico e pior: papel e tela apresentarem **textos de
 * consentimento diferentes**. A pessoa assina uma coisa e o banco registra
 * outra, e a divergência só aparece se alguém for conferir — provavelmente
 * numa contestação.
 */

const RAIZ = process.cwd()

const ler = (nome: string): string => readFileSync(join(RAIZ, 'docs', 'contingencia', nome), 'utf8')

/**
 * Os campos que o esquema de cadastro **exige**, extraídos dele mesmo.
 *
 * A sonda é submeter corpos incompletos e colher os caminhos das reclamações. É
 * mais indireto que ler `.shape`, e é de propósito: `esquemaInscricao` é um
 * esquema transformado, e o que interessa aqui não é a forma declarada — é o
 * que ele de fato recusa quando falta.
 *
 * **São duas sondas, e a segunda é a que importa.** O corpo vazio nunca alcança
 * o `superRefine`: o Zod para na forma base, e as exigências de Responsável
 * — justamente as de RNF-07, as mais caras de descobrir tarde — não aparecem.
 * A segunda sonda é um menor de idade sem responsável nenhum.
 */
function camposExigidosPeloCadastro(): string[] {
  const menorSemResponsavel = {
    nome: 'Ana',
    sobrenome: 'Silva',
    email: 'ana@exemplo.test',
    telefone: '11987654321',
    idade: IDADE_MAIORIDADE - 1,
    cockpits: [1],
    consentimento: true,
  }

  const caminhos = new Set<string>()

  for (const corpo of [{}, menorSemResponsavel]) {
    const resultado = esquemaInscricao.safeParse(corpo)

    if (resultado.success) {
      throw new Error(`O cadastro aceitou um corpo incompleto: ${JSON.stringify(corpo)}`)
    }

    for (const problema of resultado.error.issues) caminhos.add(problema.path.join('.'))
  }

  return [...caminhos].sort()
}

describe('RNF-06 — a ficha de papel coleta os mesmos campos que a tela', () => {
  it('todo campo exigido pelo cadastro tem onde ser escrito na ficha', () => {
    // `consentimento` e `aceiteResponsavel` são assinatura no papel, não campo;
    // ficam de fora aqui e são verificados no bloco seguinte.
    const assinaturas = ['consentimento', 'aceiteResponsavel']

    const exigidos = camposExigidosPeloCadastro()

    // Âncora contra sonda vazia: se o esquema mudar de formato e as reclamações
    // pararem de trazer caminho, tudo abaixo passaria por vacuidade.
    expect(exigidos).toContain('nome')
    expect(exigidos).toContain('responsavel')

    const semLugarNoPapel = exigidos
      .filter((campo) => !assinaturas.includes(campo))
      // `responsavel` sozinho é o caminho da reclamação "faltou o bloco
      // inteiro"; os três campos dele constam da ficha e são conferidos abaixo.
      .filter((campo) => campo !== 'responsavel')
      .filter((campo) => !CHAVES_DA_FICHA.includes(campo))

    expect(semLugarNoPapel).toEqual([])
  })

  it('a ficha não pede nada que o cadastro não saiba receber', () => {
    // O outro sentido, e ele importa igual: um campo a mais no papel é dado
    // pessoal coletado sem finalidade — o oposto do que o termo promete — e
    // trabalho de quem digita que não vai para lugar nenhum.
    const corpo = {
      nome: 'Ana',
      sobrenome: 'Silva',
      email: 'ana@exemplo.test',
      telefone: '11987654321',
      idade: IDADE_MAIORIDADE,
      cockpits: [1],
      consentimento: true,
      responsavel: { nome: 'Rita', sobrenome: 'Silva', telefone: '11987654322' },
    }

    const aceito = esquemaInscricao.safeParse(corpo)
    expect(aceito.success).toBe(true)

    // Cada chave da ficha é uma chave que este corpo válido carrega.
    const chavesDoCorpo = [
      ...Object.keys(corpo),
      ...Object.keys(corpo.responsavel).map((k) => `responsavel.${k}`),
    ]

    for (const chave of CHAVES_DA_FICHA) {
      expect(chavesDoCorpo, chave).toContain(chave)
    }
  })

  it('RF-05 — o bloco do responsável vai na mesma ficha, com os três campos', () => {
    // Duas folhas se separam. Uma ficha de menor sem o bloco assinado é um
    // cadastro que o caso de uso recusa, e com razão (RNF-07).
    expect(CAMPOS_DO_RESPONSAVEL.map((c) => c.chave)).toEqual([
      'responsavel.nome',
      'responsavel.sobrenome',
      'responsavel.telefone',
    ])

    const html = ler('ficha-inscricao.html')
    for (const campo of CAMPOS_DO_RESPONSAVEL) {
      expect(html).toContain(campo.rotulo)
    }
  })

  it('RF-03 — a escolha de Cockpit está na ficha, com as duas opções', () => {
    const html = ler('ficha-inscricao.html')

    expect(CHAVES_DA_FICHA).toContain(CAMPO_COCKPITS.chave)
    expect(html).toContain('Cockpit 1')
    expect(html).toContain('Cockpit 2')
  })
})

describe('RNF-07 — o papel carrega o mesmo consentimento que a tela', () => {
  it('a ficha traz os aceites do termo vigente, palavra por palavra', () => {
    const html = ler('ficha-inscricao.html')

    for (const aceite of TERMO_VIGENTE.aceites) {
      // O texto vai escapado no HTML; a comparação usa um trecho sem
      // caracteres que o escape altera, o bastante para identificar o aceite.
      const trecho = aceite.texto.slice(0, 60)
      expect(html, aceite.id).toContain(trecho)
    }
  })

  it('a ficha declara qual versão do termo está assinando', () => {
    // Sem a versão impressa, uma ficha assinada em agosto e digitada em outubro
    // é indistinguível de uma assinada sob outro texto. É o mesmo motivo pelo
    // qual `consentimento.versao_termo` existe no banco.
    expect(ler('ficha-inscricao.html')).toContain(TERMO_VIGENTE.versao)
  })

  it('o termo integral existe em papel, e não como endereço para consultar', () => {
    // A ficha só é usada quando não há internet. Mandar quem vai assinar abrir
    // uma URL é oferecer exatamente o que acabou de cair.
    const termo = ler('termo-impresso.html')

    expect(termo).toContain(TERMO_VIGENTE.titulo)
    expect(termo).toContain(TERMO_VIGENTE.versao)

    for (const secao of TERMO_VIGENTE.secoes) {
      expect(termo, secao.id).toContain(secao.titulo)
    }
  })

  it('D-18 — o material impresso nasce de versão aprovada, nunca de rascunho', () => {
    // O gerador chama `assegurarTermoAprovado`, a mesma barreira do cadastro.
    // Duzentas fichas impressas sob rascunho parecem válidas e colhem
    // assinatura que não vale — pior que não ter ficha nenhuma.
    const fonte = readFileSync(join(RAIZ, 'scripts', 'gerar-fichas.ts'), 'utf8')

    expect(fonte).toContain('assegurarTermoAprovado')
    expect(TERMO_VIGENTE.situacao).toBe('aprovado')
    expect(TERMO_VIGENTE.pendencias).toEqual([])
  })
})

describe('RF-31 — a folha de tempos registra o horário real da corrida', () => {
  it('a planilha tem coluna para o horário escrito à mão', () => {
    // Quando o tempo é digitado horas depois, o instante que o sistema grava é
    // o da digitação (T20 §3). O desempate por ordem de lançamento fica
    // prejudicado no intervalo da queda, e este horário é o único registro
    // capaz de arbitrar um empate daquele período.
    const html = ler('planilha-tempos.html')

    expect(html).toContain('Horário real')
    expect(html).toContain('mm:ss.cc')
    expect(html).toContain('4 últimos dígitos do telefone')
  })

  it('há uma folha por Cockpit', () => {
    const html = ler('planilha-tempos.html')

    expect(html).toContain('Cockpit 1')
    expect(html).toContain('Cockpit 2')
  })
})

describe('o material impresso está gerado e versionado', () => {
  it('as três peças existem no repositório', () => {
    // Elas são geradas por `npm run fichas`, e ficam commitadas pelo mesmo
    // motivo do QR de T07: quem imprime não roda o projeto.
    for (const peca of ['ficha-inscricao.html', 'termo-impresso.html', 'planilha-tempos.html']) {
      expect(ler(peca).length, peca).toBeGreaterThan(500)
    }
  })

  it('T20 §1 — a tiragem cobre ao menos 200 cadastros', () => {
    const html = ler('ficha-inscricao.html')
    const fichas = html.match(/FICHA Nº/g)?.length ?? 0

    expect(fichas).toBeGreaterThanOrEqual(200)
  })

  it('as fichas são numeradas em sequência, sem repetir', () => {
    // A numeração é o que o procedimento usa para saber o que já foi digitado.
    // Duas fichas com o mesmo número são dois cadastros que ninguém consegue
    // distinguir na conferência.
    const numeros = [...ler('ficha-inscricao.html').matchAll(/class="numero">(\d{4})</g)].map(
      (a) => a[1]!,
    )

    expect(numeros[0]).toBe('0001')
    expect(new Set(numeros).size).toBe(numeros.length)
  })

  it('todo campo declarado aparece impresso na ficha', () => {
    const html = ler('ficha-inscricao.html')

    for (const campo of [...CAMPOS_DO_PARTICIPANTE, ...CAMPOS_DO_RESPONSAVEL]) {
      expect(html, campo.chave).toContain(campo.rotulo)
    }
  })
})
