import { describe, expect, it } from 'vitest'
import { hashDoConteudo, HASHES_PUBLICADOS, conteudoCanonico } from './integridade'
import type { AceiteId, Secao, SecaoId, TermoConsentimento } from './modelo'
import { SECOES_OBRIGATORIAS } from './modelo'
import {
  aceitePorId,
  aceitesObrigatorios,
  assegurarTermoAprovado,
  LINK_TERMO,
  ROTA_TERMO,
  TERMO_VIGENTE,
  TERMOS_PUBLICADOS,
  termoEstaAprovado,
} from './index'

/**
 * A revisão do texto contra RF-09 é critério de aceitação da T03, e este
 * arquivo é a parte dela que não depende de ninguém lembrar de reler o termo.
 * O checklist assinado pelo organizador está em `docs/aprovacao-termo.md`; o
 * que se automatiza aqui é a metade verificável: as seções exigidas existem,
 * dizem o que precisam dizer, e o identificador de versão acompanha o texto.
 */

function secao(termo: TermoConsentimento, id: SecaoId): Secao {
  const encontrada = termo.secoes.find((s) => s.id === id)
  if (encontrada === undefined) {
    throw new Error(`Seção obrigatória ausente no termo ${termo.versao}: ${id}`)
  }
  return encontrada
}

/** Todo o texto de uma seção, em minúsculas, para busca. */
function textoDa(secaoAlvo: Secao): string {
  return secaoAlvo.blocos
    .flatMap((bloco) => (bloco.tipo === 'paragrafo' ? [bloco.texto] : bloco.itens))
    .join('\n')
    .toLocaleLowerCase('pt-BR')
}

/** Texto de um aceite da versão vigente, em minúsculas. Falha se ele sumir. */
function textoDoAceite(id: AceiteId): string {
  const aceite = aceitePorId(id)
  if (aceite === undefined) {
    throw new Error(`Aceite ausente no termo ${TERMO_VIGENTE.versao}: ${id}`)
  }
  return aceite.texto.toLocaleLowerCase('pt-BR')
}

function textoIntegral(termo: TermoConsentimento): string {
  return [
    ...termo.secoes.map(textoDa),
    ...termo.aceites.map((aceite) => aceite.texto.toLocaleLowerCase('pt-BR')),
  ].join('\n')
}

