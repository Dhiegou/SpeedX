import type { TermoConsentimento } from './modelo'

/**
 * Termo de consentimento — versão `v1.1-2026-10-14`.
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
 * **O que mudou em relação à `v1.0-2026-08-19`, e por quê (D-100).**
 *
 * Nada do que o termo promete mudou: os mesmos dados, as mesmas finalidades,
 * o mesmo prazo, o mesmo canal de exclusão, os mesmos destinatários do
 * repasse e as mesmas três caixas, com `obrigatorio` idêntico em cada uma.
 * O que mudou foi a **redação de duas caixas** e o **nome de uma das duas
 * organizações** que recebem o telefone:
 *
 *  1. **A caixa obrigatória ficou 46% mais curta.** Saiu de dentro dela a
 *     regra dos 18 anos, que continua escrita duas vezes na mesma tela: na
 *     tarja em destaque logo acima das caixas e na seção `exposicao-publica`
 *     deste termo. O que a caixa afirma continua sendo o que RF-08 e RF-09
 *     exigem: li, entendi, e autorizo a publicação do nome na página pública.
 *  2. **A caixa opcional ficou 18% mais curta**, sem perder a frase que a
 *     mantém opcional na prática: dá para deixar desmarcada e se inscrever
 *     assim mesmo. É o que D-23 existe para proteger.
 *  3. **"Escolinha" virou "curso"**, nas três vezes em que a palavra aparecia
 *     no texto. A troca foi pedida junto com a redação da caixa, e aplicá-la
 *     só na caixa deixaria o documento dizendo que o telefone vai para um
 *     "futuro curso" num lugar e para "a escolinha" em outros dois. Num termo
 *     que existe para dizer a quem o dado é entregue, essa é a última
 *     ambiguidade aceitável.
 *
 * A `v1.0` continua publicada e inalterada em `v1-0.ts`: quem se inscreveu
 * sob ela tem `versao_termo` apontando para o texto que leu de verdade.
 *
 * O registro da aprovação está em `docs/aprovacao-termo.md`.
 */
export const TERMO_V1_1: TermoConsentimento = {
  versao: 'v1.1-2026-10-14',
  situacao: 'aprovado',
  publicadoEm: '2026-10-14',
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
            'um curso de corrida que o Lélio Assumpção pretende abrir futuramente.',
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
            'Se você tinha autorizado o repasse e o seu telefone já tiver sido enviado para a FIAP ou para o curso, encaminhamos o seu pedido para quem recebeu.',
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
        'Li e entendi este termo. Autorizo o uso dos meus dados e a publicação do meu nome na página pública de classificação, como está descrito acima.',
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
        'Opcional: autorizo o repasse do meu telefone para a FIAP e para o futuro curso do Lélio Assumpção. Posso deixar desmarcada e me inscrever assim mesmo.',
    },
  ],

  pendencias: [],
}
