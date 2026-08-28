import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { autenticar } from '@/contexts/identidade/autenticar'
import {
  criarOperador,
  desativarOperador,
  OperadorDuplicadoError,
} from '@/contexts/identidade/criarOperador'
import { destravarLogin } from '@/contexts/identidade/destravarLogin'
import {
  ESCOPO_LOGIN_ORIGEM,
  ESCOPO_LOGIN_USUARIO,
  identificarUsuario,
} from '@/contexts/identidade/politicaDeLogin'
import {
  conferirSenha,
  gerarHash,
  SenhaFracaError,
  validarForcaDaSenha,
} from '@/contexts/identidade/senha'
import {
  abrirSessao,
  digerirToken,
  encerrarSessao,
  expurgarSessoesInativas,
  renovarSessao,
  resolverSessao,
} from '@/contexts/identidade/sessao'
import * as schema from '@/db/schema'
import { criarBancoDeTeste, type BancoDeTeste } from './apoio/bancoDeTeste'

/**
 * T08 — Identidade e Acesso (RF-11, RF-12, RNF-14).
 *
 * Contra Postgres real, como o resto da suíte: a unicidade sem distinção de
 * caixa do nome de usuário e a coerência entre sessão e conta são constraints e
 * junções, e testá-las contra um mock verificaria o mock.
 *
 * **Este arquivo tem prazo próprio, e não é folga arbitrária.** A derivação de
 * senha reserva 64 MiB e gasta uns 250 ms por conferência, de propósito (D-37);
 * os testes do limite de login fazem vinte e uma delas em sequência, porque é
 * assim que se prova que o balde conta tentativa errada. São ~6 s de scrypt num
 * caso só — e, com dois workers disputando a máquina, os 30 s globais do
 * `vitest.config.mts` viravam um teste que falhava na suíte cheia e passava
 * sozinho. Falso vermelho intermitente é pior que teste lento: ensina o time a
 * repetir a execução até passar.
 *
 * O que **não** foi feito: baixar o custo do scrypt em teste. Uma variável de
 * ambiente que enfraquece a derivação de senha é uma variável que um dia vaza
 * para produção, e o teste passaria a exercitar um algoritmo que ninguém usa.
 */
vi.setConfig({ testTimeout: 120_000 })

const SENHA = 'senha-de-operador-2026'
const AGORA = new Date('2026-09-12T08:00:00Z').getTime()
const HORA = 60 * 60 * 1000

let banco: BancoDeTeste

beforeAll(async () => {
  banco = await criarBancoDeTeste()
})

afterAll(async () => {
  await banco.encerrar()
})

beforeEach(async () => {
  await banco.db.delete(schema.sessao)
  await banco.db.delete(schema.limiteTaxa)
  await banco.db.delete(schema.operador)
})

async function operadorDeTeste(usuario = 'marina', nome = 'Marina Costa') {
  return criarOperador(banco.db, { usuario, nome, senha: SENHA })
}

describe('senha', () => {
  it('o hash não contém a senha e confere apenas a senha certa', async () => {
    const hash = await gerarHash(SENHA)

    expect(hash).not.toContain(SENHA)
    expect(hash.startsWith('scrypt')).toBe(true)
    expect(await conferirSenha(SENHA, hash)).toBe(true)
    expect(await conferirSenha(SENHA + 'x', hash)).toBe(false)
  })

  it('dois hashes da mesma senha são diferentes — o sal é por hash', async () => {
    expect(await gerarHash(SENHA)).not.toBe(await gerarHash(SENHA))
  })

  it('hash corrompido devolve falso em vez de estourar', async () => {
    // Uma linha ilegível no banco não pode virar 500 na tela de login: a
    // diferença entre erro e recusa é justamente o que não se conta a quem
    // está sondando.
    for (const lixo of ['', 'nao-serve-para-login', 'scrypt$1$2$3', 'argon2$x$y$z$w$v']) {
      expect(await conferirSenha(SENHA, lixo)).toBe(false)
    }
  })

  it('recusa senha curta e senha absurdamente longa', () => {
    expect(() => validarForcaDaSenha('curta')).toThrow(SenhaFracaError)
    expect(() => validarForcaDaSenha('x'.repeat(500))).toThrow(SenhaFracaError)
    expect(validarForcaDaSenha(SENHA)).toBe(SENHA)
  })
})