describe('RF-09 — o termo informa tudo que a lei do projeto exige', () => {
  it.each(SECOES_OBRIGATORIAS)('a seção "%s" existe e tem conteúdo', (id) => {
    expect(textoDa(secao(TERMO_VIGENTE, id)).trim().length).toBeGreaterThan(0)
  })

  it('lista nominalmente cada dado coletado do participante', () => {
    const texto = textoDa(secao(TERMO_VIGENTE, 'dados-coletados'))

    for (const dado of ['nome', 'sobrenome', 'e-mail', 'telefone', 'idade']) {
      expect(texto).toContain(dado)
    }
  })

  it('lista nominalmente os dados do responsável de menor de 18 (RNF-07)', () => {
    const texto = textoDa(secao(TERMO_VIGENTE, 'dados-coletados'))

    expect(texto).toContain('nome do responsável')
    expect(texto).toContain('sobrenome do responsável')
    expect(texto).toContain('telefone do responsável')
  })

  it('declara a finalidade de cada grupo de dados', () => {
    const texto = textoDa(secao(TERMO_VIGENTE, 'finalidade'))

    for (const dado of ['nome', 'idade', 'e-mail', 'telefone', 'responsável']) {
      expect(texto).toContain(dado)
    }
  })

  it('declara o prazo de retenção com um número de dias (RNF-11)', () => {
    expect(textoDa(secao(TERMO_VIGENTE, 'retencao'))).toMatch(/\d+\s*dias/)
  })

  it('avisa que o site sai do ar ao fim do prazo', () => {
    // Promessa operacional, não só de banco: T15 e T19 precisam cumpri-la, e é
    // por isso que ela está escrita e testada e não só combinada.
    expect(textoDa(secao(TERMO_VIGENTE, 'retencao'))).toContain('sai do ar')
  })

  it('explica como pedir a exclusão dos dados, nomeando um canal concreto', () => {
    const texto = textoDa(secao(TERMO_VIGENTE, 'exclusao'))

    expect(texto).toContain('exclusão')
    // "procure alguém" não é canal. O texto precisa dizer para onde escrever
    // (PE-03) — e, durante o evento, onde falar pessoalmente.
    expect(texto).toContain('dhiegodev@hotmail.com')
    expect(texto).toContain('ponto de inscrição')
    expect(texto).not.toContain('pendente')
  })

  it('diz o que acontece com o telefone já repassado, se houver pedido de exclusão', () => {
    expect(textoDa(secao(TERMO_VIGENTE, 'exclusao'))).toContain('encaminhamos o seu pedido')
  })

  it('declara em destaque a exposição pública do nome', () => {
    const exposicao = secao(TERMO_VIGENTE, 'exposicao-publica')
    const texto = textoDa(exposicao)

    // O destaque é exigência de RF-09, não decisão de layout: a rota `/termo`
    // e o formulário de T06 leem esta flag para saber o que realçar.
    expect(exposicao.destaque).toBe(true)
    expect(texto).toMatch(/públic/)
  })

  it('declara os dois formatos do nome público, com exemplo de cada (RNF-09)', () => {
    // A regra tem duas metades desde D-21, e o participante precisa saber em
    // qual delas ele cai antes de aceitar — sobretudo o responsável por um
    // menor, que autoriza justamente a metade abreviada.
    const texto = textoDa(secao(TERMO_VIGENTE, 'exposicao-publica'))

    expect(texto).toContain('18 anos ou mais')
    expect(texto).toContain('nome e sobrenome completos')
    expect(texto).toContain('menos de 18 anos')
    expect(texto).toContain('inicial do sobrenome')
  })

  it('nomeia quem recebe dado fora da organização, e o que recebe', () => {
    // Não é exigência de RF-09, e é a informação que mais muda a decisão de
    // quem lê: um dado que sai da organização precisa de destinatário com nome.
    const texto = textoDa(secao(TERMO_VIGENTE, 'compartilhamento'))

    expect(texto).toContain('fiap')
    expect(texto).toContain('lélio assumpção')
    expect(texto).toContain('telefone')
    // O repasse não é privilégio de quem ganha: quem marcar a caixa entra,
    // tenha subido ao pódio ou não.
    expect(texto).toContain('tenha ganhado ou não')
  })

  it('declara que o repasse alcança o telefone do responsável, no caso de menor', () => {
    expect(textoDa(secao(TERMO_VIGENTE, 'compartilhamento'))).toContain(
      'telefone repassado é o do responsável',
    )
  })

  it('não promete apagar em 10 dias aquilo que já saiu da organização', () => {
    // O termo promete expurgo em 10 dias; a cópia repassada não é nossa para
    // apagar. Dizer isso é o que impede a promessa de virar mentira.
    const texto = textoDa(secao(TERMO_VIGENTE, 'compartilhamento'))

    expect(texto).toContain('vale para os nossos sistemas')
  })

  it('o aceite do participante menciona a publicação do nome (RF-08)', () => {
    const aceite = textoDoAceite('participante')

    expect(aceite).toContain('autorizo')
    expect(aceite).toContain('página pública de classificação')
  })

  it('o bloco do responsável está em primeira pessoa e autoriza participação e publicação', () => {
    const aceite = textoDoAceite('responsavel')

    expect(aceite).toMatch(/^eu sou o responsável legal/)
    expect(aceite).toContain('eu autorizo a participação')
    // O responsável autoriza a forma abreviada, e o texto diz explicitamente o
    // que NÃO acontece — a assimetria em relação ao adulto é o ponto sensível.
    expect(aceite).toContain('inicial do sobrenome')
    expect(aceite).toContain('sobrenome completo dela não é publicado')
  })

  it('nenhuma tela pública é prometida com dado que RNF-08 proíbe exibir', () => {
    const exposicao = textoDa(secao(TERMO_VIGENTE, 'exposicao-publica'))

    // A seção precisa dizer o que NÃO aparece; se esta frase sumir, o termo
    // passa a sugerir que a página pública pode exibir contato.
    expect(exposicao).toMatch(/nunca aparecem em página pública/)
  })
})

describe('estilo do texto', () => {
  /** Tudo que a pessoa lê em `/termo`: títulos, corpo, aceites e avisos. */
  function tudoQueApareceNaTela(termo: TermoConsentimento): readonly string[] {
    return [
      termo.titulo,
      ...termo.secoes.flatMap((s) => [
        s.titulo,
        ...s.blocos.flatMap((b) => (b.tipo === 'paragrafo' ? [b.texto] : b.itens)),
      ]),
      ...termo.aceites.map((a) => a.texto),
      ...termo.pendencias,
    ]
  }

  it('não usa travessão: pontuação de texto jurídico traduzido, não de português do dia a dia', () => {
    // Preferência do organizador, registrada em D-24. Está em teste porque
    // preferência de escrita não sobrevive à terceira revisão sem alguém para
    // vigiá-la, e reescrever o termo depois custa uma versão nova.
    for (const trecho of tudoQueApareceNaTela(TERMO_VIGENTE)) {
      expect(trecho).not.toMatch(/[—–]/)
    }
  })
})

