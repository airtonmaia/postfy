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

/**
 * O projeto registra nos comentários o que deu errado antes — inclusive o
 * texto exato que saiu da tela. Sem removê-los, uma guarda que proíbe
 * "Teste Grátis" acusaria a própria explicação de por que ele saiu.
 */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

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

  it('o botão de recolher fica no cabeçalho, fora da barra', () => {
    /**
     * Ele morava no cabeçalho da **própria barra**, dividindo os 56px com o
     * seletor de agência. Recolhida, os dois não cabiam e a marca era quem
     * saía: o trilho de 64px não tinha nada dizendo de qual agência era a
     * tela, e quem trabalha em mais de uma perdia a referência justo no modo
     * em que sobra menos contexto.
     *
     * Fora, ele fica no mesmo canto nos dois estados — é o que faz dele um
     * interruptor, e não um botão que se procura. É onde o shadcn põe o
     * `SidebarTrigger`.
     */
    const cabecalho = app.slice(app.indexOf('<header className="h-14'));
    expect(
      cabecalho,
      'o botão de recolher saiu do cabeçalho — de volta para dentro da barra, ele briga com a marca'
    ).toMatch(/setSidebarRecolhida\(!recolhida\)/);

    const barra = app.slice(app.indexOf('<aside'), app.indexOf('<header className="h-14'));
    expect(
      barra,
      'o botão de recolher voltou para dentro da barra lateral'
    ).not.toMatch(/setSidebarRecolhida/);
  });

  it('a marca continua em tela quando a barra está recolhida', () => {
    // O seletor era escondido por inteiro no trilho (`recolhida && md:hidden`
    // em volta dele). Agora quem some é só o texto, por dentro do próprio
    // componente — o quadrado da marca fica, e é ele que abre a lista.
    expect(
      app,
      'o seletor de agência voltou a sumir no trilho'
    ).toMatch(/<WorkspaceSwitcher recolhida=\{recolhida\} \/>/);

    const switcher = readFileSync(
      join(RAIZ, 'src', 'components', 'layout', 'WorkspaceSwitcher.tsx'),
      'utf-8'
    );
    expect(
      switcher,
      'a marca passou a depender de `recolhida` para existir — no trilho a tela fica sem dizer de qual agência é'
    ).toMatch(/currentWorkspace && <Marca agencia=\{currentWorkspace\} grande \/>/);
  });

  it('a situação da assinatura mora num lugar só, e vem do banco', () => {
    /**
     * Era "✨ Teste Grátis (7 dias)" embaixo do nome da agência, em toda tela,
     * disputando espaço com a marca — e escrito a partir de
     * `currentWorkspace.isTrial`, que é a coluna, não a assinatura.
     *
     * Agora é o rodapé da barra, lendo `acesso_da_agencia()`. E some inteiro
     * enquanto a consulta não voltou: rodapé dizendo "Teste grátis" por padrão
     * afirmaria o que ninguém mediu, que é a armadilha 9.
     */
    const switcher = readFileSync(
      join(RAIZ, 'src', 'components', 'layout', 'WorkspaceSwitcher.tsx'),
      'utf-8'
    );
    expect(
      semComentarios(switcher),
      'o teste grátis voltou para baixo do nome da agência'
    ).not.toMatch(/isTrial|Teste Grátis/i);

    const plano = readFileSync(
      join(RAIZ, 'src', 'components', 'layout', 'PlanoDaAgencia.tsx'),
      'utf-8'
    );
    expect(
      plano,
      'o rodapé do plano deixou de sair cedo quando o banco ainda não respondeu'
    ).toMatch(/if \(!acessoDaAgencia\) return null;/);
    expect(app, 'o rodapé do plano saiu da barra lateral').toMatch(/<PlanoDaAgencia/);
  });

  it('o seletor de agência usa o DropdownMenu, não um backdrop à mão', () => {
    // O anterior era `useState` + `fixed inset-0` para captar o clique fora:
    // não fechava com Esc, não devolvia o foco ao gatilho, não andava com as
    // setas, e por ser filho da barra ficava preso no `overflow` dela — no
    // trilho, a lista abria dentro de 64px.
    const switcher = readFileSync(
      join(RAIZ, 'src', 'components', 'layout', 'WorkspaceSwitcher.tsx'),
      'utf-8'
    );
    expect(switcher).toMatch(/from '\.\.\/ui\/dropdown-menu'/);
    expect(
      semComentarios(switcher),
      'o backdrop à mão voltou — com ele voltam o Esc que não fecha e a lista presa no overflow'
    ).not.toMatch(/fixed inset-0/);
  });
});

describe('as classes de animação do shadcn existem', () => {
  it('o pacote que as define está importado no CSS', () => {
    /**
     * `animate-in`, `fade-in-0`, `zoom-in-95` e `slide-in-from-*` **não são do
     * Tailwind** — vêm do `tw-animate-css`, que é o que o `shadcn init`
     * instala no v4. Sem o import elas não existem, e classe que não existe
     * não quebra nada: o elemento aparece seco, com `tsc`, vitest e
     * `vite build` os três verdes. É a armadilha 0.
     *
     * Estava assim: o `tooltip.tsx` escreve `animate-in fade-in-0 zoom-in-95`
     * desde que entrou, e nenhuma das três fazia coisa alguma.
     */
    const fontes = [
      ...listarTsx(join(RAIZ, 'src')),
    ].filter((arquivo) => /\banimate-in\b/.test(readFileSync(arquivo, 'utf-8')));

    if (fontes.length === 0) return;

    const css = readFileSync(join(RAIZ, 'src', 'index.css'), 'utf-8');
    expect(
      css,
      `${fontes.length} arquivos escrevem animate-in, e o tw-animate-css não está importado — ` +
        `as classes simplesmente não existem, e nada acusa`
    ).toMatch(/@import ["']tw-animate-css["']/);
  });
});

function listarTsx(dir: string, saida: string[] = []): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarTsx(caminho, saida);
    else if (/\.tsx$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

describe('a preferência da barra', () => {
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
