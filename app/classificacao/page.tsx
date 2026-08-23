import type { Metadata } from 'next'
import Classificacao from './Classificacao'
import { documentoDaClassificacao } from '@/contexts/classificacao/projecao'

/**
 * `/classificacao` — a tabela pública (T13, RF-26).
 *
 * Server Component com a projeção **já embutida**: a tabela aparece na primeira
 * pintura, sem esperar requisição do cliente (RNF-01, RNF-04). Quem abre esta
 * página está na arquibancada, em rede móvel congestionada, e a diferença entre
 * ver a lista e ver um esqueleto girando é o engajamento inteiro que o PRD
 * identifica como hoje desperdiçado.
 *
 * A partir daí o cliente assume: filtro, busca e atualização acontecem no
 * dispositivo, sobre o documento que já chegou.
 */

export const metadata: Metadata = {
  title: 'Classificação — SpeedX',
  description: 'Resultados da corrida, atualizados conforme as provas terminam.',
}

/**
 * Renderizada por requisição, **não** no build.
 *
 * A tentativa anterior usava `revalidate = 15`, e o build passou a falhar: para
 * pré-renderizar, o Next precisa consultar o banco durante `next build` — que
 * roda com `NODE_ENV=production` e portanto exige TLS (SDD FL-09), coisa que
 * um Postgres de desenvolvimento não oferece.
 *
 * O erro de TLS foi o sintoma; o problema é o acoplamento. Pré-renderizar esta
 * página amarra o **build** à disponibilidade do banco — o CI de T01 não tem
 * banco nenhum, e o deploy de T19 passaria a precisar de credencial de produção
 * para compilar. Pior: a tabela embutida no build seria a do dia do deploy, ou
 * seja, vazia.
 *
 * Quem protege o banco do pico é o memo de `documentoDaClassificacao`, somado
 * ao cache de borda do endpoint. A primeira pintura continua trazendo a tabela.
 */
export const dynamic = 'force-dynamic'

export default async function PaginaDaClassificacao() {
  const { documento } = await documentoDaClassificacao()

  return <Classificacao inicial={documento} />
}
