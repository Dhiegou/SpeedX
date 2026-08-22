import type { TermoConsentimento } from './modelo'

/**
 * Termo de consentimento — versão `v1.0-2026-08-19`.
 *
 * **Um arquivo por versão publicada, nunca editado depois de aprovado.** Uma
 * versão aprovada é prova de base legal para todos os cadastros que a
 * referenciam em `consentimento.versao_termo`; alterar o arquivo no lugar
 * apagaria silenciosamente aquilo que essas pessoas de fato aceitaram. Texto
 * novo é arquivo novo, com identificador novo — e o teste de integridade
 * (`integridade.ts`) falha se alguém tentar o contrário.
 *
 * Linguagem: P3 do PRD — o responsável precisa entender, não decifrar. Frases
 * curtas, segunda pessoa, sem jargão jurídico e sem remissão a artigo de lei.
 * **Sem travessão** (D-24): a pontuação some do texto que a pessoa lê, e um
 * teste vigia isso. Aqui nos comentários ele continua valendo.
 *
 * **Primeira versão aprovada** (2026-08-19, PE-04 fechada). A partir daqui o
 * arquivo é imutável: qualquer correção, por menor que seja, nasce como versão
 * nova. Este texto é a prova do que foi consentido por quem se cadastrar sob
 * `versao_termo = 'v1.0-2026-08-19'`, e o registro da aprovação está em
 * `docs/aprovacao-termo.md`.
 *
 * Sucede seis rascunhos, nenhum deles usado para coletar coisa alguma porque o
 * guard impediu: `v0.1` (canal de exclusão como `PENDENTE`), `v0.2` (só a
 * inicial do sobrenome para todos, antes da revisão de RNF-09 em D-21), `v0.3`
 * (antes de o repasse à FIAP e à escolinha ser declarado, D-22), `v0.4`
 * (repasse embutido no aceite obrigatório, corrigido em D-23), `v0.5` (repasse
 * já opcional) e `v0.6` (revisão de estilo, D-24). Rascunho que ninguém
 * aceitou não é prova de nada, e o histórico deles é assunto do git.
 */
