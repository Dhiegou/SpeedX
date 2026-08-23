'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import estilos from './classificacao.module.css'
import { classificar, contarLinhas, encontrar, montarBlocos, type FiltroDePitch } from './filtro'
import type { DocumentoTransmitido } from '@/contexts/classificacao'
import { formatTempo } from '@/shared/tempo'
import { nomeDaPista, PISTA } from '@/shared/vocabulario'

/**
 * A tabela pública (T13 — RF-27 a RF-33, RNF-18).
 *
 * O PRD chama isto de "o momento de engajamento hoje desperdiçado": a pessoa
 * quer descobrir a própria posição sem perguntar a ninguém. Três decisões vêm
 * daí:
 *
 * 1. **Filtro e busca não voltam ao servidor.** O documento inteiro chegou de
 *    uma vez (T12); filtrar e procurar acontecem aqui. Uma requisição por tecla
 *    digitada, com 2000 pessoas buscando ao mesmo tempo, é o cenário que
 *    derruba o sistema (SDD BC-03).
 *
 * 2. **A busca destaca, não esconde.** O resultado vem cercado das vizinhas —
 *    quem se acha em 437º quer ver quem está em 436 e 438. A regra está em
 *    `filtro.ts`, testada sem DOM.
 *
 * 3. **Erro de rede nunca esvazia a tabela.** O documento anterior fica na
 *    tela com um aviso discreto. Quem está procurando o próprio nome não pode
 *    perder a lista porque um pacote se perdeu.
 */

/** Polling de fundo (FL-08). Pausa quando a aba sai de vista. */
const INTERVALO_MS = 15_000

/** Quantas linhas aparecem sem interação. RF-33 exige ao menos 100. */
const PAGINA = 100

type Props = {
  readonly inicial: DocumentoTransmitido
}

function tempoRelativo(desde: string, agora: number): string {
  const segundos = Math.max(0, Math.round((agora - Date.parse(desde)) / 1000))

  if (segundos < 60) return `há ${String(segundos)} s`
  if (segundos < 3600) return `há ${String(Math.floor(segundos / 60))} min`

  return `há ${String(Math.floor(segundos / 3600))} h`
}