describe('o repasse é opcional; o termo não', () => {
  it('só o aceite do repasse é opcional', () => {
    expect(aceitePorId('compartilhamento')?.obrigatorio).toBe(false)
    expect(aceitePorId('participante')?.obrigatorio).toBe(true)
    expect(aceitePorId('responsavel')?.obrigatorio).toBe(true)
  })

  it('recusar o repasse não impede o cadastro — ele fica fora dos obrigatórios', () => {
    // Este é o teste que separa "opcional" de "opcional no papel". Se alguém
    // marcar o repasse como obrigatório para simplificar o formulário de T06,
    // a suíte para aqui.
    const ids = aceitesObrigatorios().map((aceite) => aceite.id)

    expect(ids).not.toContain('compartilhamento')
    expect(ids).toEqual(['participante', 'responsavel'])
  })

  it('o aceite do responsável não carrega o repasse embutido', () => {
    // Consentimento embutido em aceite obrigatório é consentimento forçado: o
    // responsável não teria como autorizar a participação e recusar o repasse.
    expect(textoDoAceite('responsavel')).not.toContain('repasse')
  })

  it('o texto do aceite opcional diz que dá para não marcar', () => {
    const aceite = textoDoAceite('compartilhamento')

    expect(aceite).toContain('opcional')
    expect(aceite).toContain('desmarcada')
  })

  it('a seção do repasse avisa que a inscrição acontece sem ele', () => {
    const texto = textoDa(secao(TERMO_VIGENTE, 'compartilhamento'))

    expect(texto).toContain('opcional')
    expect(texto).toContain('inscrição é feita normalmente')
  })

  it('o aceite do responsável só aparece para menor de 18', () => {
    expect(aceitePorId('responsavel')?.aplicaSe).toBe('menor-de-18')
    expect(aceitePorId('participante')?.aplicaSe).toBeUndefined()
    expect(aceitePorId('compartilhamento')?.aplicaSe).toBeUndefined()
  })
})

describe('ciclo de publicação da versão', () => {
  it.each(Object.entries(TERMOS_PUBLICADOS))(
    'o conteúdo de %s confere com o hash declarado',
    (versao, termo) => {
      expect(HASHES_PUBLICADOS[versao]).toBe(hashDoConteudo(termo))
    },
  )

  it('a versão vigente está registrada em TERMOS_PUBLICADOS e em HASHES_PUBLICADOS', () => {
    expect(TERMOS_PUBLICADOS[TERMO_VIGENTE.versao]).toBe(TERMO_VIGENTE)
    expect(HASHES_PUBLICADOS[TERMO_VIGENTE.versao]).toBeDefined()
  })

  it('cada termo declara a própria chave em TERMOS_PUBLICADOS', () => {
    for (const [versao, termo] of Object.entries(TERMOS_PUBLICADOS)) {
      expect(termo.versao).toBe(versao)
    }
  })

  it('alterar uma palavra do texto muda o hash — logo, exige versão nova', () => {
    const adulterado: TermoConsentimento = {
      ...TERMO_VIGENTE,
      secoes: TERMO_VIGENTE.secoes.map((s) =>
        s.id === 'retencao'
          ? { ...s, blocos: [{ tipo: 'paragrafo', texto: 'Guardamos para sempre.' }] }
          : s,
      ),
    }

    expect(hashDoConteudo(adulterado)).not.toBe(HASHES_PUBLICADOS[TERMO_VIGENTE.versao])
  })

  it('tornar obrigatório um aceite opcional muda o hash — é alteração de termo', () => {
    // Nenhuma palavra do texto muda, e ainda assim o que a pessoa consentiu
    // muda. Se o hash ignorasse `obrigatorio`, dava para transformar o repasse
    // em condição de inscrição sem publicar versão nova.
    const forcado: TermoConsentimento = {
      ...TERMO_VIGENTE,
      aceites: TERMO_VIGENTE.aceites.map((aceite) =>
        aceite.id === 'compartilhamento' ? { ...aceite, obrigatorio: true } : aceite,
      ),
    }

    expect(hashDoConteudo(forcado)).not.toBe(HASHES_PUBLICADOS[TERMO_VIGENTE.versao])
  })

  it('aprovar um rascunho sem tocar no texto não muda o hash', () => {
    const aprovado: TermoConsentimento = {
      ...TERMO_VIGENTE,
      situacao: 'aprovado',
      pendencias: [],
    }

    expect(hashDoConteudo(aprovado)).toBe(hashDoConteudo(TERMO_VIGENTE))
  })

  it('o conteúdo canônico não carrega metadado de publicação', () => {
    const canonico = conteudoCanonico(TERMO_VIGENTE)

    expect(canonico).not.toContain(TERMO_VIGENTE.versao)
    expect(canonico).not.toContain(TERMO_VIGENTE.publicadoEm)
  })
})

