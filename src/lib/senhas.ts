/**
 * A senha que a agência gera para o cliente entrar no portal.
 *
 * Ela nasce aqui, aparece **uma vez** na tela de quem a gerou e vai para o
 * banco como bcrypt. Não há tela que a mostre de novo: guardá-la em claro
 * para a agência poder reler transformaria a ficha do cliente num arquivo de
 * senhas — e o produto já tem um cofre para as senhas **do cliente**, que é
 * outra coisa e tem outro dono.
 *
 * **O alfabeto não tem `I`, `O`, `0` nem `1`.** Esta senha é lida em voz alta
 * no telefone, colada num WhatsApp e digitada por alguém que não a escolheu:
 * o par que se confunde é o que gera o chamado de "não entra", e ninguém
 * consegue distinguir se o problema foi a senha ou a fonte da tela.
 *
 * E ele tem **32 símbolos de propósito.** Com uma potência de dois, tirar um
 * símbolo de um byte (`b % 32`) é uniforme, porque 256 divide certo. Com 33 —
 * bastaria deixar o `O` entrar — os primeiros símbolos passariam a sair mais
 * vezes que os últimos, e gerador enviesado é um defeito que nenhuma
 * conferência visual pega: a senha continua com cara de aleatória.
 */

/**
 * Exportado para a guarda poder **exercitar** a decisão do viés em vez de
 * descrevê-la: o teste confere que o tamanho é potência de dois, que é a
 * propriedade da qual a uniformidade depende.
 */
export const ALFABETO_DA_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALFABETO = ALFABETO_DA_SENHA;

/** Três grupos de quatro: 12 símbolos, ~60 bits. */
const GRUPOS = 3;
const POR_GRUPO = 4;

export const TAMANHO_MINIMO_DA_SENHA = 8;

/**
 * Fonte criptográfica, nunca `Math.random`.
 *
 * `Math.random` é previsível a partir de saídas anteriores em todo motor de
 * JavaScript que existe — e o que sai daqui é a credencial de uma pessoa.
 */
const bytes = (quantos: number): Uint8Array => {
  const saida = new Uint8Array(quantos);
  crypto.getRandomValues(saida);
  return saida;
};

export const gerarSenhaDoPortal = (): string => {
  const sorteio = bytes(GRUPOS * POR_GRUPO);
  const simbolos = [...sorteio].map((b) => ALFABETO[b % ALFABETO.length]);

  return Array.from({ length: GRUPOS }, (_, g) =>
    simbolos.slice(g * POR_GRUPO, (g + 1) * POR_GRUPO).join('')
  ).join('-');
};

/**
 * O mesmo mínimo que o banco cobra, para a tela dizer antes de tentar.
 *
 * A regra mora nos **dois** lados de propósito: `private.hash_de_senha`
 * recusa abaixo de 8 porque quem chamar a RPC direto não passa por tela
 * nenhuma; aqui ela existe para a pessoa não descobrir o limite por um erro
 * do Postgres depois de clicar em salvar.
 */
export const senhaCurta = (senha: string): boolean =>
  senha.trim().length < TAMANHO_MINIMO_DA_SENHA;
