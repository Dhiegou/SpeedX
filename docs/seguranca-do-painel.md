# Segurança do painel: a senha, o acesso e quem pode mudar um tempo

**Conferido contra o código em 2026-10-20 (D-108).** Este texto responde três
perguntas que vão voltar: a senha é criptografada? Dá para invadir o painel?
Alguém consegue mudar o tempo de um piloto?

---

## 1. A senha nunca é guardada

O banco não guarda a senha de ninguém. Guarda um **resumo** dela, feito por uma
função de mão única chamada `scrypt`: dá para conferir se uma senha bate com o
resumo, mas não dá para voltar do resumo à senha. Nem quem copiar o banco
inteiro descobre as senhas.

| item                  | como está                                                                                     | onde                               |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
| Algoritmo             | `scrypt`, N=2^16, r=8, p=1                                                                    | `src/contexts/identidade/senha.ts` |
| Custo por conferência | 64 MiB de memória, uns 0,2 s                                                                  | idem                               |
| Sal                   | 16 bytes aleatórios, um por senha                                                             | idem                               |
| Comparação            | `timingSafeEqual`, tempo constante                                                            | idem                               |
| Parâmetros            | guardados junto do resumo, para o custo poder subir depois sem invalidar as senhas existentes | idem                               |
| Tamanho mínimo        | 12 caracteres (máximo 200)                                                                    | idem                               |

**Por que tão caro.** Os 64 MiB e os dois décimos de segundo não fazem diferença
para meia dúzia de logins por dia. Para quem tenta adivinhar milhões de senhas,
inviabilizam a tentativa.

**Duas proteções além do resumo:**

- **O login demora o mesmo tempo para usuário que existe e que não existe.**
  Sem isso, medir o tempo de resposta revelaria quais contas existem.
- **A sessão não guarda o token, guarda uma assinatura (HMAC) dele.** O cookie
  leva 32 bytes aleatórios, não pode ser lido por script da página (`httpOnly`),
  só viaja por HTTPS em produção (`Secure`), não é enviado em envios vindos de
  outros sites (`SameSite=Lax`) e usa o prefixo `__Host-`, que o navegador
  impõe. Quem lê a tabela de sessões não consegue fabricar um cookie válido.

## 2. Quem consegue mudar o tempo de um piloto

**De fora, ninguém.** Toda rota do painel e da exportação confere a sessão antes
de fazer qualquer coisa (`exigirOperadorNaApi`). A auditoria de 17/10, contra o
site publicado, encontrou nove rotas respondendo 401 a quem chegou sem login.
Uma delas, `POST /api/painel/tentativa`, saiu depois com o Cockpit único (D-107);
as que ficaram continuam guardadas.

**De dentro, o Operador logado consegue, e isso é de propósito.** Corrigir um
tempo digitado errado (RF-22) vai acontecer no dia, com gente digitando sob
pressão.

A proteção nesse caso não é impedir, é **deixar registrado**. Cada lançamento e
cada correção grava uma linha com quem fez, quando, o valor anterior e o novo. O
horário é o do servidor, nunca o do tablet. Uma correção não apaga nada: ela
acrescenta uma linha.

**Resumo:** contra estranho, prevenção. Contra Operador, prestação de contas.

## 3. O que o sistema não faz

Quatro limites, escritos para ninguém descobrir no dia achando que era outra
coisa:

- **Não há segundo fator.** Uma senha forte é o que separa o painel de quem a
  descobrir.
- **A sessão dura 16 horas sem uso.** Escolhido para cobrir a jornada do evento.
  Tablet perdido com sessão aberta é acesso ao painel até a senha daquele
  Operador ser redefinida (o que derruba as sessões dele) ou a conta desativada.
- **Quem tem a `DATABASE_URL` tem tudo.** Cria Operador, lê a base inteira, muda
  o que quiser. É a fronteira de confiança real: guarde essa string como guarda
  a senha do banco.
- **O limite é de 10 tentativas erradas por janela de 15 minutos, por endereço e
  por usuário.** Freia quem tenta adivinhar, não elimina.

## 4. Quando um Operador esquece a senha

```bash
npm run criar-operador -- --redefinir-senha marina
```

A senha nova é digitada duas vezes, sem aparecer na tela. O comando faz três
coisas e diz as três:

1. troca a senha;
2. **destrava o login**, porque quem esquece a senha quase sempre já errou até
   travar;
3. **encerra as sessões abertas** daquele Operador. Quem estava logado em
   algum tablet precisa entrar de novo.

Usuário que não existe é recusado, e nenhuma conta é criada. O registro da
operação vai para o log sem a senha e sem o resumo dela: só o identificador da
conta e quantas sessões e travas foram limpas.

A redefinição **não reativa** conta desativada. Se a conta estiver desativada, o
comando avisa.
