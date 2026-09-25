import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL_DOS_TERMOS, URL_DA_PRIVACIDADE } from '../src/lib/legal';
import { semComentarios } from './util/semComentarios';

/**
 * A porta de entrada: os documentos legais e a senha.
 *
 * Duas coisas que pareciam prontas e não estavam — as duas do mesmo jeito, o
 * mais caro deste projeto: **a peça do meio existia e faltava uma ponta.**
 *
 * 1. A tela dizia "ao continuar, você concorda com nossos Termos de Serviço &
 *    Política de Privacidade", com os dois links apontando para `#terms` e
 *    `#privacy` — âncoras que não existem em página nenhuma.
 * 2. `redefinirSenha` estava no contexto **sem nenhum chamador**, e nada lia
 *    o `?recuperar=1` do link de recuperação. O e-mail saía, o link abria o
 *    produto, a sessão entrava — e a senha continuava a antiga.
 */
describe('a porta de entrada', () => {
  const login = readFileSync('src/components/auth/LoginView.tsx', 'utf-8');
  const app = readFileSync('src/App.tsx', 'utf-8');
  const telaDeSenha = readFileSync('src/components/auth/TelaDeNovaSenha.tsx', 'utf-8');
  const perfil = readFileSync('src/lib/perfil.ts', 'utf-8');
  const modal = readFileSync('src/components/auth/AuthModal.tsx', 'utf-8');

  const corpoDe = (fonte: string, inicio: string, fim: RegExp): string => {
    const de = fonte.indexOf(inicio);
    expect(de, `não achei ${inicio}`).toBeGreaterThan(-1);
    const resto = fonte.slice(de + inicio.length);
    const ate = resto.search(fim);
    return resto.slice(0, ate === -1 ? resto.length : ate);
  };

  // ------------------------------------------------------------------
  // Os documentos legais
  // ------------------------------------------------------------------

  /**
   * A âncora morta não volta em lugar nenhum — nem aqui, nem numa tela nova
   * que copie o rodapé desta. Lida sem comentários: a explicação de por que
   * `#terms` saiu está escrita em `legal.ts`.
   */
  it('nenhum link legal aponta para âncora que não existe', () => {
    for (const fonte of [login, semComentarios(readFileSync('src/lib/legal.ts', 'utf-8'))]) {
      expect(fonte).not.toContain('"#terms"');
      expect(fonte).not.toContain('"#privacy"');
    }
  });

  it('a tela de entrada aponta para os documentos de verdade', () => {
    expect(login).toContain('URL_DOS_TERMOS');
    expect(login).toContain('URL_DA_PRIVACIDADE');
  });

  /**
   * Endereço absoluto e em `https`, e não um caminho relativo: o app mora em
   * `app.orquesia.com.br` e os documentos no site — um `/termos` daqui
   * responderia o próprio `index.html` pelo coringa do `vercel.json`, que é
   * uma página legal que abre e não é a página legal.
   *
   * O `https` também não é detalhe: é o endereço que vai para a tela de
   * consentimento do Google, que recusa `http`.
   */
  it('os endereços são absolutos e seguros', () => {
    for (const url of [URL_DOS_TERMOS, URL_DA_PRIVACIDADE]) {
      expect(url.startsWith('https://')).toBe(true);
      expect(url).toMatch(/^https:\/\/[^/]+\/.+/);
    }
    expect(URL_DOS_TERMOS).not.toBe(URL_DA_PRIVACIDADE);
  });

  /**
   * Link que sai do produto abre noutra aba: a pessoa está no meio de entrar,
   * e navegar na mesma aba descarta o e-mail e a senha já digitados.
   */
  it('os documentos abrem em outra aba', () => {
    const rodape = corpoDe(login, 'URL_DOS_TERMOS', /Política de Privacidade/);
    expect(rodape).toContain('target="_blank"');
    expect(rodape).toContain('rel="noopener noreferrer"');
  });

  // ------------------------------------------------------------------
  // O link de recuperação tem tela
  // ------------------------------------------------------------------

  /**
   * A guarda que importa, e ela é sobre **ordem**.
   *
   * Quem clica no link chega autenticado — o SDK troca o código da URL por
   * sessão sozinho. Então a barreira de autenticação o deixa passar e ele cai
   * no app normal: tudo funciona, e a senha continua a antiga. Depois da
   * barreira, esta tela nunca montaria.
   */
  it('o link de recuperação é atendido antes da barreira de autenticação', () => {
    const montaTela = app.indexOf('<TelaDeNovaSenha />');
    const barreira = app.indexOf('if (!isAuthenticated && !isClientPortalOpen)');

    expect(montaTela, 'App.tsx não monta a tela de nova senha').toBeGreaterThan(-1);
    expect(barreira).toBeGreaterThan(-1);
    expect(montaTela).toBeLessThan(barreira);

    // E o que a decide é o mesmo parâmetro que o e-mail carrega.
    expect(app).toContain("has('recuperar')");
    expect(perfil).toContain('recuperar=1');
  });

  it('a tela grava a senha, em vez de só dizer que gravou', () => {
    expect(telaDeSenha).toContain('redefinirSenha(');
    // Sem sessão o link caducou, e a tela oferece outro em vez de virar um
    // beco: mandar a pessoa procurar "esqueci minha senha" é onde ela desiste.
    expect(telaDeSenha).toContain('recuperarSenha(');
  });

  // ------------------------------------------------------------------
  // Conta sem senha
  // ------------------------------------------------------------------

  /**
   * Quem entrou pelo Google não tem senha, e a seção pedia a atual para
   * confirmar quem está ali — pergunta sem resposta possível: qualquer coisa
   * digitada volta como "a senha atual não confere".
   */
  it('a tela da conta pergunta se existe senha antes de pedir a atual', () => {
    expect(modal).toContain('temSenhaDeAcesso');
    const secao = corpoDe(modal, '<Secao titulo="Senha">', /<Secao titulo="E-mail">/);
    expect(secao).toContain('temSenha === false');
    expect(secao).toContain('pedirLinkParaCriarSenha');
    // O campo de senha atual continua existindo para quem tem uma.
    expect(secao).toContain('senhaAtual');
  });

  /**
   * **A criação da primeira senha passa pelo e-mail, e essa é a decisão.**
   *
   * `updateUser({ password })` aceitaria a senha nova ali mesmo, sem
   * conferência nenhuma — e é justamente a porta que a exigência da senha
   * atual fecha: quem senta numa aba esquecida aberta criaria uma senha e
   * passaria a entrar depois de a sessão morrer. O link repõe a prova que a
   * senha atual daria, que é a caixa de entrada.
   */
  it('a primeira senha não é definida sem prova de quem é', () => {
    const corpo = corpoDe(perfil, 'export const pedirLinkParaCriarSenha', /\n\/\*\*/);
    expect(corpo).toContain('resetPasswordForEmail');
    expect(corpo).not.toContain('updateUser');

    /*
      Sem os comentários, e a primeira versão desta asserção provou por quê:
      ela reprovou o código **correto**, acusando o comentário que explica
      justamente por que `updateUser` não é chamado ali. Guarda que acusa a
      memória do bug obriga a apagar a explicação para ficar verde.
    */
    const secao = semComentarios(
      corpoDe(modal, '<Secao titulo="Senha">', /<Secao titulo="E-mail">/)
    );
    expect(secao).not.toContain('updateUser');
  });

  /**
   * Na dúvida, o caminho seguro: sessão expirada ou rede oscilando devolvem
   * "tem senha", que mantém a tela exigindo a atual. Errar para o lado de
   * pedir uma confirmação a mais é barato; errar para o outro abriria a troca
   * sem conferência.
   */
  it('sem resposta do servidor, a conta é tratada como tendo senha', () => {
    const corpo = corpoDe(perfil, 'export const temSenhaDeAcesso', /\n\/\*\*/);
    expect(corpo).toMatch(/if \(error \|\| !data\.user\) return true/);
    expect(corpo).toContain("i.provider === 'email'");
  });
});