describe('criação de conta (RNF-14)', () => {
  it('cria o Operador com hash, nunca com a senha', async () => {
    const criado = await operadorDeTeste()

    const [linha] = await banco.db
      .select()
      .from(schema.operador)
      .where(eq(schema.operador.id, criado.id))

    expect(linha?.senhaHash).not.toContain(SENHA)
    expect(linha?.ativo).toBe(true)
  })

  it('recusa usuário repetido, inclusive com outra caixa', async () => {
    await operadorDeTeste('marina')

    await expect(operadorDeTeste('marina')).rejects.toThrow(OperadorDuplicadoError)
    // Sem a unicidade funcional no banco, `Marina` conviveria com `marina` e a
    // busca do login casaria com as duas, escolhendo uma por acaso.
    await expect(operadorDeTeste('MARINA')).rejects.toThrow(OperadorDuplicadoError)
  })

  it('recusa senha fraca antes de gravar qualquer coisa', async () => {
    await expect(
      criarOperador(banco.db, { usuario: 'joao', nome: 'João Lima', senha: '123' }),
    ).rejects.toThrow(SenhaFracaError)

    expect(await banco.db.select().from(schema.operador)).toHaveLength(0)
  })
})

describe('login (RF-11)', () => {
  it('autentica com a credencial certa e abre uma sessão', async () => {
    const operador = await operadorDeTeste()

    const resultado = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: '203.0.113.7',
      agora: AGORA,
    })

    expect(resultado.situacao).toBe('autenticado')
    if (resultado.situacao !== 'autenticado') return

    expect(resultado.operador).toEqual({ id: operador.id, nome: 'Marina Costa' })
    expect(resultado.expiraEm.getTime()).toBeGreaterThan(AGORA + 15 * HORA)

    const [linha] = await banco.db.select().from(schema.sessao)
    // O token vai para o cookie; o que fica no banco é o HMAC dele.
    expect(linha?.tokenHash).toBe(digerirToken(resultado.token))
    expect(linha?.tokenHash).not.toBe(resultado.token)
  })

  it('aceita o usuário em qualquer caixa — teclado de tablet capitaliza', async () => {
    await operadorDeTeste('marina')

    const resultado = await autenticar(banco.db, {
      corpo: { usuario: 'Marina', senha: SENHA },
      origem: null,
      agora: AGORA,
    })

    expect(resultado.situacao).toBe('autenticado')
  })

  it('recusa usuário inexistente e senha errada da mesma forma', async () => {
    await operadorDeTeste()

    const inexistente = await autenticar(banco.db, {
      corpo: { usuario: 'ninguem', senha: SENHA },
      origem: null,
      agora: AGORA,
    })
    const senhaErrada = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: 'senha-errada-porem-longa' },
      origem: null,
      agora: AGORA,
    })

    expect(inexistente).toEqual({ situacao: 'credenciais_invalidas' })
    expect(senhaErrada).toEqual({ situacao: 'credenciais_invalidas' })
  })

  it('conta desativada não entra, e a recusa é a mesma', async () => {
    await operadorDeTeste()
    expect(await desativarOperador(banco.db, 'MARINA')).toBe(true)

    const resultado = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: null,
      agora: AGORA,
    })

    expect(resultado).toEqual({ situacao: 'credenciais_invalidas' })
  })

  it('corpo malformado é recusa, não erro', async () => {
    for (const corpo of [null, {}, { usuario: 'marina' }, { usuario: 1, senha: 2 }, 'texto']) {
      const resultado = await autenticar(banco.db, { corpo, origem: null, agora: AGORA })
      expect(resultado.situacao).toBe('credenciais_invalidas')
    }
  })

  it('a tentativa recusada consome cota; a bem-sucedida não', async () => {
    await operadorDeTeste()

    await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: 'errada-porem-longa' },
      origem: '203.0.113.7',
      agora: AGORA,
    })

    const aposFalha = await banco.db.select().from(schema.limiteTaxa)
    expect(aposFalha.map((l) => l.escopo).sort()).toEqual(
      [ESCOPO_LOGIN_ORIGEM, ESCOPO_LOGIN_USUARIO].sort(),
    )

    await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: '203.0.113.7',
      agora: AGORA,
    })

    expect(await banco.db.select().from(schema.limiteTaxa)).toHaveLength(aposFalha.length)
  })

  it('o identificador gravado é o HMAC do usuário, não o usuário', async () => {
    await operadorDeTeste()

    await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: 'errada-porem-longa' },
      origem: '203.0.113.7',
      agora: AGORA,
    })

    const linhas = await banco.db.select().from(schema.limiteTaxa)

    for (const linha of linhas) {
      expect(linha.identificador).not.toContain('marina')
      expect(linha.identificador).not.toContain('203.0.113.7')
    }

    const porUsuario = linhas.find((l) => l.escopo === ESCOPO_LOGIN_USUARIO)
    expect(porUsuario?.identificador).toBe(identificarUsuario('MARINA'))
  })

  it('tentativas demais travam a conta por um tempo (força bruta)', async () => {
    await operadorDeTeste()

    for (let i = 0; i < 10; i += 1) {
      const resultado = await autenticar(banco.db, {
        corpo: { usuario: 'marina', senha: 'errada-porem-longa-' + String(i) },
        origem: '203.0.113.7',
        agora: AGORA,
      })
      expect(resultado.situacao).toBe('credenciais_invalidas')
    }

    const travado = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: '203.0.113.7',
      agora: AGORA,
    })

    expect(travado.situacao).toBe('limite_excedido')
    if (travado.situacao !== 'limite_excedido') return
    expect(travado.esperarSegundos).toBeGreaterThan(0)

    // Passada a janela, a mesma credencial volta a funcionar. Um limite que não
    // solta é uma negação de serviço contra o próprio Operador.
    const depois = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: '203.0.113.7',
      agora: AGORA + 3 * HORA,
    })

    expect(depois.situacao).toBe('autenticado')
  })

  it('o destravamento devolve o acesso a quem ficou preso pelo próprio erro', async () => {
    await operadorDeTeste()

    for (let i = 0; i < 10; i += 1) {
      await autenticar(banco.db, {
        corpo: { usuario: 'marina', senha: 'errada-porem-longa-' + String(i) },
        origem: '203.0.113.7',
        agora: AGORA,
      })
    }

    expect(
      (
        await autenticar(banco.db, {
          corpo: { usuario: 'marina', senha: SENHA },
          origem: '203.0.113.7',
          agora: AGORA,
        })
      ).situacao,
    ).toBe('limite_excedido')

    // Senha de doze caracteres, tablet, de pé, sob sol, teclado capitalizando a
    // primeira letra: errar dez vezes não é hipótese remota, e quinze minutos
    // de espera é a fila de um Cockpit parada (RNF-16).
    const { porConta, porOrigem } = await destravarLogin(banco.db, 'MARINA')

    expect(porConta).toBe(10)
    expect(porOrigem).toBe(10)

    expect(
      (
        await autenticar(banco.db, {
          corpo: { usuario: 'marina', senha: SENHA },
          origem: '203.0.113.7',
          agora: AGORA,
        })
      ).situacao,
    ).toBe('autenticado')
  })

  it('o destravamento não desliga o limite: ele volta a contar em seguida', async () => {
    await operadorDeTeste()

    for (let i = 0; i < 10; i += 1) {
      await autenticar(banco.db, {
        corpo: { usuario: 'marina', senha: 'errada-porem-longa-' + String(i) },
        origem: '203.0.113.7',
        agora: AGORA,
      })
    }

    await destravarLogin(banco.db, 'marina')

    for (let i = 0; i < 10; i += 1) {
      await autenticar(banco.db, {
        corpo: { usuario: 'marina', senha: 'de-novo-errada-' + String(i) },
        origem: '203.0.113.7',
        agora: AGORA,
      })
    }

    expect(
      (
        await autenticar(banco.db, {
          corpo: { usuario: 'marina', senha: SENHA },
          origem: '203.0.113.7',
          agora: AGORA,
        })
      ).situacao,
    ).toBe('limite_excedido')
  })

  it('o destravamento não encosta no limite do cadastro público', async () => {
    // O que protege as duas mil inscrições (RNF-12) não pode cair junto com um
    // Operador que errou a senha.
    await banco.db
      .insert(schema.limiteTaxa)
      .values({ escopo: 'cadastro', identificador: 'marca-de-cadastro' })

    await destravarLogin(banco.db, 'marina')

    const restantes = await banco.db.select().from(schema.limiteTaxa)
    expect(restantes.map((l) => l.escopo)).toEqual(['cadastro'])
  })

  it('a trava por conta segue a conta, mesmo trocando de origem', async () => {
    await operadorDeTeste()

    for (let i = 0; i < 10; i += 1) {
      await autenticar(banco.db, {
        corpo: { usuario: 'marina', senha: 'errada-porem-longa-' + String(i) },
        // Origem diferente a cada vez: é o que uma botnet faz, e é o motivo de
        // existir uma contagem por conta além da contagem por origem.
        origem: '198.51.100.' + String(i),
        agora: AGORA,
      })
    }

    const travado = await autenticar(banco.db, {
      corpo: { usuario: 'marina', senha: SENHA },
      origem: '198.51.100.200',
      agora: AGORA,
    })

    expect(travado.situacao).toBe('limite_excedido')
  })
})

