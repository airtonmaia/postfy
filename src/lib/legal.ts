/**
 * Os documentos legais do produto.
 *
 * A tela de entrada sempre disse *"Ao continuar, você concorda com nossos
 * Termos de Serviço & Política de Privacidade"* — com os dois links apontando
 * para `#terms` e `#privacy`, âncoras que não existem em página nenhuma.
 * Clicar não fazia nada: a frase afirmava um acordo com documentos que não
 * havia como ler, que é a armadilha 9 no pior lugar dela, porque é sobre um
 * acordo que a pessoa está sendo convidada a aceitar.
 *
 * **E isso deixou de ser só dívida no dia em que o login do Google entrou.**
 * A tela de consentimento do Google exige uma URL de política de privacidade
 * que responda para o app sair do modo de teste — é o mesmo documento, agora
 * com um segundo leitor que recusa a falta dele.
 *
 * **Por que constante e não coluna em `saas_settings`.** A marca do produto é
 * configurável ali, e por coerência estes endereços também deveriam ser. O
 * custo é que `aparencia_do_saas` é função de **lista fechada** (ver o
 * manifest): coluna nova exige migração, entrada na função, campo na tela de
 * Design e um valor padrão — e, esquecendo qualquer um dos passos, o campo
 * salva no banco e nunca aparece, sem erro nenhum. Enquanto o dono do produto
 * é um só, a constante diz a verdade com uma linha. Quando houver o segundo,
 * ela vira coluna — e este comentário é o lembrete de que a decisão foi
 * tomada sabendo disso.
 */

export const URL_DOS_TERMOS = 'https://orquesia.com.br/termos.html';

export const URL_DA_PRIVACIDADE = 'https://orquesia.com.br/politica-de-privacidade.html';
