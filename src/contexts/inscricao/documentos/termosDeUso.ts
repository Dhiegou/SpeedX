import type { DocumentoLegal } from './modelo'

/**
 * Termos de uso, `v1.0-2026-10-20` (D-109).
 *
 * Decisões do organizador em 2026-10-20 que o texto carrega: a inscrição
 * **garante** a vez de correr, e o foro é a comarca de São Paulo/SP.
 *
 * A seção que mais importa é a do resultado. Classificação pública com tempo
 * digitado por uma pessoa é onde o conflito mais provável do evento acontece,
 * e o procedimento de contestação precisa estar escrito antes, não inventado
 * na hora.
 */
export const TERMOS_DE_USO: DocumentoLegal = {
  versao: 'v1.0-2026-10-20',
  publicadoEm: '2026-10-20',
  titulo: 'Termos de uso',
  secoes: [
    {
      id: 'sobre',
      titulo: 'O que é este site',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Este site serve para duas coisas: fazer a inscrição na corrida de simulador do NEXT, que acontece em 24 de outubro de 2026, e mostrar a classificação pública da corrida. É gratuito.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Ele é mantido por Dhiego Ferreira, organizador do NEXT. Contato: dhiegodev@hotmail.com.',
        },
      ],
    },
    {
      id: 'quem-pode',
      titulo: 'Quem pode se inscrever',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Qualquer pessoa com 13 anos ou mais. Quem tem menos de 18 anos só se inscreve com os dados e a autorização de um responsável.',
        },
      ],
    },
    {
      id: 'vaga',
      titulo: 'A sua vez de correr',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Quem conclui a inscrição tem a vez garantida para correr no dia do evento, desde que esteja no local. A única exceção são os casos da seção "Regras e recusa de inscrição".',
        },
        {
          tipo: 'paragrafo',
          texto: 'Cada pessoa corre três voltas no simulador, e vale a melhor.',
        },
      ],
    },
    {
      id: 'regras',
      titulo: 'Regras e recusa de inscrição',
      blocos: [
        { tipo: 'paragrafo', texto: 'Ao se inscrever, você se compromete a:' },
        {
          tipo: 'lista',
          itens: [
            'informar dados verdadeiros, seus e, no caso de quem tem menos de 18 anos, do responsável de fato;',
            'fazer uma inscrição só;',
            'seguir as orientações da equipe no local, inclusive sobre o uso do simulador.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'A organização pode recusar ou cancelar uma inscrição com dados falsos ou repetida, e pode interromper a participação de quem puser em risco outras pessoas ou o equipamento.',
        },
      ],
    },
    {
      id: 'resultado',
      titulo: 'Como o resultado é registrado, e como contestar',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'O tempo não é medido por este site. Ele vem do simulador: a pessoa da equipe que opera o Cockpit lê a sua melhor volta na tela do simulador e digita esse tempo no sistema.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Cada lançamento e cada correção ficam registrados, com quem fez, quando (pelo relógio do servidor), o valor anterior e o novo. Uma correção não apaga o registro anterior.',
        },
        { tipo: 'paragrafo', texto: 'Se você achar que o seu tempo está errado:' },
        {
          tipo: 'lista',
          itens: [
            'no dia do evento, fale com a equipe no Cockpit, de preferência logo depois de correr, enquanto ainda dá para conferir a volta no simulador;',
            'depois do evento, mande um e-mail para dhiegodev@hotmail.com até 3 de novembro de 2026, com o seu nome e o tempo que aparece na classificação.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'A organização confere o registro e responde. Se o tempo estiver errado, ele é corrigido, e a correção fica registrada como qualquer outra.',
        },
      ],
    },
    {
      id: 'disponibilidade',
      titulo: 'Disponibilidade',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'O site é gratuito e é oferecido como está, sem garantia de que funcione sem interrupção. Se ele falhar no dia do evento, a inscrição continua em ficha de papel no ponto de inscrição, as corridas continuam, e os dados entram no sistema depois.',
        },
      ],
    },
    {
      id: 'fim',
      titulo: 'Quando o site sai do ar',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Em 4 de novembro de 2026, o site sai do ar, a página de classificação deixa de existir e os dados pessoais são apagados, como diz o termo de consentimento.',
        },
      ],
    },
    {
      id: 'dados',
      titulo: 'Seus dados',
      blocos: [
        {
          tipo: 'remissao',
          texto: 'O que você autoriza ao se inscrever está no',
          rotulo: 'Termo de consentimento',
          href: '/termo',
        },
        {
          tipo: 'remissao',
          texto: 'Quem cuida dos dados, os seus direitos e os cookies estão na',
          rotulo: 'Política de privacidade',
          href: '/privacidade',
        },
      ],
    },
    {
      id: 'foro',
      titulo: 'Lei e foro',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Estes termos seguem a legislação brasileira. Fica eleito o foro da comarca de São Paulo/SP para resolver qualquer questão sobre eles.',
        },
      ],
    },
  ],
}
