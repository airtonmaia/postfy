import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { iniciaisDe } from '../src/components/common/Avatar';

const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx?$/.test(caminho) ? [caminho] : [];
  });

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
