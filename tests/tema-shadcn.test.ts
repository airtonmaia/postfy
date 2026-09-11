import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * As variáveis do shadcn, e a ponte entre elas e a cor da agência.
 *
 * O projeto pintava com classe direta (`bg-purple-600`) e trocava a cor da
 * agência por uma folha de `!important` — uma linha para cada utilitário roxo
 * que alguém tivesse escrito. Funciona, e não escala: peça gerada por
 * `npx shadcn add` nasce escrita contra `--primary`, `--ring` e `--border`, e
 * sem essas variáveis cada uma precisaria de tradução à mão, ou nasceria roxa
 * num portal que não é roxo.
 *
 * Agora as duas formas convivem, alimentadas pela mesma cor. As guardas aqui
 * existem porque **nenhuma das três falhas abaixo quebra o build**:
 *
 * 1. Variável declarada sem entrar no `@theme inline` não vira classe. O
 *    Tailwind v4 gera utilitário a partir do que está em `@theme`, então
 *    `bg-primary` simplesmente não existe — o botão sai transparente, e
 *    `tsc`, vitest e `vite build` ficam os três verdes. É a armadilha 0 outra
 *    vez: tudo verde, produção morta.
 *
 * 2. Variável de cor que existe no `:root` e falta no `.dark` fica com o tom
 *    claro no escuro. Ninguém vê, porque o trabalho acontece no claro.
 *
 * 3. Apagar a folha de `!important` enquanto ainda há classe roxa à mão
 *    devolve o roxo do Orquesia a quem é verde — e a tela continua pintada,
 *    então parece certo.
 */

const RAIZ = join(__dirname, '..');

const css = readFileSync(join(RAIZ, 'src', 'index.css'), 'utf-8');
const tema = readFileSync(
  join(RAIZ, 'src', 'components', 'common', 'DynamicThemeProvider.tsx'),
  'utf-8'
);
const componentes = JSON.parse(
  readFileSync(join(RAIZ, 'components.json'), 'utf-8')
) as { tailwind: { cssVariables: boolean; baseColor: string } };

/**
 * O corpo de um bloco `seletor { ... }`, contando chaves aninhadas.
 *
 * O seletor vem com a chave junto (`.dark {`) de propósito: sem ela,
 * `.dark` casa primeiro com o `@custom-variant dark (&:is(.dark *))` lá em
 * cima e a função devolve o bloco errado — foi o que aconteceu ao escrever
 * esta guarda, e o sintoma foi um teste que reprovava a variável certa.
 */
function corpoDoBloco(fonte: string, seletor: string): string {
  const inicio = fonte.indexOf(seletor);
  expect(inicio, `bloco ${seletor} não existe em src/index.css`).toBeGreaterThan(-1);

  const abre = fonte.indexOf('{', inicio);
  let profundidade = 0;
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === '{') profundidade++;
    if (fonte[i] === '}') {
      profundidade--;
      if (profundidade === 0) return fonte.slice(abre + 1, i);
    }
  }
  throw new Error(`bloco ${seletor} não fecha`);
}

/** Os nomes declarados num bloco: `--primary: #9333ea;` → `primary`. */
function variaveisDeclaradas(corpo: string): Set<string> {
  const nomes = new Set<string>();
  for (const [, nome] of corpo.matchAll(/^\s*--([a-z0-9-]+)\s*:/gm)) {
    nomes.add(nome);
  }
  return nomes;
}

const raiz = variaveisDeclaradas(corpoDoBloco(css, ':root {'));
const escuro = variaveisDeclaradas(corpoDoBloco(css, '.dark {'));
const inline = corpoDoBloco(css, '@theme inline {');

/** `--radius` e `--font-sans` não são cor: não entram nas regras de paleta. */
const NAO_SAO_COR = new Set(['radius', 'font-sans']);
const cores = [...raiz].filter((nome) => !NAO_SAO_COR.has(nome));

