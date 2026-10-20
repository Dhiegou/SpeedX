// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormularioLogin from '@/../app/painel/login/FormularioLogin'

/**
 * O botão Mostrar/Ocultar do login (D-108).
 *
 * O defeito que este arquivo existe para pegar é o mais comum desse controle:
 * um botão sem `type="button"` submete o formulário, e o clique em Mostrar
 * vira uma tentativa de login com a senha pela metade — que ainda consome cota
 * do limite de dez.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}))

const enviado = vi.fn()

beforeEach(() => {
  enviado.mockReset()
  enviado.mockResolvedValue({ ok: false, status: 401 } as Response)
  vi.stubGlobal('fetch', enviado)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const campoSenha = (): HTMLInputElement => screen.getByLabelText('Senha')

describe('mostrar a senha no login', () => {
  it('começa escondida', () => {
    render(<FormularioLogin destino="/painel" />)

    expect(campoSenha().type).toBe('password')
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeTruthy()
  })

  it('alterna entre mostrar e ocultar, e o texto do botão acompanha', async () => {
    const user = userEvent.setup()
    render(<FormularioLogin destino="/painel" />)

    await user.type(campoSenha(), 'senha-de-operador')
    await user.click(screen.getByRole('button', { name: 'Mostrar' }))

    expect(campoSenha().type).toBe('text')
    expect(campoSenha().value).toBe('senha-de-operador')

    await user.click(screen.getByRole('button', { name: 'Ocultar' }))

    expect(campoSenha().type).toBe('password')
  })

  it('o clique não submete o formulário', async () => {
    const user = userEvent.setup()
    render(<FormularioLogin destino="/painel" />)

    const botao = screen.getByRole('button', { name: 'Mostrar' })
    expect(botao.getAttribute('type')).toBe('button')

    await user.click(botao)

    expect(enviado).not.toHaveBeenCalled()
  })

  it('o gerenciador de senha continua reconhecendo o campo nos dois estados', async () => {
    const user = userEvent.setup()
    render(<FormularioLogin destino="/painel" />)

    expect(campoSenha().getAttribute('autocomplete')).toBe('current-password')
    await user.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(campoSenha().getAttribute('autocomplete')).toBe('current-password')
  })

  it('não sobrevive a uma nova abertura da página', async () => {
    const user = userEvent.setup()
    const primeira = render(<FormularioLogin destino="/painel" />)

    await user.click(screen.getByRole('button', { name: 'Mostrar' }))
    primeira.unmount()

    render(<FormularioLogin destino="/painel" />)

    expect(campoSenha().type).toBe('password')
  })

  it('a recusa continua com a mesma frase, sem distinguir usuário de senha', async () => {
    const user = userEvent.setup()
    render(<FormularioLogin destino="/painel" />)

    await user.type(screen.getByLabelText('Usuário'), 'marina')
    await user.type(campoSenha(), 'senha-errada-longa')
    await user.click(screen.getByRole('button', { name: 'Mostrar' }))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Usuário ou senha incorretos.')).toBeTruthy()
  })
})
