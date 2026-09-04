'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import * as api from './api'
import { focoDe, INICIAL, nomeCompleto, reduzir, type Alvo, type Estado } from './fluxo'
import { digitosDoCampo, formatarDigitacao, pareceCompleto } from './mascaraDeTempo'
import estilos from './painel.module.css'
import { COCKPIT, nomeDoCockpit } from '@/shared/vocabulario'

/**
 * O painel do Operador (T11 — RF-13 a RF-22, RF-24, RNF-16).
 *
 * A tela que alguém usa por dez horas, de pé, a ~3 lançamentos por minuto. O
 * PRD é explícito: fricção aqui vira fila de gente esperando. Daí as três
 * decisões que organizam o arquivo:
 *
 * 1. **A decisão do fluxo não mora aqui.** Está em `fluxo.ts`, como redutor
 *    puro, e é o que permite provar RF-18 — que nada é gravado sem passar pela
 *    confirmação — percorrendo estados e eventos num teste, em vez de lendo
 *    `onClick` com atenção.
 *
 * 2. **Teclado é o dispositivo primário.** O mouse funciona, mas nenhum passo
 *    depende dele: buscar, navegar, selecionar, digitar, confirmar e voltar ao
 *    início são todos alcançáveis sem tirar as mãos do teclado (RF-19).
 *
 * 3. **Nada some por causa de erro.** O comando fica guardado no estado até
 *    dar certo ou ser cancelado, e a retentativa reusa a mesma chave de
 *    idempotência — repetir não duplica (FL-06).
 */

const INTERVALO_DE_ATUALIZACAO_MS = 10_000
const DURACAO_DO_AVISO_MS = 4_000

type Props = {
  readonly operador: string
  readonly cockpitInicial: 1 | 2
}

