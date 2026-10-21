import type { DocumentoLegal } from './modelo'

/**
 * Política de privacidade, `v1.0-2026-10-20` (D-109).
 *
 * O controlador foi decidido pelo organizador em 2026-10-20: Dhiego Ferreira,
 * pessoa física. O canal é o mesmo e-mail que o termo `v1.1` já publica, para
 * as duas peças não apontarem para lugares diferentes.
 *
 * Mesma linguagem do termo: segunda pessoa, frases curtas, sem travessão
 * (D-24). A diferença é que aqui a lei é citada pelo nome, porque a política é
 * justamente o documento onde a pessoa procura a base legal e os direitos.
 */
export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  versao: 'v1.0-2026-10-20',
  publicadoEm: '2026-10-20',
  titulo: 'Política de privacidade',
  secoes: [
    {
      id: 'controlador',
      titulo: 'Quem cuida dos seus dados',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'O controlador dos dados da corrida, isto é, quem decide como eles são usados e responde por eles, é Dhiego Ferreira, pessoa física, organizador do NEXT.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Contato para qualquer assunto sobre os seus dados: dhiegodev@hotmail.com. Não há um encarregado de dados nomeado à parte: esse mesmo e-mail faz esse papel.',
        },
      ],
    },
    {
      id: 'termo',
      titulo: 'Esta política e o termo de consentimento',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Esta página explica, de forma geral, como tratamos os dados da corrida. O que você aceita ao se inscrever é o termo de consentimento, e é ele que vale. Se alguma coisa aqui parecer diferente do termo, vale o termo.',
        },
        {
          tipo: 'remissao',
          texto: 'O texto completo está no',
          rotulo: 'Termo de consentimento',
          href: '/termo',
        },
      ],
    },
    {
      id: 'dados',
      titulo: 'Quais dados tratamos e para quê',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'De quem vai correr, pedimos nome, sobrenome, e-mail, telefone e idade. De quem tem menos de 18 anos, pedimos também nome, sobrenome e telefone de um responsável. No dia, registramos o resultado da corrida.',
        },
        {
          tipo: 'remissao',
          texto: 'Para que serve cada dado, e o que aparece na página pública, está no termo:',
          rotulo: 'Para que serve cada dado',
          href: '/termo#finalidade',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Depois da corrida, podemos mandar o seu resultado numa mensagem automática, por e-mail ou por WhatsApp, para o e-mail ou o telefone informados na inscrição.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Não pedimos documento, endereço, CPF nem dado de pagamento. Não vendemos dados e não usamos nada disso para publicidade.',
        },
      ],
    },
    {
      id: 'base-legal',
      titulo: 'Com base em quê tratamos os dados',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'A base legal é o seu consentimento, dado ao marcar o aceite do termo no formulário, como prevê o art. 7º, inciso I, da Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Sem o aceite, a inscrição não é concluída.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Quem tem menos de 18 anos só se inscreve com a autorização de um responsável, também registrada no formulário, observando o melhor interesse do adolescente, como pede o art. 14 da LGPD.',
        },
      ],
    },
    {
      id: 'compartilhamento',
      titulo: 'Com quem os dados são compartilhados',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Só o telefone pode ser repassado, e só se você autorizar na caixa opcional do formulário. Os destinatários são a FIAP e um curso de corrida que o Lélio Assumpção pretende abrir futuramente. Sem a sua autorização, nada é repassado.',
        },
        {
          tipo: 'remissao',
          texto: 'Os detalhes, inclusive o que acontece com a cópia repassada, estão no termo:',
          rotulo: 'Com quem compartilhamos o seu telefone',
          href: '/termo#compartilhamento',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Para o site funcionar, os dados ficam em serviços de hospedagem contratados pela organização: a Vercel, que roda o site, e a Neon, que guarda o banco de dados. Eles guardam os dados por conta da organização e não os usam para nada próprio, então isso não é um repasse. O banco de dados e o processamento do site ficam em servidores em São Paulo.',
        },
      ],
    },
    {
      id: 'retencao',
      titulo: 'Por quanto tempo guardamos',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Guardamos os dados por no máximo 10 dias depois do evento, que acontece em 24 de outubro de 2026. Em 4 de novembro de 2026, o site sai do ar e os dados pessoais são apagados. Podem continuar guardados apenas números que não identificam ninguém, como tempos e quantidade de participantes.',
        },
        {
          tipo: 'remissao',
          texto: 'Como o termo descreve o prazo:',
          rotulo: 'Por quanto tempo guardamos',
          href: '/termo#retencao',
        },
      ],
    },
    {
      id: 'direitos',
      titulo: 'Os seus direitos',
      blocos: [
        {
          tipo: 'paragrafo',
          texto: 'A LGPD, no art. 18, garante a você, a qualquer momento:',
        },
        {
          tipo: 'lista',
          itens: [
            'confirmar se tratamos dados seus;',
            'acessar os dados que temos sobre você;',
            'corrigir dados incompletos, errados ou desatualizados;',
            'pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei;',
            'receber os seus dados num formato que permita levá-los a outro serviço (portabilidade);',
            'pedir a eliminação dos dados tratados com o seu consentimento;',
            'saber com quem os seus dados foram compartilhados;',
            'saber que pode não dar o consentimento, e o que acontece se não der: sem o aceite obrigatório, não há inscrição;',
            'revogar o consentimento.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Para exercer qualquer um deles, mande um e-mail para dhiegodev@hotmail.com. Durante o evento, você também pode falar direto com a organização no ponto de inscrição. Respondemos no prazo da LGPD, de até 15 dias.',
        },
        {
          tipo: 'paragrafo',
          texto:
            'Revogar o consentimento tem o mesmo efeito do pedido de exclusão: se ele chegar antes de você correr, encerra a sua participação, porque sem os dados não há como identificar quem correu.',
        },
        {
          tipo: 'remissao',
          texto: 'Como o termo descreve o pedido:',
          rotulo: 'Como pedir para apagar seus dados',
          href: '/termo#exclusao',
        },
      ],
    },
    {
      id: 'cookies',
      titulo: 'Cookies',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'O site usa dois cookies, e nenhum deles serve para rastrear você, medir audiência ou mostrar publicidade. Não há cookie de terceiros, porque não há script de terceiros no site.',
        },
        {
          tipo: 'lista',
          itens: [
            'Tema: guarda só a escolha entre tema claro e escuro, e só existe se você trocar o tema. Fica no seu navegador por até um ano, mas não identifica você.',
            'Sessão do painel: mantém conectada a equipe da organização que lança os tempos. Quem se inscreve nunca recebe este cookie. Ele vale por 16 horas sem uso.',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Os dois são necessários para o site fazer o que você pediu. Por isso não pedimos consentimento para eles nem mostramos aviso de cookies: seria um clique a mais na fila, sem proteger nada.',
        },
      ],
    },
    {
      id: 'reclamacao',
      titulo: 'Se algo der errado',
      blocos: [
        {
          tipo: 'paragrafo',
          texto:
            'Se você achar que os seus dados foram tratados de forma errada, fale primeiro com a organização pelo e-mail acima. Você também tem o direito de reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
        },
        {
          tipo: 'remissao',
          texto: 'Site da ANPD:',
          rotulo: 'gov.br/anpd',
          href: 'https://www.gov.br/anpd',
        },
      ],
    },
  ],
}
