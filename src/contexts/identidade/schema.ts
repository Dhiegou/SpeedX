import { z } from 'zod'
import { TAMANHO_MAXIMO_SENHA } from './senha'

/**
 * Forma da credencial que chega pela rede.
 *
 * O que este esquema faz **não** é validar a senha: é impedir que um corpo
 * malformado chegue à derivação, que custa 64 MiB e dois décimos de segundo.
 * Se a senha é a certa, quem responde é `conferirSenha`.
 *
 * A recusa por forma é deliberadamente indistinguível da recusa por credencial
 * errada na resposta da rota. Dizer "o campo senha é obrigatório" é informação
 * de usabilidade; dizer qualquer coisa a mais transforma a tela de login em
 * oráculo.
 */

/**
 * Nome de usuário: letras, dígitos, ponto, traço e sublinhado.
 *
 * Restrito porque não há auto-cadastro (RNF-14) — quem cria a conta escolhe o
 * nome, e não há caso de uso para acento, espaço ou arroba. O conjunto fechado
 * também mantém `identificarUsuario` previsível.
 */
export const esquemaUsuario = z
  .string()
  .trim()
  .min(3, 'Usuário precisa de ao menos 3 caracteres.')
  .max(40, 'Usuário não pode passar de 40 caracteres.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Usuário aceita letras, dígitos, ponto, traço e sublinhado.')

export const esquemaCredencial = z.object({
  usuario: esquemaUsuario,
  // Sem `trim`: espaço no início ou no fim de uma senha é caractere como outro
  // qualquer, e aparar aqui recusaria uma senha legítima gravada com ele.
  senha: z.string().min(1, 'Informe a senha.').max(TAMANHO_MAXIMO_SENHA, 'Senha longa demais.'),
})

export type Credencial = z.infer<typeof esquemaCredencial>