export const TERMO_V1_0: TermoConsentimento = {
  versao: 'v1.0-2026-08-19',
  situacao: 'aprovado',
  publicadoEm: '2026-08-19',
  titulo: 'Termo de consentimento para uso dos seus dados',

  secoes: [
    {
      id: 'introducao',
      titulo: 'Antes de você se inscrever',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Para participar da corrida, precisamos de alguns dados seus. Este texto explica quais são, para que servem, por quanto tempo ficam guardados e como pedir para apagá-los. Leia antes de marcar o aceite: sem o aceite, a inscrição não é concluída.',
        },
      ],
    },

    {
      id: 'dados-coletados',
      titulo: 'Quais dados coletamos',
      blocos: [
        { tipo: 'paragrafo', texto: 'De quem vai correr, pedimos:' },
        {
          tipo: 'lista',
          itens: ['nome', 'sobrenome', 'e-mail', 'telefone', 'idade'],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Se quem vai correr tem menos de 18 anos, pedimos também os dados de um responsável:',
        },
        {
          tipo: 'lista',
          itens: ['nome do responsável', 'sobrenome do responsável', 'telefone do responsável'],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Durante o evento, registramos ainda o resultado da sua corrida: a pista, o tempo e o horário do registro. Não pedimos documento, endereço, CPF nem dado de pagamento.',
        },
      ],
    },

    {
      id: 'finalidade',
      titulo: 'Para que serve cada dado',
      blocos: [
        {
          tipo: 'lista',
          itens: [
            'Nome e sobrenome: identificar você na fila da largada, separar você de outra pessoa de mesmo nome e montar a classificação.',
            'Idade: conferir se você pode participar (é preciso ter 13 anos ou mais) e saber se a inscrição precisa da autorização de um responsável.',
            'E-mail: falar com você sobre a sua inscrição e sobre o seu resultado.',
            'Telefone: entrar em contato com os ganhadores depois da corrida e localizar você no dia do evento, inclusive em caso de emergência. Na tela da organização aparecem só os quatro últimos dígitos.',
            'Dados do responsável: registrar quem autorizou a participação de um menor de 18 anos e ter um contato adulto disponível no dia do evento.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Não vendemos os seus dados e não usamos nada disso para publicidade. Fora da organização do NEXT, o único repasse que existe é o descrito na próxima seção.',
        },
      ],
    },

    {
      id: 'compartilhamento',
      titulo: 'Com quem compartilhamos o seu telefone (opcional)',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Esta parte é opcional, e é a única do termo que é. Se você não autorizar, a sua inscrição é feita normalmente e o seu telefone não sai da organização do NEXT. Basta deixar a caixa desmarcada no formulário.',
        },
        {
          tipo: 'paragrafo',
          texto: 'Se você autorizar, o seu telefone é repassado para duas organizações:',
        },
        {
          tipo: 'lista',
          itens: [
            'a FIAP;',
            'uma escolinha de corrida que o Lélio Assumpção pretende abrir futuramente.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'A autorização vale para qualquer participante que marcar a caixa, tenha ganhado ou não. Nenhum outro dado seu é repassado: e-mail, idade, sobrenome e resultado ficam com a organização do NEXT.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Se o participante tem menos de 18 anos, o telefone repassado é o do responsável, e a autorização é dele. Continua sendo opcional.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Uma coisa importante sobre o prazo: depois de repassado, o seu telefone fica também com quem recebeu. O prazo de 10 dias explicado abaixo vale para os nossos sistemas, não para a cópia que está com eles.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Fora essas duas organizações, os seus dados não são divulgados para mais ninguém de fora da organização do NEXT.',
        },
      ],
    },

    {
      id: 'exposicao-publica',
      titulo: 'O que fica visível para qualquer pessoa',
      destaque: true,
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'A página de classificação da corrida é pública: qualquer pessoa com o endereço consegue abrir, sem senha.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Se você tem 18 anos ou mais, aparecem nessa página o seu nome e sobrenome completos, junto com o seu tempo, a pista e a sua posição. Quem se inscreve como "Dhiego Ferreira" aparece como "Dhiego Ferreira".',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Se você tem menos de 18 anos, publicamos só o primeiro nome e a inicial do sobrenome: quem se inscreve como "Lucas Mendes" aparece como "Lucas M.".',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Nada além disso é publicado. Seu e-mail, seu telefone, sua idade e os dados do responsável nunca aparecem em página pública.',
        },
      ],
    },

    {
      id: 'menores',
      titulo: 'Quem tem menos de 18 anos',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'A inscrição de quem tem menos de 18 anos só é concluída com os dados de um responsável e com a autorização dele marcada no formulário. Sem isso, o cadastro não é aceito.',
        },
        {
          tipo: 'paragrafo',
          texto: 'Quem tem menos de 13 anos não pode participar da corrida.',
        },
      ],
    },

    {
      id: 'retencao',
      titulo: 'Por quanto tempo guardamos',
      blocos: [
        {
          tipo: 'paragrafo',
          texto: 'Guardamos os seus dados por no máximo 10 dias depois da data do evento.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Passado esse prazo, o site sai do ar: a página de classificação deixa de existir e não fica nada seu publicado na internet.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'No mesmo prazo, apagamos nome, sobrenome, e-mail, telefone, idade e os dados do responsável. Podem continuar guardados apenas números que não identificam ninguém, como tempos e quantidade de participantes.',
        },
      ],
    },

    {
      id: 'exclusao',
      titulo: 'Como pedir para apagar seus dados antes desse prazo',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Você pode pedir a exclusão dos seus dados a qualquer momento, sem precisar explicar o motivo.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Como pedir: mande um e-mail para dhiegodev@hotmail.com. Durante o evento, você também pode falar direto com a organização no ponto de inscrição.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Ao receber o pedido, apagamos os seus dados pessoais e retiramos o seu nome da página pública de classificação. Se o pedido chegar antes de você correr, a exclusão encerra a sua participação: sem os dados, não há como identificar quem correu.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Se você tinha autorizado o repasse e o seu telefone já tiver sido enviado para a FIAP ou para a escolinha, encaminhamos o seu pedido para quem recebeu.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Depois do evento, você não precisa pedir nada: passados 10 dias, apagamos tudo de qualquer forma.',
        },
      ],
    },
  ],

  aceites: [
    {
      id: 'participante',
      obrigatorio: true,
      texto:
        'Li e entendi este termo. Autorizo o uso dos meus dados como está descrito acima, incluindo a publicação do meu nome na página pública de classificação: nome e sobrenome completos, se eu tiver 18 anos ou mais; nome e a inicial do sobrenome, se eu tiver menos de 18.',
    },
    {
      id: 'responsavel',
      obrigatorio: true,
      aplicaSe: 'menor-de-18',
      texto:
        'Eu sou o responsável legal por esta pessoa menor de 18 anos. Eu li e entendi este termo. Eu autorizo a participação dela na corrida e o uso dos dados dela como está descrito acima, incluindo a publicação do primeiro nome e da inicial do sobrenome dela na página pública de classificação. O sobrenome completo dela não é publicado. Eu autorizo também o uso do meu nome, do meu sobrenome e do meu telefone para contato no dia do evento.',
    },
    {
      id: 'compartilhamento',
      obrigatorio: false,
      texto:
        'Opcional: autorizo o repasse do meu telefone para a FIAP e para a futura escolinha de corrida do Lélio Assumpção. Posso deixar esta caixa desmarcada e me inscrever do mesmo jeito.',
    },
  ],

  pendencias: [],
}