describe('só termo aprovado é base legal', () => {
  it('a versão vigente está aprovada e sem pendências (PE-04, 2026-08-19)', () => {
    // Este teste era o inverso até a aprovação: exigia `rascunho` e pendência
    // aberta. Inverter fez parte do procedimento de aprovar, junto com o
    // preenchimento de docs/aprovacao-termo.md.
    expect(TERMO_VIGENTE.situacao).toBe('aprovado')
    expect(TERMO_VIGENTE.pendencias).toEqual([])
    expect(termoEstaAprovado()).toBe(true)
  })

  it('a versão vigente não é rascunho: o identificador não carrega a marca', () => {
    expect(TERMO_VIGENTE.versao).not.toContain('rascunho')
  })

  it('assegurarTermoAprovado deixa passar a versão vigente', () => {
    expect(() => assegurarTermoAprovado()).not.toThrow()
  })

  it('um rascunho é recusado, e o erro diz o que falta', () => {
    const rascunho: TermoConsentimento = {
      ...TERMO_VIGENTE,
      versao: 'v9.9-rascunho-teste',
      situacao: 'rascunho',
      pendencias: ['PE-99: exemplo de pendência aberta.'],
    }

    expect(() => assegurarTermoAprovado(rascunho)).toThrow(/não está aprovado/)
    expect(() => assegurarTermoAprovado(rascunho)).toThrow(/PE-99/)
    expect(termoEstaAprovado(rascunho)).toBe(false)
  })

  it('rascunho sem pendência listada também é recusado', () => {
    // Situação `rascunho` basta para barrar. Sem isso, esquecer de preencher
    // `pendencias` faria um texto não aprovado passar por aprovado.
    const rascunho: TermoConsentimento = {
      ...TERMO_VIGENTE,
      situacao: 'rascunho',
      pendencias: [],
    }

    expect(() => assegurarTermoAprovado(rascunho)).toThrow(/rascunho/)
  })

  it('situação "aprovado" com pendência aberta continua sendo recusada', () => {
    // Os dois sinais precisam concordar. Marcar `aprovado` e esquecer uma
    // pendência na lista é o erro mais provável de quem aprova com pressa.
    const inconsistente: TermoConsentimento = {
      ...TERMO_VIGENTE,
      situacao: 'aprovado',
      pendencias: ['PE-99: alguma coisa ainda em aberto.'],
    }

    expect(() => assegurarTermoAprovado(inconsistente)).toThrow(/PE-99/)
  })

  it('nenhum termo aprovado pode conter marcação PENDENTE no texto', () => {
    for (const termo of Object.values(TERMOS_PUBLICADOS)) {
      if (!termoEstaAprovado(termo)) continue

      expect(textoIntegral(termo)).not.toContain('pendente')
    }
  })

  it('nenhuma seção do termo vigente carrega marcação de pendência no texto', () => {
    expect(textoIntegral(TERMO_VIGENTE)).not.toContain('pendente')
  })

  it('toda versão publicada está aprovada', () => {
    // O registro guarda o que serviu de base legal para algum cadastro. Um
    // rascunho aqui dentro é sinal de que alguém publicou sem aprovar.
    for (const [versao, termo] of Object.entries(TERMOS_PUBLICADOS)) {
      expect(termoEstaAprovado(termo), `${versao} não está aprovado`).toBe(true)
    }
  })
})

describe('acesso ao termo a partir do formulário', () => {
  it('o link abre em aba nova, para não destruir o preenchimento', () => {
    expect(LINK_TERMO.href).toBe(ROTA_TERMO)
    expect(LINK_TERMO.target).toBe('_blank')
  })

  it('o link não entrega referência da janela do formulário à aba aberta', () => {
    expect(LINK_TERMO.rel).toContain('noopener')
  })
})