describe('as variáveis do shadcn existem e viram classe', () => {
  it('o conjunto do shadcn está declarado por inteiro', () => {
    // A lista do shadcn. Faltar uma só aparece quando alguém roda
    // `npx shadcn add` e a peça nova sai sem cor naquele ponto.
    const exigidas = [
      'background', 'foreground',
      'card', 'card-foreground',
      'popover', 'popover-foreground',
      'primary', 'primary-foreground',
      'secondary', 'secondary-foreground',
      'muted', 'muted-foreground',
      'accent', 'accent-foreground',
      'destructive', 'destructive-foreground',
      'border', 'input', 'ring',
      'sidebar', 'sidebar-foreground',
      'sidebar-primary', 'sidebar-primary-foreground',
      'sidebar-accent', 'sidebar-accent-foreground',
      'sidebar-border', 'sidebar-ring',
    ];

    for (const nome of exigidas) {
      expect(raiz, `--${nome} não está declarada no :root`).toContain(nome);
    }
  });

  it('cada cor do :root vira utilitário pelo @theme inline', () => {
    // Sem a linha no `@theme inline` a variável é só texto no CSS: a classe
    // não é gerada, o elemento fica sem a propriedade, e nada acusa.
    for (const nome of cores) {
      expect(
        inline,
        `--${nome} existe no :root mas não está no @theme inline — ` +
          `a classe correspondente não vai existir, e o build passa assim mesmo`
      ).toMatch(new RegExp(`--color-${nome}\\s*:\\s*var\\(--${nome}\\)`));
    }
  });

  it('cada cor do :root tem o par no .dark', () => {
    for (const nome of cores) {
      expect(
        escuro,
        `--${nome} não tem valor no .dark — no escuro ela fica com o tom claro`
      ).toContain(nome);
    }
  });

  it('o @theme inline não aponta para variável que não existe', () => {
    for (const [, alvo] of inline.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
      expect(
        [...raiz],
        `@theme inline aponta para --${alvo}, que ninguém declara`
      ).toContain(alvo);
    }
  });

  it('o raio é o rounded-xl do projeto, não o 0.625rem do shadcn', () => {
    // `rounded-xl` é o canto interno declarado no CLAUDE.md — campo, botão e
    // item de menu. Com o padrão do shadcn toda peça nova nasceria num
    // terceiro canto, que é exatamente o que a regra de desenho proíbe.
    expect(css).toMatch(/--radius:\s*0\.75rem/);
  });
});

describe('as variáveis recebem a cor da agência', () => {
  it('o DynamicThemeProvider escreve os nomes do shadcn, não só os --brand-*', () => {
    for (const nome of ['--primary', '--primary-foreground', '--ring', '--sidebar-primary']) {
      expect(
        tema,
        `${nome} não é escrita em tempo de execução — a peça do shadcn ficaria roxa numa agência que não é roxa`
      ).toContain(`${nome}: \${`);
    }
  });

  it('a marca tem o mesmo tom no claro e no escuro', () => {
    // O shadcn clareia o `--primary` no escuro porque o primário dele é um
    // neutro. Aqui é a cor da agência, e os 99 `bg-purple-600` escritos à mão
    // seguem no tom cheio nos dois modos: clarear só o lado do shadcn
    // colocaria dois roxos diferentes na mesma tela.
    const claro = corpoDoBloco(css, ':root {');
    const dark = corpoDoBloco(css, '.dark {');

    for (const nome of ['primary', 'ring', 'sidebar-primary', 'sidebar-ring']) {
      const valor = (texto: string) =>
        texto.match(new RegExp(`--${nome}\\s*:\\s*([^;]+);`))?.[1].trim();
      expect(
        valor(dark),
        `--${nome} tem tom diferente no escuro — o botão do shadcn e o escrito à mão ficariam de cores diferentes`
      ).toBe(valor(claro));
    }

    // E a folha injetada escreve um bloco só, pela mesma razão.
    expect(
      tema,
      'a folha injetada voltou a ter um .dark próprio; se for para diferenciar o tom, a decisão acima mudou'
    ).not.toContain('.dark {');
  });

  it('a cor do texto sobre o primário é decidida, não fixa', () => {
    // Branco sobre uma marca amarela é ilegível, e a folha de `!important`
    // não conseguia resolver isso: fundo e texto são classes diferentes.
    expect(tema).toMatch(/function textoLegivelSobre/);
    expect(tema).toMatch(/--primary-foreground: \$\{texto/);
  });

  it('a folha de !important continua enquanto houver classe roxa à mão', () => {
    // Ela é o que pinta os utilitários escritos à mão. Só pode sair quando o
    // último deles sair — e aí esta guarda se aposenta sozinha.
    const fontes = listarFontes(join(RAIZ, 'src'));
    const aindaRoxos = fontes.filter((arquivo) =>
      /\b(?:bg|text|border|ring|from|to|shadow)-purple-\d/.test(
        readFileSync(arquivo, 'utf-8')
      )
    );

    if (aindaRoxos.length === 0) return;

    expect(
      tema,
      `${aindaRoxos.length} arquivos ainda pintam com classe roxa à mão; ` +
        `sem a folha de !important eles voltam ao roxo do Orquesia em toda agência`
    ).toMatch(/\.bg-purple-600[^}]*var\(--brand-primary\)\s*!important/);
  });
});

describe('o components.json casa com o que o CSS oferece', () => {
  it('cssVariables está ligado', () => {
    // Desligado, `npx shadcn add` gera a peça com cor direta do Tailwind e o
    // whitelabel deixa de alcançá-la — sem erro nenhum.
    expect(componentes.tailwind.cssVariables).toBe(true);
  });

  it('a escala neutra continua slate', () => {
    // Os tons intermediários (`slate-600`, `slate-700`) não têm variável no
    // conjunto do shadcn e seguem escritos à mão. Trocar a base aqui faria a
    // peça gerada e a escrita à mão divergirem no cinza.
    expect(componentes.tailwind.baseColor).toBe('slate');
  });
});

function listarFontes(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) {
      saida.push(...listarFontes(caminho));
    } else if (/\.tsx?$/.test(entrada)) {
      saida.push(caminho);
    }
  }
  return saida;
}
