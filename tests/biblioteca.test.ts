import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * A Biblioteca, e as três decisões que sustentam ela.
 *
 * Nenhuma das três quebra build, teste ou tela quando é violada — é a família
 * de armadilha que este projeto mais paga:
 *
 * 1. **Rota nova estoura o deploy.** O plano Hobby aceita 12 funções, e o
 *    produto está em 12. Listar e apagar entraram como modos de
 *    `api/upload-url.ts`; um arquivo novo em `api/` deixa `tsc`, vitest e
 *    `vite build` verdes e **derruba o deploy inteiro** (armadilha 6).
 * 2. **Chave não conferida apaga arquivo de outra agência.** A conferência de
 *    membro olha o `workspaceId` que veio na query — se a chave não for
 *    conferida contra ele, mandar a chave alheia apaga o arquivo alheio, com
 *    permissão legítima na própria agência.
 * 3. **Balde não configurado não é biblioteca vazia.** `listarObjetos`
 *    devolve `[]` sem credencial, e a tela diria "nenhum arquivo" para um
 *    problema de configuração — armadilha 9.
 */

const RAIZ = join(__dirname, '..');


const rota = readFileSync(join(RAIZ, 'api', 'upload-url.ts'), 'utf-8');
const cliente = readFileSync(join(RAIZ, 'src', 'lib', 'biblioteca.ts'), 'utf-8');
const tela = readFileSync(
  join(RAIZ, 'src', 'components', 'library', 'BibliotecaView.tsx'),
  'utf-8'
);

describe('a Biblioteca não gasta slot de função', () => {
  it('listar e apagar são modos de upload-url, não rotas novas', () => {
    expect(
      semComentarios(rota),
      'a rota perdeu o modo GET — a Biblioteca teria que virar função própria, e são 12 de 12'
    ).toMatch(/request\.method === 'GET'/);
    expect(semComentarios(rota)).toMatch(/request\.method === 'DELETE'/);

    // O adaptador da Vercel decide pelo formato do export (armadilha 1): sem
    // o nomeado, o builder novo não reconhece o verbo.
    expect(rota).toMatch(/export const GET = handler;/);
    expect(rota).toMatch(/export const DELETE = handler;/);
  });

  it('nenhum arquivo novo entrou em api/', () => {
    // A guarda de `tests/rotas.test.ts` já conta, e esta repete de propósito:
    // é aqui que alguém vai olhar ao acrescentar um verbo à Biblioteca.
    const funcoes = readdirSync(join(RAIZ, 'api')).filter((f) => f.endsWith('.ts'));
    expect(
      funcoes.length,
      `${funcoes.length} funções em api/ — o plano Hobby aceita 12, e passar disso ` +
        `derruba o deploy inteiro com o CI verde`
    ).toBeLessThanOrEqual(12);
  });
});

describe('apagar não alcança arquivo de outra agência', () => {
  it('a chave é conferida contra o workspaceId, não aceita como veio', () => {
    /**
     * Sem esta linha, a conferência de membro logo abaixo dela vira enfeite:
     * ela prova que a pessoa pertence à agência **que ela mesma informou na
     * query**, e a chave apagada seria outra. Quem tem uma agência qualquer
     * apagaria o arquivo de qualquer outra.
     */
    expect(
      semComentarios(rota),
      'a chave deixou de ser conferida contra a agência antes de apagar'
    ).toMatch(/chave\.startsWith\(`\$\{workspaceId\}\/`\)/);
  });

  it('listar usa o prefixo com barra', () => {
    // Sem a barra, o prefixo `abc` casa com `abcdef/` — a agência `abc` leria
    // a biblioteca da `abcdef`.
    expect(semComentarios(rota)).toMatch(/listarObjetos\(`\$\{workspaceId\}\/`\)/);
  });
});

describe('a tela distingue vazio de não-consegui-olhar', () => {
  it('a rota recusa antes de listar quando o R2 não está configurado', () => {
    // A checagem tem que vir **antes** do desvio de GET/DELETE: depois dele,
    // `listarObjetos` devolve `[]` e a tela mostra uma biblioteca vazia.
    const corpo = semComentarios(rota);
    const configurado = corpo.indexOf('!r2Configurado()');
    const get = corpo.indexOf("request.method === 'GET'");

    expect(configurado, 'a rota não confere mais se o armazenamento existe').toBeGreaterThan(-1);
    expect(
      configurado < get,
      'a checagem de armazenamento caiu para depois do GET — sem credencial a ' +
        'listagem volta vazia e a tela diz "nenhum arquivo" para um problema de configuração'
    ).toBe(true);
  });

  it('a tela trata STORAGE_NOT_CONFIGURED como caso próprio', () => {
    expect(
      tela,
      'a tela deixou de distinguir armazenamento ausente de biblioteca vazia'
    ).toMatch(/STORAGE_NOT_CONFIGURED/);
    // E diz o nome das variáveis, como a aba Integrações faz.
    expect(tela).toMatch(/R2_ACCOUNT_ID/);
  });

  it('o vazio não aparece quando a leitura falhou', () => {
    // "Nenhum arquivo" depois de um erro afirma o que ninguém mediu — e é a
    // frase que faz a pessoa concluir que perdeu o acervo.
    expect(
      semComentarios(tela),
      'o estado vazio voltou a aparecer junto com o erro'
    ).toMatch(/\) : erro \? \(/);
  });
});

describe('a pasta do cliente sai do uso, não da chave', () => {
  it('o levantamento cruza jobs, materiais e fichas', () => {
    // Se uma das três sair, arquivos daquele tipo caem em "Sem cliente" — sem
    // erro nenhum, e com a tela parecendo certa.
    for (const tabela of ['jobs', 'client_materials', 'clients']) {
      expect(
        cliente,
        `${tabela} saiu do levantamento de uso — os arquivos dela viram "Sem cliente"`
      ).toContain(`from('${tabela}')`);
    }
  });

  it('o uso vem do banco, não do estado já carregado', () => {
    /**
     * `carregarTudo` traz só 90 dias de conteúdo concluído (ver
     * **Performance** no CLAUDE.md). Contar o uso pelo estado em memória
     * marcaria como "sem uso" a mídia de um post mais antigo — e é
     * exatamente no momento de excluir que a pessoa confia nesse número.
     */
    expect(
      cliente,
      'o levantamento de uso passou a ler o estado da sessão, que é uma janela de 90 dias'
    ).toMatch(/supabase\s*\.?\s*\n?\s*\.from\('jobs'\)|supabase\.from\('jobs'\)/);
  });
});
