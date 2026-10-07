import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { iniciaisDe } from '../src/components/common/Avatar';
import { alterarSenha } from '../src/lib/perfil';
import { semComentarios } from './util/semComentarios';

const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx?$/.test(caminho) ? [caminho] : [];
  });


/**
 * Nenhuma foto de desconhecido no lugar de gente de verdade.
 *
 * Havia cinco retratos do Unsplash embutidos como padrão: o avatar do usuário
 * na barra lateral, o do cliente novo, o do autor de comentário do portal. Um
 * deles era o mesmo em toda parte, então todo comentário de todo cliente de
 * toda agência aparecia com a cara da mesma pessoa.
 *
 * E era pior que feio: a tela dependia de um servidor de terceiro que pode
 * cair, ficar lento ou trocar o conteúdo da imagem.
 */
describe('avatar não vem de fora', () => {
  const fontes = varrer('src').map((arquivo) => ({
    arquivo,
    texto: semComentarios(readFileSync(arquivo, 'utf-8')),
  }));

  it('nenhum endereço de banco de imagem como valor', () => {
    const culpados = fontes
      .filter(({ texto }) =>
        // Em `placeholder=` é exemplo para quem digita, e isso é honesto.
        /(images\.unsplash\.com|i\.pinimg\.com)/.test(
          texto.replace(/placeholder="[^"]*"/g, '')
        )
      )
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  /**
   * `<img src={cliente.avatar}>` sem foto desenha o ícone de imagem
   * quebrada. Estava assim em quinze telas — calendário, kanban, aprovações,
   * portal. O componente `Avatar` cai nas iniciais.
   */
  it('ninguém renderiza avatar num <img> cru', () => {
    const culpados = fontes
      .filter(({ arquivo }) => !arquivo.endsWith('common/Avatar.tsx'))
      .filter(({ texto }) => /<img[^>]*src=\{[^}]*\.avatar[^}]*\}/.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('e nem contato inventado para cliente novo', () => {
    // `contato@cliente.com.br` e `(11) 99999-9999` ficavam gravados como se
    // fossem do cliente, e a agência acabava escrevendo para eles.
    const ctx = semComentarios(readFileSync('src/context/PostfyContext.tsx', 'utf-8'));
    expect(ctx).not.toMatch(/contato@cliente\.com\.br/);
    expect(ctx).not.toMatch(/\(11\) 99999-9999/);
  });
});

describe('iniciais', () => {
  it('usa o primeiro nome e o último', () => {
    // "Ana Paula Souza" vira AS, não AP: o sobrenome distingue mais numa
    // lista de clientes que o segundo nome.
    expect(iniciaisDe('Ana Paula Souza')).toBe('AS');
    expect(iniciaisDe('Airton Maia')).toBe('AM');
  });

  it('aguenta nome de uma palavra, vazio e espaço solto', () => {
    expect(iniciaisDe('Pulmin')).toBe('PU');
    expect(iniciaisDe('')).toBe('?');
    expect(iniciaisDe('   ')).toBe('?');
    expect(iniciaisDe('  Ação   Cia  ')).toBe('AC');
  });
});

/**
 * A senha atual é pedida na troca de senha.
 *
 * O Supabase deixa trocar só com a sessão aberta. Sem a pergunta, quem
 * sentasse numa aba esquecida aberta num computador compartilhado trocaria a
 * senha e tomaria a conta — sem precisar saber nada.
 */
describe('perfil', () => {
  const perfil = readFileSync('src/lib/perfil.ts', 'utf-8');

  it('a troca de senha reconfere a senha atual', () => {
    expect(perfil).toMatch(/signInWithPassword/);
    const trecho = perfil.slice(perfil.indexOf('export const alterarSenha'));
    // A reconferência vem antes do update, não depois.
    expect(trecho.indexOf('signInWithPassword')).toBeLessThan(
      trecho.indexOf('updateUser({ password')
    );
  });

  it('nome e foto vão para os dois lugares', () => {
    // Só nos metadados: os colegas continuariam vendo o nome antigo na
    // equipe. Só no vínculo: o nome se perderia na próxima agência.
    const trecho = perfil.slice(perfil.indexOf('export const salvarPerfil'));
    expect(trecho).toMatch(/auth\.updateUser/);
    expect(trecho).toMatch(/from\('workspace_members'\)/);
  });

  it('a foto não aceita endereço que o navegador executa', () => {
    // O valor vai para `src` de <img>. `javascript:` num src é execução.
    expect(perfil).toMatch(/\^\(https\?:\\\/\\\/\|\\\/\)/);
  });

  it('a troca de e-mail não afirma que já trocou', () => {
    // O Supabase manda um link; quem não abrir continua entrando com o
    // antigo. Anunciar "e-mail alterado" aqui seria mentira.
    const trecho = perfil.slice(perfil.indexOf('export const pedirTrocaDeEmail'));
    expect(trecho).toMatch(/return alvo/);
    const modal = readFileSync('src/components/auth/AuthModal.tsx', 'utf-8');
    expect(modal).toMatch(/Link de confirmação enviado/);
  });
});

/**
 * A tela da conta: o que ela pede, e em que ordem ela mostra.
 *
 * Ela era cinco blocos numa coluna, cada um com o seu botão de largura
 * inteira — e o **endereço da foto** era o primeiro campo, logo abaixo do
 * título: um `https://pub-...` ocupando a linha mais nobre de "Sua conta".
 * Ninguém abre o próprio perfil para digitar uma URL.
 *
 * As guardas aqui medem as três decisões que isso virou, e nenhuma mede a
 * aparência: o endereço continua alcançável, a saída de emergência aparece
 * quando o envio falha, e sair da conta não depende de rolar.
 */
describe('a tela da conta', () => {
  const modal = readFileSync('src/components/auth/AuthModal.tsx', 'utf-8');
  const limpo = semComentarios(modal);

  /**
   * **O campo de endereço não some do produto — ele sai da primeira linha.**
   *
   * Sem balde configurado é por ele que se põe uma foto (armadilha 5), então
   * esconder sem porta seria trocar um ruído por um beco. A guarda mede as
   * duas metades: ele é condicional, e há mais de um jeito de chegar nele.
   */
  it('o endereço da foto fica atrás de uma escolha, e com porta de entrada', () => {
    const campo = limpo.indexOf('value={avatar}');
    expect(campo, 'o campo de endereço sumiu').toBeGreaterThan(-1);

    const condicao = limpo.indexOf('{colarEndereco && (');
    expect(condicao, 'o campo voltou a ser incondicional').toBeGreaterThan(-1);
    expect(condicao).toBeLessThan(campo);

    // Duas aberturas: o botão "Colar endereço" e a falha do envio. Com uma
    // só, quem não achar o botão fica sem foto nenhuma.
    const aberturas = limpo.match(/setColarEndereco\(true\)/g) || [];
    expect(aberturas.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * A falha do envio abre a alternativa **no mesmo instante**. Dizer "cole o
   * endereço" com o campo escondido manda procurar um controle que a tela não
   * mostra.
   */
  it('quando o envio falha, a alternativa aparece junto com o aviso', () => {
    const envio = limpo.slice(limpo.indexOf('const enviarFoto'));
    const corpo = envio.slice(0, envio.indexOf('const perfilMudou'));
    expect(corpo).toContain('setColarEndereco(true)');
    expect(corpo).toContain('Cole o endereço da imagem');
  });

  /**
   * **Sair da conta não pode depender de rolar.** Ele era o último item de
   * uma coluna longa, atrás justamente dos campos que alguém talvez tivesse
   * começado a preencher. Hoje ele é irmão das abas, no rodapé que não rola.
   */
  it('sair da conta fica fora da área que rola', () => {
    const fimDasAbas = limpo.indexOf('</Tabs>');
    expect(fimDasAbas, 'a tela deixou de ter abas — reveja esta guarda').toBeGreaterThan(-1);
    expect(limpo.indexOf('logout()')).toBeGreaterThan(fimDasAbas);
  });

  /**
   * `updateUser({ password })` grava sem conferir nada, e é a porta que a
   * exigência da senha atual fecha. A conferência é de `perfil.ts`; esta tela
   * não fala com o Supabase.
   *
   * Lida sem comentários, e a primeira versão desta asserção provou por quê:
   * ela acusava o comentário que explica justamente por que `updateUser` não
   * é chamado aqui.
   */
  it('a tela não grava senha por fora de alterarSenha', () => {
    expect(limpo).not.toContain('updateUser');
    expect(limpo).toContain('alterarSenha(senhaAtual, novaSenha, confirmacao)');
  });
});

/**
 * A nova senha é digitada duas vezes.
 *
 * Com um campo só, o erro de digitação é gravado em silêncio: o Supabase
 * aceita, a tela diz "senha alterada", e a conta aparece trancada no próximo
 * login — quando já não há como saber o que foi digitado.
 */
describe('a confirmação da nova senha', () => {
  it('recusa quando as duas digitações não batem', async () => {
    // Recusa **antes** de falar com o servidor: a confirmação não depende de
    // sessão nenhuma para ser conferida.
    await expect(alterarSenha('atual', 'senhanova1', 'senhanova2')).rejects.toThrow(
      /confirmação/i
    );
  });

  it('e continua recusando a senha curta, que é o outro erro', async () => {
    await expect(alterarSenha('atual', '123', '123')).rejects.toThrow(/8 caracteres/);
  });
});
