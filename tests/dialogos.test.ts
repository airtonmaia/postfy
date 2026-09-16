import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nada de `alert()` nem `window.confirm()`.
 *
 * Três razões, e nenhuma é estética:
 *
 * - **A caixa do navegador não tem a marca da agência.** O produto é
 *   whitelabel, e um cinza do Chrome no meio do portal do cliente diz que a
 *   página é de outra pessoa.
 * - **Ela trava a aba.** `confirm()` é síncrono: nada pinta e nada responde
 *   enquanto ela está aberta — e alguns navegadores de celular **a suprimem**,
 *   caso em que a pergunta não aparece e a ação simplesmente não acontece,
 *   sem erro nenhum.
 * - **Ela não cabe a explicação.** "Tem certeza?" é a pergunta errada; o que
 *   decide é a consequência, e `confirm()` tem uma linha só.
 */

const RAIZ = join(__dirname, '..');

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '');

function listarFontes(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarFontes(caminho, saida);
    else if (/\.tsx?$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

const fontes = listarFontes(join(RAIZ, 'src')).map((arquivo) => ({
  caminho: arquivo.replace(`${RAIZ}/`, ''),
  texto: semComentarios(readFileSync(arquivo, 'utf-8')),
}));

describe('a caixa do navegador não volta', () => {
  it('nenhuma tela chama window.confirm', () => {
    const achados = fontes
      .filter(({ texto }) => /\bwindow\.confirm\s*\(/.test(texto))
      .map(({ caminho }) => caminho);

    expect(
      achados,
      'window.confirm trava a aba e alguns navegadores de celular o suprimem — ' +
        'aí a ação não acontece e nada acusa. Use useConfirmacao()'
    ).toEqual([]);
  });

  it('nenhuma tela chama alert', () => {
    const achados = fontes
      .filter(({ texto }) => /(?:^|[^.\w])alert\s*\(/m.test(texto))
      .map(({ caminho }) => caminho);

    expect(
      achados,
      'alert() sem a marca da agência num produto whitelabel. Falha que ' +
        'interrompe usa useAviso(); confirmação de que deu certo usa feedback em linha'
    ).toEqual([]);
  });
});

describe('o diálogo é de fato renderizado', () => {
  /**
   * **A guarda que importa nesta entrega.**
   *
   * `useConfirmacao()` devolve `{ pedir, dialogo }`, e `dialogo` só aparece
   * se quem chamou o colocar na árvore. Esquecer isso não quebra nada que
   * qualquer ferramenta local perceba — `tsc` compila, o vitest não monta
   * componente, o `vite build` não olha — e o efeito é o pior possível:
   * clicar em "remover" **não faz nada**, sem erro, sem pergunta, sem pista.
   *
   * É a mesma família da armadilha 0 e do `size="icon"` com rótulo: tudo
   * verde, tela morta.
   */
  for (const hook of ['useConfirmacao', 'useAviso'] as const) {
    it(`quem chama ${hook}() renderiza {dialogo}`, () => {
      const semRender = fontes
        .filter(({ caminho, texto }) =>
          caminho !== 'src/components/ui/alert-dialog.tsx' &&
          new RegExp(`${hook}\\s*\\(`).test(texto) &&
          !/\{dialogo\}/.test(texto)
        )
        .map(({ caminho }) => caminho);

      expect(
        semRender,
        `${hook}() sem {dialogo} na árvore — o diálogo nunca aparece e a ação ` +
          `simplesmente não acontece, com tsc, vitest e build os três verdes`
      ).toEqual([]);
    });
  }

  it('o hook vem antes de qualquer return', () => {
    // Armadilha 8.1: hook depois de `if (!isOpen) return null` roda duas
    // listas diferentes e o React derruba a árvore inteira com o erro #310,
    // que em produção chega minificado, na tela de erro genérica.
    for (const { caminho, texto } of fontes) {
      const hook = texto.search(/use(?:Confirmacao|Aviso)\s*\(/);
      if (hook === -1 || caminho === 'src/components/ui/alert-dialog.tsx') continue;

      /**
       * Só o trecho **dentro do componente**, do `React.FC` mais próximo até
       * o hook. A primeira versão olhava o arquivo inteiro antes do hook e
       * acusava `CreateJobModal` por um `return` de uma função auxiliar
       * declarada acima do componente — guarda que reprova código correto
       * é pior que guarda nenhuma, porque ensina a ignorá-la.
       */
      const antes = texto.slice(0, hook);
      const componente = antes.lastIndexOf('React.FC');
      const corpo = componente === -1 ? antes : antes.slice(componente);

      const returnAntes = corpo.search(/^\s{2}(?:if \([^)]*\) )?return /m);
      expect(
        returnAntes,
        `${caminho}: o hook do diálogo está depois de um return — é o erro #310, ` +
          `e nenhuma ferramenta local acusa`
      ).toBe(-1);
    }
  });
});

describe('o diálogo carrega a consequência, não "tem certeza?"', () => {
  it('a descrição é obrigatória no componente', () => {
    const dialogo = readFileSync(
      join(RAIZ, 'src', 'components', 'ui', 'alert-dialog.tsx'),
      'utf-8'
    );
    // Opcional, ela seria omitida — e o diálogo viraria o `confirm()` de
    // novo, com outra pintura.
    expect(
      dialogo,
      'a descrição virou opcional; sem ela o diálogo é o window.confirm com outra cara'
    ).toMatch(/descricao: React\.ReactNode;/);
  });

  it('o canto do diálogo é o de modal, e não o do shadcn', () => {
    const dialogo = readFileSync(
      join(RAIZ, 'src', 'components', 'ui', 'alert-dialog.tsx'),
      'utf-8'
    );
    // O shadcn escreve `rounded-lg` na superfície. Aqui card e modal são
    // `rounded-2xl` — a tradução é feita na entrada da peça, nunca por
    // `--radius-*`, que moveria os 649 `rounded-*` que já existem.
    expect(semComentarios(dialogo)).toMatch(/rounded-2xl/);
  });
});
