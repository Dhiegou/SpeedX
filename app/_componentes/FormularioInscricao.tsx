'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react'
import type { Aceite, AceiteId } from '@/contexts/inscricao/consentimento'
import { paraErrosDeValidacao, type ErroDeValidacao } from '@/contexts/inscricao/erros'
import { IDADE_MAIORIDADE, IDADE_MINIMA } from '@/contexts/inscricao/idades'
import { nomeDoCockpit, COCKPIT } from '@/shared/vocabulario'
import estilos from './formulario.module.css'

/**
 * Formulário público de cadastro (T06 — RF-02 a RF-10, RNF-15, RNF-17, RNF-18).
 *
 * A única superfície que duas mil pessoas vão tocar, de celular, na fila, em
 * rede congestionada. Três decisões vêm daí:
 *
 * 1. **A validação é a de T04, importada.** `esquemaInscricao` é o mesmo módulo
 *    que o servidor executa. Reescrever as regras aqui criaria duas verdades, e
 *    a que diverge primeiro é sempre a da tela. O servidor revalida de todo
 *    jeito (RNF-13) — isto aqui existe para poupar uma ida à rede, não para
 *    decidir nada.
 *
 * 2. **A chave de idempotência vive num `ref` e só muda quando o conteúdo
 *    muda.** É o que transforma "a confirmação não chegou, aperta de novo" em
 *    um cadastro só (FL-03). Editar qualquer campo descarta a chave, porque
 *    outro conteúdo com a mesma chave é conflito no servidor, não reenvio.
 *
 * 3. **O Zod não entra no pacote inicial.** `esquemaInscricao` é carregado
 *    logo depois da montagem, em paralelo com a pessoa digitando, e só é
 *    esperado no envio. Ele custa mais de cem quilobytes e não serve para nada
 *    até alguém tocar no botão — na única página que duas mil pessoas abrem em
 *    rede móvel congestionada, isso é atraso puro (RNF-04).
 *
 * 4. **As caixas de aceite são renderizadas a partir do termo**, com
 *    `obrigatorio` vindo do dado. Escrever `required` à mão aqui é exatamente
 *    como um consentimento opcional vira bloqueante sem ninguém decidir isso
 *    (D-23).
 */

export type PropsFormulario = {
  /** Carimbo de hora assinado, emitido na renderização (T05). */
  readonly token: string
  /** As caixas de aceite da versão vigente do termo. */
  readonly aceites: readonly Aceite[]
  readonly versaoTermo: string
  readonly linkTermo: { readonly href: string; readonly target: string; readonly rel: string }
}

type Confirmacao = { nome: string; sobrenome: string; cockpits: number[] }

/** Falhas que não são de campo: rede, limite, servidor. */
type Contratempo =
  | { tipo: 'rede' }
  | { tipo: 'espera'; mensagem: string }
  | { tipo: 'expirado' }
  | { tipo: 'conflito' }
  | { tipo: 'indisponivel'; mensagem: string }

const COCKPITS = [1, 2] as const

/**
 * Carrega a validação uma vez, sob demanda.
 *
 * Chamada na montagem para que o download aconteça enquanto a pessoa preenche,
 * e aguardada no envio. Se falhar — rede caiu no meio —, o envio segue sem
 * validação local: o servidor revalida tudo de qualquer jeito (RNF-13), e a
 * mensagem que volta no 422 é a mesma. Bloquear o envio porque um recurso
 * opcional não baixou seria transformar otimização em requisito.
 */
let validacao: Promise<typeof import('@/contexts/inscricao/schema')> | null = null

function carregarValidacao(): Promise<typeof import('@/contexts/inscricao/schema')> {
  validacao ??= import('@/contexts/inscricao/schema')
  return validacao
}

/**
 * Caixa de aceite → campo do envio.
 *
 * O termo nomeia os aceites pelo que eles são (`participante`,
 * `responsavel`, `compartilhamento`); o esquema de T04 os nomeia pelo campo
 * que grava. O mapa fica aqui, explícito, porque é o ponto onde uma renomeação
 * de um dos dois lados precisa doer.
 */
