import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * As duas cascas têm as mesmas medidas, e a marca alinha com o cabeçalho.
 *
 * O CLAUDE.md diz que a área `/admin` tem barra lateral e cabeçalho próprios
 * porque o **conteúdo** é outro, e que nenhum pixel de medida foi mudado por
 * isso — casca nova com medida nova faria a mesma pessoa achar que trocou de
 * produto ao clicar num botão.
 *
 * A linha da marca escapava disso nas duas: era `p-3`, que cresce com o
 * conteúdo. O seletor de agência tem 48px e o padding somava 24, dando 72
 * contra os 56 do `h-14` do cabeçalho ao lado — a marca ficava um degrau
 * acima, e a borda de baixo das duas não fechava.
 *
 * É desalinho de 16px: ninguém abre um chamado por isso, e todo mundo vê.
 * Guarda por isso mesmo — `tsc` não mede pixel, e o vitest não monta tela.
 */

const RAIZ = join(__dirname, '..');

const app = readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8');
const admin = readFileSync(
  join(RAIZ, 'src', 'components', 'admin', 'AdminLayout.tsx'),
  'utf-8'
);

describe('a marca alinha com o cabeçalho', () => {
  it('a linha da marca tem altura fixa nas duas cascas', () => {
    for (const [nome, fonte] of [
      ['App.tsx', app],
      ['AdminLayout.tsx', admin],
    ] as const) {
      // A linha que fecha o topo da barra lateral: `h-14`, não `p-3`.
      expect(
        fonte,
        `${nome}: a linha da marca voltou a crescer com o conteúdo`
      ).toMatch(/h-14 px-3 border-b/);

      expect(
        fonte,
        `${nome}: a linha da marca voltou ao p-3, que não fecha com o h-14 do cabeçalho`
      ).not.toMatch(/className="p-3 border-b border-slate-200/);
    }
  });

  it('cabeçalho e barra usam as mesmas medidas nas duas', () => {
    for (const [nome, fonte] of [
      ['App.tsx', app],
      ['AdminLayout.tsx', admin],
    ] as const) {
      expect(fonte, `${nome}: cabeçalho fora do h-14`).toMatch(/<header className="h-14/);
      expect(fonte, `${nome}: barra fora do w-64`).toMatch(/w-64/);
    }
  });
});

describe('a barra lateral recolhe', () => {
  it('o trilho é md:w-16, e no celular ela abre inteira', () => {
    // No celular a barra é gaveta e ocupa a tela: um trilho de ícones ali não
    // economizaria nada e tiraria os nomes. Por isso o recolhimento é `md:`.
    expect(app).toMatch(/recolhida \? 'w-64 md:w-16' : 'w-64'/);
  });

  it('cada item do menu leva o rótulo no title quando recolhido', () => {
    // Ícone sem nome obriga a decorar, e o produto tem onze menus.
    expect(app).toMatch(/title=\{recolhida \? item\.label : undefined\}/);
  });

  it('a preferência é do usuário e vai para o banco, não para o navegador', () => {
    // Armadilha 4: `localStorage` prenderia a escolha a um navegador, e a
    // mesma pessoa abriria no celular com a barra aberta de novo.
    const preferencias = readFileSync(join(RAIZ, 'src', 'lib', 'preferencias.ts'), 'utf-8');
    expect(preferencias).toMatch(/sidebar_recolhida/);
    expect(preferencias).toMatch(/sidebarRecolhida/);

    const contexto = readFileSync(
      join(RAIZ, 'src', 'context', 'PostfyContext.tsx'),
      'utf-8'
    );
    expect(contexto).toMatch(/salvarPreferencias\(\{ sidebarRecolhida/);
    expect(contexto, 'a barra foi parar no localStorage').not.toMatch(
      /localStorage[^\n]*sidebar/i
    );
  });

  it('a migração da coluna existe e é repetível', () => {
    const migracao = readFileSync(
      join(RAIZ, 'supabase', 'migrations', '20260911230000_barra_lateral_recolhida.sql'),
      'utf-8'
    );
    expect(migracao).toMatch(/add column if not exists sidebar_recolhida/);
    // Padrão `false`: quem não mexer em nada continua com a barra aberta.
    expect(migracao).toMatch(/default false/);
  });
});