describe('sessão (RF-12)', () => {
  it('resolve o token no Operador dono da sessão', async () => {
    const operador = await operadorDeTeste()
    const { token } = await abrirSessao(banco.db, operador.id, AGORA)

    const sessao = await resolverSessao(banco.db, token, AGORA)

    expect(sessao?.operador).toEqual(operador)
  })

  it('token ausente, vazio ou inventado não resolve', async () => {
    const operador = await operadorDeTeste()
    await abrirSessao(banco.db, operador.id, AGORA)

    for (const token of [null, undefined, '', 'token-inventado']) {
      expect(await resolverSessao(banco.db, token, AGORA)).toBeNull()
    }
  })

  it('sessões simultâneas de Operadores distintos não se invalidam (RF-12)', async () => {
    const marina = await operadorDeTeste('marina', 'Marina Costa')
    const joao = await operadorDeTeste('joao', 'João Lima')

    const sessaoMarina = await abrirSessao(banco.db, marina.id, AGORA)
    const sessaoJoao = await abrirSessao(banco.db, joao.id, AGORA)

    expect((await resolverSessao(banco.db, sessaoMarina.token, AGORA))?.operador).toEqual(marina)
    expect((await resolverSessao(banco.db, sessaoJoao.token, AGORA))?.operador).toEqual(joao)
  })

  it('duas sessões do mesmo Operador convivem — dois tablets no mesmo Cockpit', async () => {
    const marina = await operadorDeTeste()

    const tablet = await abrirSessao(banco.db, marina.id, AGORA)
    const celular = await abrirSessao(banco.db, marina.id, AGORA)

    expect(await resolverSessao(banco.db, tablet.token, AGORA)).not.toBeNull()
    expect(await resolverSessao(banco.db, celular.token, AGORA)).not.toBeNull()

    // E o logout de uma não derruba a outra.
    await encerrarSessao(banco.db, tablet.token, AGORA)

    expect(await resolverSessao(banco.db, tablet.token, AGORA)).toBeNull()
    expect(await resolverSessao(banco.db, celular.token, AGORA)).not.toBeNull()
  })

  it('sobrevive a dez horas de uso contínuo e cai depois do teto', async () => {
    const operador = await operadorDeTeste()
    const { token } = await abrirSessao(banco.db, operador.id, AGORA)

    // Dez horas é a jornada do evento (PRD §2). Sem renovação nenhuma, a
    // sessão de 16 horas já cobre isso — a renovação é folga, não a garantia.
    expect(await resolverSessao(banco.db, token, AGORA + 10 * HORA)).not.toBeNull()
    expect(await resolverSessao(banco.db, token, AGORA + 17 * HORA)).toBeNull()
  })

  it('a renovação empurra o prazo, e não grava a cada requisição', async () => {
    const operador = await operadorDeTeste()
    const { token } = await abrirSessao(banco.db, operador.id, AGORA)

    const recem = await resolverSessao(banco.db, token, AGORA)
    expect(recem).not.toBeNull()
    if (recem === null) return

    // Um minuto depois de abrir: nada a gravar.
    expect(await renovarSessao(banco.db, recem, AGORA + 60_000)).toBeNull()

    const emUso = await resolverSessao(banco.db, token, AGORA + 9 * HORA)
    expect(emUso).not.toBeNull()
    if (emUso === null) return

    const novoPrazo = await renovarSessao(banco.db, emUso, AGORA + 9 * HORA)
    expect(novoPrazo).not.toBeNull()

    // Renovada às 9h de uso, a sessão passa das 17h que a derrubariam antes.
    expect(await resolverSessao(banco.db, token, AGORA + 17 * HORA)).not.toBeNull()
  })

  it('renovar não ressuscita sessão encerrada', async () => {
    const operador = await operadorDeTeste()
    const { token } = await abrirSessao(banco.db, operador.id, AGORA)

    const sessao = await resolverSessao(banco.db, token, AGORA)
    expect(sessao).not.toBeNull()
    if (sessao === null) return

    await encerrarSessao(banco.db, token, AGORA)
    await renovarSessao(banco.db, sessao, AGORA + 9 * HORA)

    expect(await resolverSessao(banco.db, token, AGORA + 9 * HORA)).toBeNull()
  })

  it('desativar a conta derruba as sessões já abertas', async () => {
    const operador = await operadorDeTeste()
    const { token } = await abrirSessao(banco.db, operador.id, AGORA)

    expect(await resolverSessao(banco.db, token, AGORA)).not.toBeNull()

    await desativarOperador(banco.db, 'marina')

    // É este teste que justifica a sessão morar no banco: com um cookie
    // assinado e autocontido, a linha acima não teria efeito nenhum até o
    // prazo vencer, dezesseis horas depois.
    expect(await resolverSessao(banco.db, token, AGORA)).toBeNull()
  })

  it('o expurgo leva o que expirou e o que foi encerrado, e poupa o que vale', async () => {
    const operador = await operadorDeTeste()

    const viva = await abrirSessao(banco.db, operador.id, AGORA)
    await abrirSessao(banco.db, operador.id, AGORA - 40 * HORA)
    const encerrada = await abrirSessao(banco.db, operador.id, AGORA)
    await encerrarSessao(banco.db, encerrada.token, AGORA)

    await expurgarSessoesInativas(banco.db, AGORA)

    const restantes = await banco.db.select().from(schema.sessao)
    expect(restantes).toHaveLength(1)
    expect(restantes[0]?.tokenHash).toBe(digerirToken(viva.token))
  })
})
