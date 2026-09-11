import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nenhum hook depois de um `return null` de guarda.
 *
 * O React exige que a lista de hooks seja a mesma em toda renderização. Um
 * componente que faz `if (!aberto) return null;` e declara `useState` depois
 * disso roda **dois** conjuntos de hooks diferentes — nenhum quando está
 * fechado, todos quando abre — e o React derruba a árvore inteira com
 * `Rendered more hooks than during the previous render` (erro #310 em
 * produção, onde a mensagem vem minificada).
 *
 * Isto chegou a produção: o botão de teste da publicação entrou com os
 * `useState` junto da função que os usava, no meio do componente, depois do
 * `return null` da modal. Abrir "adicionar post" derrubava o app inteiro na
 * tela de erro.
 *
 * **Nada local acusava.** `tsc` não sabe o que é hook, o vitest não monta
 * componente, e o `vite build` compila feliz — é a mesma família da armadilha
 * 0: tudo verde, produção morta. O projeto não roda eslint (o `lint` é
 * `tsc --noEmit`), então a regra `react-hooks/rules-of-hooks`, que pegaria
 * isso, não existe aqui. Esta guarda é o que há no lugar dela.
 *
 * O recorte é estreito de propósito: só o `return null` de guarda, no primeiro
 * nível de indentação do componente. É o caso que já custou caro, e recortar
 * assim evita acusar um `return null` legítimo dentro de um `.map()`.
 */

const RAIZ = join(__dirname, '..', 'src');
const HOOK = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext|useReducer|useLayoutEffect)\s*\(/;

/** Todo .tsx sob src/, recursivamente. */
const arquivosDeComponente = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDeComponente(caminho);
    return entrada.name.endsWith('.tsx') ? [caminho] : [];
  });

describe('hooks vêm antes de qualquer return de guarda', () => {
  it('nenhum componente declara hook depois de um `return null` de guarda', () => {
    for (const caminho of arquivosDeComponente(RAIZ)) {
      const linhas = readFileSync(caminho, 'utf-8').split('\n');

      // `  if (...) return null;` — exatamente dois espaços: o corpo do
      // componente, não um callback aninhado.
      const guarda = linhas.findIndex((l) => /^ {2}if \(.*\)\s*return null;/.test(l));
      if (guarda === -1) continue;

      const depois = linhas.slice(guarda + 1);
      const infrator = depois.findIndex(
        (l) => HOOK.test(l) && !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*')
      );

      expect(
        infrator,
        `${caminho.replace(RAIZ, 'src')}:${guarda + infrator + 2} declara hook depois do ` +
          `\`return null\` da linha ${guarda + 1} — o React derruba a árvore com o erro #310`
      ).toBe(-1);
    }
  });
});