export default function Painel({ operador, cockpitInicial }: Props) {
  const [estado, despachar] = useReducer(reduzir, INICIAL)
  const [cockpit, setCockpit] = useState<1 | 2>(cockpitInicial)
  const [busca, setBusca] = useState('')
  const [foraDaFila, setForaDaFila] = useState(false)
  const [fila, setFila] = useState<api.RespostaDaFila | null>(null)
  const [achados, setAchados] = useState<api.ParticipanteEncontrado[]>([])
  const [indice, setIndice] = useState(0)
  const [digitos, setDigitos] = useState('')
  /**
   * Por que o Enter recusou o tempo.
   *
   * Existe porque as três recusas de `confirmarTempo` eram `return` nus: o
   * Operador apertava Enter, nada acontecia, e a conclusão razoável era que o
   * sistema tinha travado. RNF-16 dá quinze segundos para o lançamento inteiro
   * — uma recusa muda gasta os quinze e não entrega nada.
   */
  const [recusa, setRecusa] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [historico, setHistorico] = useState<api.Lancamento[] | null>(null)

  const campoBusca = useRef<HTMLInputElement>(null)
  const campoTempo = useRef<HTMLInputElement>(null)
  const botaoConfirmar = useRef<HTMLButtonElement>(null)

  const tempoTexto = formatarDigitacao(digitos)

  /** O que a busca global mostra agora — derivado, não sincronizado. */
  const achadosVisiveis = foraDaFila && busca.trim() !== '' ? achados : []

  // ---------------------------------------------------------------- dados

  const consultarFila = useCallback(
    (sinal?: AbortSignal) => api.buscarFila(cockpit, foraDaFila ? '' : busca, sinal),
    [cockpit, busca, foraDaFila],
  )

  /**
   * Aplica o que a consulta trouxe.
   *
   * Separado da consulta porque toda escrita de estado precisa acontecer dentro
   * de um callback — chamar `setState` no corpo de um efeito encadeia
   * renderizações, e o React Compiler recusa.
   */
  const aplicarFila = useCallback((resultado: api.Resultado<api.RespostaDaFila>) => {
    if (resultado.ok) {
      setFila(resultado.dados)
      setOnline(true)
      return
    }

    // Falha de rede na atualização de fundo não vira alarme na tela: o Operador
    // está lançando, e um banner vermelho a cada 10 s por causa de um pacote
    // perdido custa mais atenção do que informa. O indicador de conexão no
    // cabeçalho já conta a história.
    if (resultado.falha.podeRepetir) setOnline(false)
  }, [])

  const recarregar = useCallback(() => {
    void consultarFila().then(aplicarFila)
  }, [consultarFila, aplicarFila])

  useEffect(() => {
    const controle = new AbortController()
    void consultarFila(controle.signal).then(aplicarFila)

    return () => {
      controle.abort()
    }
  }, [consultarFila, aplicarFila])

  /** Atualização periódica (escopo 4). Não mexe em foco nem em seleção. */
  useEffect(() => {
    const relogio = setInterval(recarregar, INTERVALO_DE_ATUALIZACAO_MS)
    return () => {
      clearInterval(relogio)
    }
  }, [recarregar])

  /**
   * Busca global, só quando o Operador pede (RF-22, RF-24).
   *
   * O efeito não limpa `achados` quando a busca esvazia — quem decide o que
   * aparece é a renderização, com `achadosVisiveis`. Limpar aqui seria manter
   * dois estados sincronizados à mão para exibir um que já dá para derivar.
   */
  useEffect(() => {
    if (!foraDaFila || busca.trim() === '') return

    const controle = new AbortController()
    const atraso = setTimeout(() => {
      void api.buscarParticipantes(busca, controle.signal).then((r) => {
        if (r.ok) setAchados(r.dados.itens)
      })
    }, 250)

    return () => {
      clearTimeout(atraso)
      controle.abort()
    }
  }, [foraDaFila, busca])

  // ---------------------------------------------------------------- foco

  useEffect(() => {
    const onde = focoDe(estado)

    if (onde === 'busca') campoBusca.current?.focus()
    if (onde === 'tempo') campoTempo.current?.focus()
    if (onde === 'confirmacao') botaoConfirmar.current?.focus()
  }, [estado])

  useEffect(() => {
    if (sucesso === null) return
    const relogio = setTimeout(() => {
      setSucesso(null)
    }, DURACAO_DO_AVISO_MS)
    return () => {
      clearTimeout(relogio)
    }
  }, [sucesso])

  // ------------------------------------------------------------- comandos

  const voltarAoInicio = useCallback(() => {
    setDigitos('')
    setRecusa(null)
    setIndice(0)
    despachar({ tipo: 'cancelar' })
  }, [])

  /**
   * A gravação acontece **por causa** da etapa `gravando`, não do clique.
   *
   * É o que fecha RF-18 do lado do componente: o único disparo de escrita está
   * amarrado a um estado que só o redutor produz, e o redutor só o produz a
   * partir da confirmação. Um botão novo que despache `confirmar` passa pela
   * mesma porta; um que tente gravar direto não tem porta nenhuma.
   */
  useEffect(() => {
    if (estado.etapa !== 'gravando') return

    const comando = estado.comando

    void api.executar(comando).then((resultado) => {
      if (resultado.ok) {
        setSucesso(
          comando.tipo === 'ausentar'
            ? `${nomeCompleto(comando.alvo)} marcado como ausente.`
            : `${nomeCompleto(comando.alvo)} — ${comando.tempoTexto} registrado.`,
        )
        setOnline(true)
        setBusca('')
        setDigitos('')
        setRecusa(null)
        setIndice(0)
        despachar({ tipo: 'sucesso' })
        recarregar()
        return
      }

      setOnline(!resultado.falha.podeRepetir)
      despachar({ tipo: 'falhar', ...resultado.falha })
    })
  }, [estado, recarregar])

  const selecionar = useCallback((item: api.ItemDaFila) => {
    const alvo: Alvo = {
      tentativaId: item.tentativaId,
      participanteId: item.participanteId,
      nome: item.nome,
      sobrenome: item.sobrenome,
      ultimos4Telefone: item.ultimos4Telefone,
    }
    setDigitos('')
    setRecusa(null)
    despachar({ tipo: 'selecionar', alvo })
  }, [])

  const corrigir = useCallback((p: api.ParticipanteEncontrado, t: api.TentativaEncontrada) => {
    setDigitos('')
    setRecusa(null)
    despachar({
      tipo: 'selecionarParaCorrigir',
      alvo: {
        tentativaId: t.tentativaId,
        participanteId: p.participanteId,
        nome: p.nome,
        sobrenome: p.sobrenome,
        ultimos4Telefone: p.ultimos4Telefone,
      },
      tempoAnterior: t.tempo,
    })
  }, [])

  const pedirAusencia = useCallback((item: api.ItemDaFila) => {
    despachar({
      tipo: 'pedirAusencia',
      chave: crypto.randomUUID(),
      alvo: {
        tentativaId: item.tentativaId,
        participanteId: item.participanteId,
        nome: item.nome,
        sobrenome: item.sobrenome,
        ultimos4Telefone: item.ultimos4Telefone,
      },
    })
  }, [])

  async function incluirNoOutroCockpit(
    p: api.ParticipanteEncontrado,
    destino: 1 | 2,
  ): Promise<void> {
    const r = await api.incluirNoCockpit(p.participanteId, destino)

    setSucesso(
      r.ok
        ? `${p.nome} ${p.sobrenome} entrou na fila do ${nomeDoCockpit(destino)}.`
        : r.falha.mensagem,
    )
    if (r.ok) recarregar()
  }

  async function verHistorico(tentativaId: string): Promise<void> {
    const r = await api.buscarHistorico(tentativaId)
    setHistorico(r.ok ? r.dados.lancamentos : [])
  }

  // ------------------------------------------------------------- teclado

  /**
   * Atalhos globais (RF-13, RF-19).
   *
   * `1` e `2` só trocam de Cockpit quando o foco **não** está num campo de texto —
   * senão o Operador digitando "12345" no tempo trocaria de aba a cada tecla.
   */
  useEffect(() => {
    function aoPressionar(evento: KeyboardEvent): void {
      const alvo = evento.target as HTMLElement | null
      const digitando = alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA'

      if (evento.key === 'Escape') {
        voltarAoInicio()
        return
      }

      // A T11 pede `1` e `2` para trocar de Cockpit. Sozinho, o atalho é
      // inutilizável: o foco vive no campo de busca durante toda a navegação da
      // Fila, e `1` e `2` são justamente os dígitos que mais se digita no
      // campo de tempo. `Alt` desempata sem tirar a mão do teclado, e as teclas
      // sozinhas continuam valendo quando o foco não está num campo de texto.
      if ((evento.altKey || !digitando) && (evento.key === '1' || evento.key === '2')) {
        evento.preventDefault()
        setCockpit(evento.key === '1' ? 1 : 2)
        return
      }

      // F2 marca ausência do item destacado. Tecla de função de propósito:
      // qualquer letra seria digitada dentro do campo de busca, que é onde o
      // foco vive durante a navegação da Fila.
      if (evento.key === 'F2' && estado.etapa === 'lista' && !foraDaFila) {
        const item = fila?.itens[indice]
        if (item !== undefined) {
          evento.preventDefault()
          pedirAusencia(item)
        }
      }

      if (evento.key === 'F3') {
        evento.preventDefault()
        setForaDaFila((v) => !v)
      }
    }

    window.addEventListener('keydown', aoPressionar)
    return () => {
      window.removeEventListener('keydown', aoPressionar)
    }
  }, [estado.etapa, fila, indice, foraDaFila, pedirAusencia, voltarAoInicio])

  function navegarNaLista(evento: React.KeyboardEvent<HTMLInputElement>): void {
    const itens = fila?.itens ?? []

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setIndice((i) => Math.min(i + 1, Math.max(itens.length - 1, 0)))
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndice((i) => Math.max(i - 1, 0))
    }

    if (evento.key === 'Enter') {
      evento.preventDefault()
      const item = itens[indice]
      if (item !== undefined) selecionar(item)
    }
  }

  /**
   * Enter no campo de tempo: abre a confirmação, ou **diz por que não abriu**.
   *
   * As três recusas aqui eram silenciosas, e a do meio era a pior: a máscara
   * mostra `00:99.99` de propósito, para o Operador ver que errou a digitação
   * (`mascaraDeTempo.ts`), e o Enter recusava esse valor sem dizer nada. A tela
   * exibia o erro e escondia o motivo da recusa — as duas metades da mesma
   * informação, separadas.
   *
   * Cada recusa nomeia o que fazer, e não só o que está errado (RNF-17). A
   * validação de verdade continua sendo do servidor; isto evita gastar uma ida
   * à rede com um valor que já se sabe recusado.
   */
  function confirmarTempo(evento: React.KeyboardEvent<HTMLInputElement>): void {
    if (evento.key !== 'Enter') return
    evento.preventDefault()

    if (!pareceCompleto(digitos)) {
      setRecusa(
        digitos === ''
          ? 'Digite o tempo antes de confirmar. Só números: 12345 vira 01:23.45.'
          : 'Tempo incompleto. Faltam números — o campo preenche da direita para a esquerda.',
      )
      return
    }

    let tempoMs: number
    try {
      // A conversão canônica é do servidor; esta aqui só evita abrir a
      // confirmação com um valor que já se sabe recusado.
      const [m, resto] = tempoTexto.split(':')
      const [s, c] = (resto ?? '').split('.')

      if (Number(s) > 59) {
        setRecusa(
          `${tempoTexto} tem mais de 59 segundos, o que nenhum relógio marca. Confira: os dois últimos números são centésimos.`,
        )
        return
      }

      tempoMs = Number(m) * 60_000 + Number(s) * 1_000 + Number(c) * 10
    } catch {
      setRecusa('Não consegui ler este tempo. Apague com Esc e digite de novo, só números.')
      return
    }

    setRecusa(null)
    despachar({ tipo: 'informarTempo', tempoMs, tempoTexto, chave: crypto.randomUUID() })
  }

  // ---------------------------------------------------------------- tela

  const itens = fila?.itens ?? []

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <h1 className={estilos.titulo}>Painel do Operador</h1>
        <p className={estilos.identidade}>
          {operador} ·{' '}
          <span className={`${estilos.conexao} ${online ? estilos.online : estilos.offline}`}>
            {online ? 'conectado' : 'sem conexão'}
          </span>
        </p>
      </header>

      <div
        className={estilos.abas}
        role="tablist"
        aria-label={`Escolha ${COCKPIT.artigo} ${COCKPIT.singular}`}
      >
        {([1, 2] as const).map((numero) => (
          <button
            key={numero}
            type="button"
            role="tab"
            aria-selected={cockpit === numero}
            className={`${estilos.aba} ${cockpit === numero ? estilos.abaAtiva : ''}`}
            onClick={() => {
              setCockpit(numero)
            }}
          >
            {nomeDoCockpit(numero)}
          </button>
        ))}

        <p className={estilos.contagem}>
          {fila?.pendentes ?? '—'} <span className={estilos.contagemRotulo}>na fila</span>
        </p>
      </div>

      {sucesso !== null && (
        <p className={estilos.sucesso} role="status">
          {sucesso}
        </p>
      )}

      {estado.etapa === 'falhou' && (
        <div className={estilos.aviso} role="alert">
          <p>{estado.mensagem}</p>
          <div className={estilos.acoesDialogo}>
            {estado.podeRepetir && (
              <button
                type="button"
                className={estilos.botao}
                onClick={() => {
                  despachar({ tipo: 'repetir' })
                }}
              >
                Repetir
              </button>
            )}
            <button
              type="button"
              className={`${estilos.botao} ${estilos.botaoSecundario}`}
              onClick={voltarAoInicio}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="busca">
          {foraDaFila
            ? 'Buscar em todos os inscritos (F3 volta à fila)'
            : 'Buscar na fila (F3 busca em todos)'}
        </label>
        <input
          ref={campoBusca}
          className={estilos.entrada}
          id="busca"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setIndice(0)
          }}
          onKeyDown={navegarNaLista}
        />
      </div>

      {estado.etapa === 'tempo' && (
        <div className={estilos.campo}>
          <label className={estilos.rotulo} htmlFor="tempo">
            Tempo de {nomeCompleto(estado.alvo)}
            {estado.tempoAnterior !== null && ` (atual: ${estado.tempoAnterior})`}
          </label>
          <input
            ref={campoTempo}
            className={`${estilos.entrada} ${estilos.entradaTempo}`}
            id="tempo"
            inputMode="numeric"
            autoComplete="off"
            placeholder="mm:ss.cc"
            value={tempoTexto}
            onChange={(e) => {
              setDigitos(digitosDoCampo(e.target.value))
              // A recusa morre na primeira tecla: ela falava do valor anterior.
              setRecusa(null)
            }}
            onKeyDown={confirmarTempo}
            aria-invalid={recusa !== null}
            aria-describedby={recusa === null ? 'tempo-dica' : 'tempo-recusa'}
          />
          {/*
            A recusa ocupa o lugar da dica, e não some sozinha.

            Ocupa o lugar porque as duas competiriam pela mesma olhada, e a
            recusa é a que importa quando existe — os atalhos que a dica repete
            estão no rodapé. Não some sozinha porque um aviso temporizado é
            aviso que o Operador perde justamente quando desviou o olho para o
            cronômetro.
          */}
          {recusa === null ? (
            <p className={estilos.dica} id="tempo-dica">
              Digite só os números. Enter confirma, Esc cancela.
            </p>
          ) : (
            <p className={estilos.recusa} id="tempo-recusa" role="alert">
              {recusa}
            </p>
          )}
        </div>
      )}

      {!foraDaFila && (
        <ul className={estilos.lista}>
          {itens.map((item, posicao) => (
            <li key={item.tentativaId}>
              <button
                type="button"
                className={`${estilos.item} ${posicao === indice ? estilos.itemSelecionado : ''}`}
                onClick={() => {
                  setIndice(posicao)
                  selecionar(item)
                }}
              >
                <span className={estilos.nome}>
                  {item.nome} {item.sobrenome}
                </span>
                <span className={estilos.digitos}>····{item.ultimos4Telefone}</span>
              </button>
            </li>
          ))}
          {itens.length === 0 && (
            <li className={estilos.vazio}>
              {busca.trim() === ''
                ? `Nenhuma tentativa pendente ${COCKPIT.artigo === 'o' ? 'neste' : 'nesta'} ${COCKPIT.singular}.`
                : 'Ninguém na fila com esse nome. F3 busca em todos os inscritos.'}
            </li>
          )}
        </ul>
      )}

      {foraDaFila && (
        <ul className={estilos.lista}>
          {achadosVisiveis.map((p) => (
            <li key={p.participanteId} className={estilos.item}>
              <div>
                <span className={estilos.nome}>
                  {p.nome} {p.sobrenome}
                </span>{' '}
                <span className={estilos.digitos}>····{p.ultimos4Telefone}</span>
                <div className={estilos.historico}>
                  {p.tentativas.map((t) => (
                    <span key={t.tentativaId}>
                      {nomeDoCockpit(t.cockpit)}: {t.estado === 'valida' ? t.tempo : t.estado}{' '}
                      {t.estado === 'valida' && (
                        <button
                          type="button"
                          className={`${estilos.botao} ${estilos.botaoSecundario}`}
                          onClick={() => {
                            corrigir(p, t)
                          }}
                        >
                          Corrigir
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${estilos.botao} ${estilos.botaoSecundario}`}
                        onClick={() => void verHistorico(t.tentativaId)}
                      >
                        Histórico
                      </button>{' '}
                    </span>
                  ))}
                  {([1, 2] as const)
                    .filter((n) => !p.tentativas.some((t) => t.cockpit === n))
                    .map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={estilos.botao}
                        onClick={() => void incluirNoOutroCockpit(p, n)}
                      >
                        Incluir {COCKPIT.artigo === 'o' ? 'no' : 'na'} {nomeDoCockpit(n)}
                      </button>
                    ))}
                </div>
              </div>
            </li>
          ))}
          {achadosVisiveis.length === 0 && (
            <li className={estilos.vazio}>Digite um nome para buscar entre todos os inscritos.</li>
          )}
        </ul>
      )}

      {historico !== null && (
        <div className={estilos.fundo} role="dialog" aria-label="Histórico da tentativa">
          <div className={estilos.dialogo}>
            <h2 className={estilos.dialogoTitulo}>Histórico</h2>
            <ul className={estilos.historico}>
              {historico.map((l) => (
                <li key={l.id}>
                  {l.hora} · {l.tipo} · {l.tempoAnterior === null ? '' : `${l.tempoAnterior} → `}
                  {l.tempoNovo ?? '—'} · {l.operador}
                </li>
              ))}
              {historico.length === 0 && <li>Nenhum lançamento ainda.</li>}
            </ul>
            <div className={estilos.acoesDialogo}>
              <button
                type="button"
                className={estilos.botao}
                onClick={() => {
                  setHistorico(null)
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {(estado.etapa === 'confirmar' || estado.etapa === 'gravando') && (
        <div
          className={estilos.fundo}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar lançamento"
        >
          <div className={estilos.dialogo}>
            <h2 className={estilos.dialogoTitulo}>
              {estado.comando.tipo === 'ausentar' ? 'Marcar como ausente' : 'Confirmar lançamento'}
            </h2>

            {/* O nome em destaque que RF-18 exige, antes de qualquer gravação. */}
            <p className={estilos.nomeDestaque}>{nomeCompleto(estado.comando.alvo)}</p>
            <p className={estilos.digitos}>····{estado.comando.alvo.ultimos4Telefone}</p>

            {estado.comando.tipo !== 'ausentar' && (
              <p className={estilos.tempoDestaque}>
                {estado.comando.tipo === 'corrigir' && estado.comando.tempoAnterior !== null && (
                  <>
                    <span className={estilos.anterior}>{estado.comando.tempoAnterior}</span>{' '}
                  </>
                )}
                {estado.comando.tempoTexto}
              </p>
            )}

            <div className={estilos.acoesDialogo}>
              <button
                ref={botaoConfirmar}
                type="button"
                className={estilos.botao}
                disabled={estado.etapa === 'gravando'}
                onClick={() => {
                  despachar({ tipo: 'confirmar' })
                }}
              >
                {estado.etapa === 'gravando' ? 'Gravando…' : 'Confirmar (Enter)'}
              </button>
              <button
                type="button"
                className={`${estilos.botao} ${estilos.botaoSecundario}`}
                onClick={voltarAoInicio}
              >
                Cancelar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className={estilos.rodape}>
        <span>
          Alt+1 / Alt+2 troca de {COCKPIT.singular} · ↑ ↓ navega · Enter seleciona · F2 ausência ·
          F3 busca global · Esc cancela
        </span>
        {fila?.truncado === true && (
          <span>Mostrando os primeiros {itens.length} — refine a busca.</span>
        )}
      </footer>
    </main>
  )
}