const CAMPO_DO_ACEITE: Record<AceiteId, string> = {
  participante: 'consentimento',
  responsavel: 'aceiteResponsavel',
  compartilhamento: 'aceiteCompartilhamento',
}

const VAZIO = {
  nome: '',
  sobrenome: '',
  email: '',
  telefone: '',
  idade: '',
  responsavelNome: '',
  responsavelSobrenome: '',
  responsavelTelefone: '',
  /** Campo-armadilha. Chega vazio de qualquer navegador (RNF-12). */
  empresa: '',
}

type Campos = typeof VAZIO

/** `(11) 98765-4321` enquanto digita; o envio leva só os dígitos. */
function mascararTelefone(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '').slice(0, 11)

  if (digitos.length <= 2) return digitos
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }

  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Identificador de elemento a partir do caminho do campo.
 *
 * O servidor devolve `responsavel.telefone`; o DOM não aceita ponto em `id`
 * sem escapar no seletor. Uma função só, usada na renderização e no foco, evita
 * que as duas convenções se separem.
 */
function idDoCampo(campo: string): string {
  return `campo-${campo.replace(/\./g, '-')}`
}

/** UUID v4. `randomUUID` exige contexto seguro; o resto do evento também. */
function novaChave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function FormularioInscricao({
  token,
  aceites,
  versaoTermo,
  linkTermo,
}: PropsFormulario) {
  const [campos, setCampos] = useState<Campos>(VAZIO)
  const [cockpits, setCockpits] = useState<number[]>([])
  const [marcados, setMarcados] = useState<Partial<Record<AceiteId, boolean>>>({})
  const [erros, setErros] = useState<readonly ErroDeValidacao[]>([])
  const [contratempo, setContratempo] = useState<Contratempo | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  /**
   * A chave da tentativa de envio em curso. `null` significa "o conteúdo mudou
   * desde o último envio, gere outra".
   */
  const chave = useRef<string | null>(null)
  const elementos = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    void carregarValidacao().catch(() => null)
  }, [])

  const porCampo = useMemo(() => {
    const mapa = new Map<string, ErroDeValidacao>()
    for (const erro of erros) if (!mapa.has(erro.campo)) mapa.set(erro.campo, erro)
    return mapa
  }, [erros])

  const idade = campos.idade === '' ? Number.NaN : Number(campos.idade)
  const jovemDemais = Number.isFinite(idade) && idade > 0 && idade < IDADE_MINIMA
  const menor = Number.isFinite(idade) && idade >= IDADE_MINIMA && idade < IDADE_MAIORIDADE

  /** Qualquer edição invalida a chave: outro conteúdo é outro cadastro. */
  function mudou(): void {
    chave.current = null
    setContratempo(null)
  }

  function trocar(campo: keyof Campos, valor: string): void {
    mudou()
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  /**
   * A idade não é um campo entre outros: ela decide qual formulário existe.
   *
   * Ao passar dos 18, os dados do responsável são **apagados do estado**, e não
   * apenas escondidos. RF-07 é garantido no servidor de qualquer forma, mas
   * mandar resíduo é mandar dado pessoal de terceiro que ninguém pediu.
   */
  function trocarIdade(valor: string): void {
    mudou()

    const numero = Number(valor)
    const adulto = valor !== '' && Number.isFinite(numero) && numero >= IDADE_MAIORIDADE

    setCampos((atual) => ({
      ...atual,
      idade: valor,
      ...(adulto ? { responsavelNome: '', responsavelSobrenome: '', responsavelTelefone: '' } : {}),
    }))

    if (adulto) setMarcados((atual) => ({ ...atual, responsavel: false }))
  }

  function alternarCockpit(cockpit: number): void {
    mudou()
    setCockpits((atual) =>
      atual.includes(cockpit) ? atual.filter((p) => p !== cockpit) : [...atual, cockpit].sort(),
    )
  }

  function alternarAceite(id: AceiteId): void {
    mudou()
    setMarcados((atual) => ({ ...atual, [id]: atual[id] !== true }))
  }

  /** O corpo exatamente como o endpoint de T05 espera. */
  function montarEnvio(): Record<string, unknown> {
    return {
      nome: campos.nome,
      sobrenome: campos.sobrenome,
      email: campos.email,
      telefone: apenasDigitos(campos.telefone),
      // Ausente, e não `0` nem `''`: o servidor precisa distinguir "não
      // preencheu" de "preencheu errado" para escolher a mensagem (RNF-17).
      ...(campos.idade === '' ? {} : { idade: Number(campos.idade) }),
      cockpits,
      consentimento: marcados.participante === true,
      aceiteCompartilhamento: marcados.compartilhamento === true,
      ...(menor
        ? {
            responsavel: {
              nome: campos.responsavelNome,
              sobrenome: campos.responsavelSobrenome,
              telefone: apenasDigitos(campos.responsavelTelefone),
            },
            aceiteResponsavel: marcados.responsavel === true,
          }
        : {}),
      token,
      empresa: campos.empresa,
    }
  }

  function mostrar(lista: readonly ErroDeValidacao[]): void {
    setErros(lista)

    const primeiro = lista[0]
    if (primeiro === undefined) return

    // Foco no primeiro campo inválido: sem isso, quem está no fim de um
    // formulário longo recebe um aviso que não vê e não sabe para onde rolar.
    const alvo =
      elementos.current[primeiro.campo] ?? elementos.current[primeiro.campo.split('.')[0] ?? '']
    alvo?.focus()
    alvo?.scrollIntoView({ block: 'center' })
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (enviando) return

    const envio = montarEnvio()
    const esquema = await carregarValidacao()
      .then((modulo) => modulo.esquemaInscricao)
      .catch(() => null)

    const exame = esquema?.safeParse(envio)

    if (exame !== undefined && !exame.success) {
      setContratempo(null)
      mostrar(paraErrosDeValidacao(exame.error, envio))
      return
    }

    setErros([])
    setContratempo(null)
    setEnviando(true)

    chave.current ??= novaChave()

    try {
      const resposta = await fetch('/api/inscricao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': chave.current },
        body: JSON.stringify(envio),
      })

      await interpretar(resposta)
    } catch {
      // Falha de rede: a chave é preservada de propósito. O pedido pode ter
      // chegado e só a resposta ter se perdido — reenviar com a mesma chave
      // devolve a confirmação original em vez de criar um segundo cadastro.
      setContratempo({ tipo: 'rede' })
    } finally {
      setEnviando(false)
    }
  }

  async function interpretar(resposta: Response): Promise<void> {
    if (resposta.ok) {
      setConfirmacao((await resposta.json()) as Confirmacao)
      return
    }

    if (resposta.status === 422) {
      const corpo = (await resposta.json()) as { erros: ErroDeValidacao[] }
      mostrar(corpo.erros)
      return
    }

    const corpo = (await resposta.json().catch(() => null)) as {
      erro?: { codigo?: string; mensagem?: string }
    } | null

    const mensagem = corpo?.erro?.mensagem ?? 'Não foi possível concluir agora. Tente de novo.'

    if (corpo?.erro?.codigo === 'formulario_expirado') {
      setContratempo({ tipo: 'expirado' })
      return
    }

    if (resposta.status === 429) {
      setContratempo({ tipo: 'espera', mensagem })
      return
    }

    if (resposta.status === 409) {
      // A chave foi usada com outro conteúdo. Descartar e deixar reenviar é o
      // caminho certo: o cadastro anterior existe, este ainda não.
      chave.current = null
      setContratempo({ tipo: 'conflito' })
      return
    }

    setContratempo({ tipo: 'indisponivel', mensagem })
  }

  if (confirmacao !== null) {
    return <Confirmado dados={confirmacao} />
  }

  const erroDe = (campo: string): ErroDeValidacao | undefined => porCampo.get(campo)

  const entrada = (
    campo: keyof Campos,
    caminho: string,
    rotulo: string,
    extras: InputHTMLAttributes<HTMLInputElement>,
  ) => {
    const erro = erroDe(caminho)
    const id = idDoCampo(caminho)

    return (
      <p className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor={id}>
          {rotulo}
        </label>
        <input
          {...extras}
          id={id}
          className={`${estilos.entrada} ${erro === undefined ? '' : estilos.entradaInvalida}`}
          value={campos[campo]}
          onChange={(e) => {
            const valor = e.target.value

            // A idade tem caminho próprio porque mudar de 17 para 18 apaga o
            // bloco do responsável, e não só o esconde (RF-07).
            if (campo === 'idade') {
              trocarIdade(valor.replace(/D/g, ''))
              return
            }

            trocar(campo, extras.type === 'tel' ? mascararTelefone(valor) : valor)
          }}
          ref={(el) => {
            elementos.current[caminho] = el
          }}
          aria-invalid={erro !== undefined}
          aria-describedby={erro === undefined ? undefined : `${id}-erro`}
        />
        {erro !== undefined && (
          <span className={estilos.erro} id={`${id}-erro`}>
            {erro.mensagem}
          </span>
        )}
      </p>
    )
  }

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>Inscrição na corrida</h1>
      <p className={estilos.subtitulo}>
        Leva menos de dois minutos. Todos os campos são obrigatórios.
      </p>

      {contratempo !== null && <Aviso contratempo={contratempo} />}

      {erros.length > 0 && (
        <div className={`${estilos.aviso} ${estilos.avisoErro}`} role="alert">
          <strong>
            Faltou corrigir {erros.length === 1 ? 'um item' : `${String(erros.length)} itens`}:
          </strong>
          {/*
            Cada erro é um link para o campo que o causou.

            O foco já vai para o primeiro campo inválido ao enviar, mas quem
            tem três erros precisa alcançar o segundo e o terceiro — e rolar
            um formulário longo procurando qual campo está vermelho é o que
            faz alguém desistir na fila (RNF-15).
          */}
          <ul className={estilos.resumo}>
            {erros.map((erro) => (
              <li key={`${erro.campo}-${erro.codigo}`}>
                <a
                  className={estilos.linkErro}
                  href={`#${idDoCampo(erro.campo)}`}
                  onClick={(evento) => {
                    // `preventDefault` porque o salto por âncora não move o
                    // foco do teclado: quem navega sem mouse ficaria com a
                    // tela no campo certo e o cursor onde estava.
                    evento.preventDefault()
                    const alvo =
                      elementos.current[erro.campo] ??
                      elementos.current[erro.campo.split('.')[0] ?? '']
                    alvo?.focus()
                    alvo?.scrollIntoView({ block: 'center' })
                  }}
                >
                  {erro.mensagem}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        `noValidate` desliga as mensagens do navegador. Elas chegam antes das
        nossas, em texto que não segue RNF-17 e que muda de navegador para
        navegador. `required` continua declarado, porque leitor de tela usa.
      */}
      <form
        className={estilos.formulario}
        onSubmit={(evento) => {
          void enviar(evento)
        }}
        noValidate
      >
        <fieldset className={estilos.secao}>
          <legend className={estilos.legenda}>Seus dados</legend>

          {entrada('nome', 'nome', 'Nome', {
            type: 'text',
            autoComplete: 'given-name',
            required: true,
            enterKeyHint: 'next',
          })}

          {entrada('sobrenome', 'sobrenome', 'Sobrenome', {
            type: 'text',
            autoComplete: 'family-name',
            required: true,
            enterKeyHint: 'next',
          })}

          {entrada('email', 'email', 'E-mail', {
            type: 'email',
            inputMode: 'email',
            autoComplete: 'email',
            autoCapitalize: 'none',
            spellCheck: false,
            required: true,
            enterKeyHint: 'next',
          })}

          {entrada('telefone', 'telefone', 'Telefone com DDD', {
            type: 'tel',
            inputMode: 'tel',
            autoComplete: 'tel',
            placeholder: '(11) 98765-4321',
            required: true,
            enterKeyHint: 'next',
          })}

          {entrada('idade', 'idade', 'Idade', {
            type: 'text',
            inputMode: 'numeric',
            pattern: '[0-9]*',
            autoComplete: 'off',
            maxLength: 3,
            required: true,
            enterKeyHint: 'next',
          })}

          {jovemDemais && (
            <div className={estilos.aviso} role="status">
              A participação é permitida a partir de {IDADE_MINIMA} anos. Quem tem menos não pode se
              inscrever nesta corrida.
            </div>
          )}
        </fieldset>

        {menor && (
          <fieldset className={estilos.secao}>
            <legend className={estilos.legenda}>Responsável</legend>
            <p className={estilos.dica}>
              Participantes com menos de {IDADE_MAIORIDADE} anos precisam da autorização de um
              responsável.
            </p>

            {entrada('responsavelNome', 'responsavel.nome', 'Nome do responsável', {
              type: 'text',
              autoComplete: 'off',
              required: true,
            })}

            {entrada('responsavelSobrenome', 'responsavel.sobrenome', 'Sobrenome do responsável', {
              type: 'text',
              autoComplete: 'off',
              required: true,
            })}

            {entrada('responsavelTelefone', 'responsavel.telefone', 'Telefone do responsável', {
              type: 'tel',
              inputMode: 'tel',
              autoComplete: 'off',
              placeholder: '(11) 98765-4321',
              required: true,
            })}
          </fieldset>
        )}

        <fieldset className={estilos.secao}>
          <legend className={estilos.legenda}>{COCKPIT.plural}</legend>
          <p className={estilos.dica}>
            Escolha {COCKPIT.artigoIndefinido} ou {COCKPIT.ambas}. Dá para correr {COCKPIT.emAmbas}.
          </p>

          <div className={estilos.opcoes}>
            {COCKPITS.map((cockpit) => (
              <label
                key={cockpit}
                className={`${estilos.opcao} ${cockpits.includes(cockpit) ? estilos.opcaoMarcada : ''}`}
              >
                <input
                  type="checkbox"
                  className={estilos.caixa}
                  checked={cockpits.includes(cockpit)}
                  onChange={() => {
                    alternarCockpit(cockpit)
                  }}
                  ref={(el) => {
                    if (cockpit === COCKPITS[0]) elementos.current['cockpits'] = el
                  }}
                  aria-invalid={erroDe('cockpits') !== undefined}
                />
                {nomeDoCockpit(cockpit)}
              </label>
            ))}
          </div>

          {erroDe('cockpits') !== undefined && (
            <span className={estilos.erro}>{erroDe('cockpits')?.mensagem}</span>
          )}
        </fieldset>

        <fieldset className={estilos.secao}>
          <legend className={estilos.legenda}>Consentimento</legend>

          <p className={estilos.destaque}>
            Se você concluir a inscrição, seu resultado aparece na página pública de classificação.
            Com 18 anos ou mais, aparece nome e sobrenome completos; com menos de 18, aparece o nome
            e a inicial do sobrenome. E-mail, telefone e idade nunca aparecem.{' '}
            <a className={estilos.link} {...linkTermo}>
              Ler o termo completo
            </a>{' '}
            (abre em outra aba, não apaga o que você já preencheu).
          </p>

          <div className={estilos.aceites}>
            {aceites
              .filter((aceite) => aceite.aplicaSe !== 'menor-de-18' || menor)
              .map((aceite) => {
                const campo = CAMPO_DO_ACEITE[aceite.id]
                const erro = erroDe(campo)

                return (
                  <label
                    key={aceite.id}
                    className={`${estilos.aceite} ${aceite.obrigatorio ? '' : estilos.aceiteOpcional}`}
                  >
                    <input
                      type="checkbox"
                      className={estilos.caixa}
                      checked={marcados[aceite.id] === true}
                      onChange={() => {
                        alternarAceite(aceite.id)
                      }}
                      ref={(el) => {
                        elementos.current[campo] = el
                      }}
                      // `obrigatorio` vem do termo, não de um julgamento feito
                      // aqui: é a diferença entre "sem isto não há cadastro" e
                      // "sem isto há cadastro, só não há repasse" (D-23).
                      required={aceite.obrigatorio}
                      aria-invalid={erro !== undefined}
                    />
                    <span>
                      <span className={estilos.etiqueta}>
                        {aceite.obrigatorio ? 'Obrigatório' : 'Opcional — pode deixar desmarcado'}
                      </span>
                      <span className={estilos.textoAceite}>{aceite.texto}</span>
                      {erro !== undefined && <span className={estilos.erro}> {erro.mensagem}</span>}
                    </span>
                  </label>
                )
              })}
          </div>
        </fieldset>

        <div className={estilos.armadilha} aria-hidden="true">
          <label htmlFor="empresa">Empresa</label>
          <input
            id="empresa"
            name="empresa"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={campos.empresa}
            onChange={(e) => {
              trocar('empresa', e.target.value)
            }}
          />
        </div>

        {/*
          O envio fica preso ao rodapé em tela de celular.

          O formulário tem cinco campos, mais três de responsável quando é o
          caso, mais três aceites: em 360px isso passa de duas telas de rolagem.
          Com o botão no fim do documento, quem termina de marcar os aceites
          ainda precisa rolar para achar como enviar — e o participante na fila
          interpreta isso como "travou". Preso ao rodapé, ele está sempre a um
          toque.

          Em tela grande a barra volta a ser um botão comum: ali o formulário
          inteiro cabe à vista, e uma barra fixa só roubaria altura.
        */}
        <div className={estilos.envio}>
          <button className={estilos.botao} type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Concluir inscrição'}
          </button>
        </div>

        <p className={estilos.dica}>Termo {versaoTermo}.</p>
      </form>
    </main>
  )
}

function Aviso({ contratempo }: { contratempo: Contratempo }) {
  const texto =
    contratempo.tipo === 'rede'
      ? 'A conexão falhou. Toque em "Concluir inscrição" de novo: se o primeiro envio tiver chegado, você não será cadastrado duas vezes.'
      : contratempo.tipo === 'expirado'
        ? 'Esta página ficou aberta tempo demais. Recarregue e envie de novo — o que você preencheu precisará ser digitado outra vez.'
        : contratempo.tipo === 'conflito'
          ? 'Algo mudou entre um envio e outro. Toque em "Concluir inscrição" de novo.'
          : contratempo.mensagem

  return (
    <div className={`${estilos.aviso} ${estilos.avisoErro}`} role="alert">
      {texto}
      {contratempo.tipo === 'expirado' && (
        <p>
          <button
            className={estilos.botaoSecundario}
            type="button"
            onClick={() => {
              window.location.reload()
            }}
          >
            Recarregar a página
          </button>
        </p>
      )}
    </div>
  )
}

/** Tela de sucesso (RF-10): o nome registrado e as pistas escolhidas. */
function Confirmado({ dados }: { dados: Confirmacao }) {
  return (
    <main className={estilos.confirmacao}>
      <div className={estilos.cartaoSucesso}>
        {/*
          A marca de concluído é forma e cor, nunca só cor: o círculo com o
          traço continua legível para quem não distingue verde de cinza, e o
          título ao lado diz a mesma coisa em palavras.
        */}
        <p className={estilos.selo} aria-hidden="true">
          ✓
        </p>

        <h1 className={estilos.tituloSucesso}>Inscrição concluída</h1>

        <p className={estilos.nomeConfirmado}>
          {dados.nome} {dados.sobrenome}
        </p>

        <p className={estilos.cockpitsConfirmados}>
          {dados.cockpits.length === 1
            ? nomeDoCockpit(dados.cockpits[0] ?? 1)
            : dados.cockpits.map(nomeDoCockpit).join(' e ')}
        </p>
      </div>

      <p className={estilos.proximoPasso}>
        <strong>Agora:</strong> procure a organização no ponto de inscrição para saber o horário da
        sua largada.
      </p>

      <div className={estilos.acoes}>
        <a className={estilos.botaoLink} href="/classificacao">
          Ver a classificação
        </a>
      </div>
    </main>
  )
}
