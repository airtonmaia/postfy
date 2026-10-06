import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import { relativoAoRepo } from './util/caminhos';
import { CORES_DA_ETAPA } from '../src/lib/fluxoDeProducao';

/**
 * **Fundo claro sem par escuro não quebra nada — fica branco no escuro.**
 *
 * As seis colunas do quadro eram `bg-slate-200/70` sem `dark:`, e no modo
 * escuro viravam faixas brancas no meio de uma tela preta, com os cards
 * escuros por cima. Chegou como *"no darkmode as colunas ficam brancas"*.
 *
 * O que torna isto caro é o de sempre: `tsc` compila, o vitest não monta
 * componente, o `vite build` não pinta nada. É a armadilha 0 na camada do
 * tema — e só aparece para quem usa o produto no escuro, que não é quem
 * escreveu a classe.
 *
 * E aparecia **de forma desigual**: coluna cheia tem o fundo coberto pelos
 * cards, coluna curta não. O mesmo defeito foi relatado como "algumas colunas
 * estão erradas", o que manda procurar diferença entre as colunas onde não há.
 *
 * O detalhe que explica por que isso passa: o realce de soltura, ao lado,
 * **sempre** teve o par escuro. A variante excepcional é escrita com atenção;
 * o fundo de todo dia passa batido.
 */

const RAIZ = join(__dirname, '..');

/**
 * Os tons claros — os que viram mancha num fundo escuro se não tiverem par.
 *
 * `after:` e `before:` ficam de fora: pseudo-elemento aqui é a **bolinha** do
 * interruptor, branca por cima de uma trilha colorida nos dois temas. Ela não
 * é superfície, e exigir um par escuro dela deixaria o botão sem o contraste
 * que é a razão de ele ser branco.
 */
const CLARO = /(?:[a-z-]+:)*bg-(?:white|slate-(?:50|100|200|300))(?:\/\d+)?\b/g;
const DECORACAO = /\b(?:after|before):/;

/**
 * O par: um fundo declarado no escuro, em qualquer estado.
 *
 * O meio do seletor aceita colchete porque as variantes do Tailwind v4 os
 * usam: "dark:data-[state=open]:bg-slate-800" é o par legítimo de
 * "data-[state=open]:bg-slate-100". A primeira versão desta expressão aceitava
 * só letras ali e acusou duas peças corretas — que é a guarda que ensina a ser
 * ignorada.
 */
const ESCURO = /dark:[^\s'"]*bg-/;

/**
 * **As telas de entrada ficam de fora, e não é tolerância.**
 *
 * `LoginView` e `AcceptInviteView` não têm **nenhum** `dark:` — são claras por
 * inteiro, de propósito: a preferência de tema mora em `user_settings`, que só
 * existe depois da sessão. Metade de uma tela anônima pintada no escuro seria
 * pior que ela inteira no claro.
 *
 * As outras duas são peças **sobre a arte**, onde o branco contrasta com a
 * foto e não com a tela: o play do portal e os pontinhos do carrossel.
 */
const FORA = [
  'src/components/auth/LoginView.tsx',
  'src/components/auth/AcceptInviteView.tsx',
  'src/components/portal/ClientPortalView.tsx',
  'src/components/ui/carousel.tsx',
];

const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome.endsWith('.tsx') ? [caminho] : [];
  });

describe('fundo claro anda com o par escuro', () => {
  it('nenhuma tela da agência tem fundo claro sozinho', () => {
    const achados: string[] = [];

    for (const caminho of arquivos(join(RAIZ, 'src', 'components'))) {
      const relativo = relativoAoRepo(caminho, RAIZ);
      if (FORA.includes(relativo)) continue;

      const fonte = semComentarios(readFileSync(caminho, 'utf-8'));

      for (const achado of fonte.matchAll(CLARO)) {
        if (achado[0].startsWith('dark:') || DECORACAO.test(achado[0])) continue;
        const fim = achado.index + achado[0].length;

        /*
          **A conferência é para a frente, e curta — a primeira versão media o
          vizinho.** Ela olhava uma janela de linhas inteiras, e no caso real o
          tom claro estava no ramo de baixo de um ternário cujo ramo de cima
          trazia o par escuro uma linha acima. A janela enxergava aquele
          `dark:` e aprovava o defeito: conferida ao contrário, com o bug
          recolocado, ela passava.

          O par vem **logo depois** do tom claro — é como as centenas de pares
          deste projeto estão escritas —, e os 140 caracteres cabem o salto de
          uma string concatenada em duas linhas, que é o único corte legítimo
          no meio de uma lista de classes.
        */
        if (ESCURO.test(fonte.slice(fim, fim + 140))) continue;

        const linha = fonte.slice(0, achado.index).split('\n').length;
        achados.push(`${relativo}:${linha} — ${achado[0]}`);
      }
    }

    expect(
      achados,
      'fundo claro sem par no escuro; no modo escuro isto vira uma mancha branca:\n' +
        achados.join('\n')
    ).toEqual([]);
  });
});

describe('a paleta das etapas vale nos dois temas', () => {
  it('toda cor tem fundo, texto e borda no escuro', () => {
    /*
      A paleta é **derivada**, não uma lista escrita aqui: cor nova entra em
      `CORES_DA_ETAPA` e já nasce conferida. Lista literal obrigaria a editar a
      guarda junto com o código, que é como ela deixa de guardar.

      A borda é a que faltava: ela é desenhada por cima do fundo escuro do
      selo, e um `border-blue-300` ali é um anel claro em volta de uma caixa
      escura.
    */
    for (const cor of CORES_DA_ETAPA) {
      expect(cor.caixa, `a cor "${cor.valor}" não tem fundo no escuro`).toMatch(/dark:bg-/);
      expect(cor.caixa, `a cor "${cor.valor}" não tem texto no escuro`).toMatch(/dark:text-/);
      expect(cor.borda, `a cor "${cor.valor}" não tem borda no escuro`).toMatch(/dark:border-/);
    }
  });
});