export default function Classificacao({ inicial }: Props) {
  const [documento, setDocumento] = useState(inicial)
  const [pitch, setPitch] = useState<FiltroDePitch>('todos')
  const [busca, setBusca] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  const [atualizando, setAtualizando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  const linhas = useMemo(() => classificar(documento.linhas, pitch), [documento.linhas, pitch])
  const achados = useMemo(() => encontrar(linhas, busca), [linhas, busca])
  const blocos = useMemo(() => montarBlocos(linhas, achados, limite), [linhas, achados, limite])

  const mostradas = contarLinhas(blocos)
  const buscando = busca.trim() !== ''
  const haMais = !buscando && mostradas < linhas.length

  /**
   * Busca a versão mais recente.
   *
   * `no-store` no `fetch` para que o navegador não sirva a própria cópia: a
   * borda já guarda por 15 s (T12), e um segundo cache aqui só somaria
   * defasagem ao orçamento de 30 s de RNF-03.
   */
  const atualizar = useCallback(() => {
    setAtualizando(true)

    void fetch('/api/classificacao', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<DocumentoTransmitido>) : Promise.reject(r.status)))
      .then((novo) => {
        setDocumento(novo)
        setFalhou(false)
        setAgora(Date.now())
      })
      .catch(() => {
        // A tabela antiga fica. Perder a lista por causa de um pacote é pior
        // que mostrá-la um pouco velha, e o aviso diz qual é o caso.
        setFalhou(true)
      })
      .finally(() => {
        setAtualizando(false)
      })
  }, [])

  /** Polling, pausado com a aba em segundo plano (escopo 5). */
  useEffect(() => {
    const relogio = setInterval(() => {
      if (document.visibilityState === 'visible') atualizar()
    }, INTERVALO_MS)

    return () => {
      clearInterval(relogio)
    }
  }, [atualizar])

  /** O relógio do rótulo "atualizado há X" precisa andar sozinho. */
  useEffect(() => {
    const relogio = setInterval(() => {
      setAgora(Date.now())
    }, 1_000)

    return () => {
      clearInterval(relogio)
    }
  }, [])

  function trocarPitch(novo: FiltroDePitch): void {
    setPitch(novo)
    // A paginação volta ao começo: manter 400 linhas carregadas de um Pitch ao
    // trocar para o outro daria uma lista longa que ninguém pediu.
    setLimite(PAGINA)
  }

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>Classificação</h1>
      <p className={estilos.subtitulo}>
        Os tempos aparecem conforme as corridas terminam. Procure seu nome abaixo.
      </p>

      <div className={estilos.controles}>
        <div className={estilos.abas} role="tablist" aria-label={`Filtrar por ${PISTA.singular}`}>
          {(['todos', 1, 2] as const).map((opcao) => (
            <button
              key={String(opcao)}
              type="button"
              role="tab"
              aria-selected={pitch === opcao}
              className={`${estilos.aba} ${pitch === opcao ? estilos.abaAtiva : ''}`}
              onClick={() => {
                trocarPitch(opcao)
              }}
            >
              {opcao === 'todos' ? 'Todos' : nomeDaPista(opcao)}
            </button>
          ))}
        </div>

        <label className="visually-hidden" htmlFor="busca">
          Buscar por nome
        </label>
        <input
          className={estilos.entrada}
          id="busca"
          type="search"
          placeholder="Buscar por nome"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
          }}
        />
      </div>

      <div className={estilos.estado}>
        <span>
          {buscando
            ? `${String(achados.size)} encontrado(s) de ${String(linhas.length)}`
            : `${String(linhas.length)} tempo(s) registrado(s)`}
        </span>
        <span>
          {/* RF-32: relativo na tela, absoluto no `title`. */}
          <span title={new Date(documento.geradoEm).toLocaleString('pt-BR')}>
            atualizado {tempoRelativo(documento.geradoEm, agora)}
          </span>{' '}
          <button
            type="button"
            className={estilos.botao}
            onClick={atualizar}
            disabled={atualizando}
          >
            {atualizando ? 'Atualizando…' : 'Atualizar'}
          </button>
        </span>
      </div>

      {falhou && (
        <p className={estilos.aviso} role="status">
          Não foi possível atualizar agora. A lista abaixo é a última que chegou.
        </p>
      )}

      {linhas.length === 0 && (
        <p className={estilos.vazio}>
          Ainda não há tempos registrados. Eles aparecem aqui conforme as corridas terminam.
        </p>
      )}

      {linhas.length > 0 && buscando && achados.size === 0 && (
        <p className={estilos.vazio}>
          Nenhum nome com “{busca.trim()}”. Confira a grafia — a busca ignora acentos e maiúsculas.
        </p>
      )}

      {blocos.length > 0 && (
        <table className={estilos.tabela}>
          <thead>
            <tr>
              <th scope="col" className={estilos.posicao}>
                #
              </th>
              <th scope="col">Nome</th>
              <th scope="col" className={estilos.pitch}>
                {PISTA.singular}
              </th>
              <th scope="col" className={estilos.tempo}>
                Tempo
              </th>
            </tr>
          </thead>
          <tbody>
            {blocos.map((bloco, i) =>
              bloco.tipo === 'lacuna' ? (
                <tr key={`lacuna-${String(i)}`} className={estilos.lacuna}>
                  <td colSpan={4}>⋯ {bloco.quantidade} posição(ões) entre os resultados ⋯</td>
                </tr>
              ) : (
                bloco.linhas.map((linha) => (
                  <tr
                    key={linha.indice}
                    className={achados.has(linha.indice) ? estilos.destacada : undefined}
                    aria-current={achados.has(linha.indice) ? 'true' : undefined}
                  >
                    <td className={estilos.posicao}>{linha.posicao}</td>
                    <td className={estilos.nome}>{linha.nomePublico}</td>
                    <td className={estilos.pitch}>{nomeDaPista(linha.pitch)}</td>
                    <td className={estilos.tempo}>{formatTempo(linha.tempoMs)}</td>
                  </tr>
                ))
              ),
            )}
          </tbody>
        </table>
      )}

      {haMais && (
        <p className={estilos.rodape}>
          <button
            type="button"
            className={estilos.botao}
            onClick={() => {
              // Sobre o documento que já está em memória: nenhuma requisição.
              setLimite((v) => v + PAGINA)
            }}
          >
            Mostrar mais ({String(linhas.length - mostradas)} restantes)
          </button>
        </p>
      )}
    </main>
  )
}
