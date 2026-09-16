import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * Todo selo tem o mesmo desenho, e a cor é a única coisa que muda.
 *
 * Eram **cinco desenhos** (mais o "v1" escrito à mão na modal), e entre eles
 * três paddings, quatro fontes e dois raios. Medido no Chromium, lado a lado no
 * cabeçalho do conteúdo:
 *
 *   antes   4 alturas (19, 20, 22, 23px) · 3 fontes (10, 11, 12px) · 2 raios
 *   depois  1 altura (20px)              · 1 fonte (11px)          · 1 raio
 *
 * É a mesma história das doze alturas de botão e das sete barras de abas. A
 * diferença aqui é que ninguém escreveu uma medida errada: `py-0.5` com quatro
 * fontes diferentes **rende quatro alturas**, e é por isso que a altura passou
 * a ser fixa.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const badge = ler('src', 'components', 'ui', 'badge.tsx');
const dominio = ler('src', 'components', 'common', 'Badges.tsx');

function listarFontes(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarFontes(caminho, saida);
    else if (/\.tsx$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

describe('o desenho do selo mora num lugar só', () => {
  it('a altura é fixa, nunca padding vertical', () => {
    /**
     * A causa raiz das quatro alturas, e ela é sutil: **ninguém escreveu uma
     * medida errada.** Todos os selos tinham `py-0.5`; o que diferia era a
     * fonte, e com padding vertical a altura depende dela.
     */
    expect(badge, 'o selo perdeu a altura fixa').toMatch(/\bh-5\b/);
    expect(
      badge,
      'o selo voltou a usar py-*, que é o que produziu quatro alturas com o mesmo valor escrito'
    ).not.toMatch(/\bpy-[\d.]+\b/);
  });

  it('o canto é o único que lê diferente num chip de 20px', () => {
    /**
     * Medido no Chromium: o CSS corta qualquer raio maior que metade do lado,
     * então num selo de 20px `rounded-lg`, `rounded-xl` e `rounded-full`
     * renderizam **os mesmos 10px**. Só o `rounded-md` (6px) lê diferente — e
     * ele é o que o vocabulário do projeto já reserva para chip e badge, e o
     * que o próprio shadcn escreve.
     *
     * Trocar por qualquer um dos outros produziria um diff grande e uma tela
     * idêntica, que é pior que não mexer: o changelog passaria a afirmar uma
     * mudança que ninguém vê.
     */
    const base = badge.slice(badge.indexOf('cva('), badge.indexOf('{\n    variants'));

    expect(base, 'o canto do selo saiu do rounded-md').toMatch(/\brounded-md\b/);
    /**
     * A checagem é na **base do cva**, não no arquivo inteiro: a primeira
     * versão olhava o arquivo e reprovava o `rounded-full` do
     * `PontoDoBadge` — que é um ponto de 6px, círculo de verdade, e o único
     * lugar do arquivo onde `rounded-full` está certo.
     */
    expect(base, 'um raio que não lê diferente num chip de 20px entrou no selo').not.toMatch(
      /\brounded-(?:lg|xl|2xl|full)\b/
    );
  });

  it('nenhum selo do domínio escreve caixa própria', () => {
    /**
     * `Badges.tsx` guarda **significado**: qual rede, qual formato, qual
     * status. Se ele voltar a escrever padding, altura, fonte ou canto, o
     * desenho volta a ter cinco donos — e diverge de novo na primeira pressa.
     */
    for (const proibido of [
      /\bp[xy]-[\d.]+\b/,
      /\bh-\d+\b/,
      /\btext-\[\d+px\]/,
      /\btext-(?:xs|sm|base)\b/,
      /\brounded-\w+\b/,
    ]) {
      const achado = dominio.match(proibido)?.[0];
      expect(
        achado ?? null,
        `Badges.tsx voltou a escrever caixa própria ("${achado}"). O desenho é do ` +
          `src/components/ui/badge.tsx; aqui fica só a cor e o rótulo`
      ).toBeNull();
    }
  });

  it('a cor entra por tom, não por className solto', () => {
    /**
     * Um escape por classe convidaria o próximo a passar padding junto — e a
     * altura volta a divergir sem ninguém perceber, que é exatamente como as
     * quatro nasceram.
     */
    expect(badge, 'o tom deixou de ser variante').toMatch(/tom: \{/);

    // O `className` que sobra em `Badges.tsx` é só tipografia do rótulo
    // (`uppercase`, `font-mono`), nunca caixa — o teste acima é quem garante.
    const tons = [...badge.matchAll(/^\s{8}(\w+):\n?/gm)].map((m) => m[1]);
    for (const [, usado] of dominio.matchAll(/tom: '(\w+)'/g)) {
      expect(tons, `o tom "${usado}" não existe em badge.tsx`).toContain(usado);
    }
  });

  it('o selo de versão virou componente', () => {
    // Era o sétimo desenho: `font-mono text-xs px-2 py-0.5 rounded-md`
    // escrito à mão no cabeçalho da modal, na mesma linha dos outros seis.
    expect(dominio, 'o selo de versão sumiu').toMatch(/export const VersaoBadge/);

    const modal = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'modals', 'JobDetailModal.tsx'), 'utf-8')
    );
    expect(modal, 'a modal voltou a escrever o selo de versão à mão').not.toMatch(
      /font-mono[^"]*rounded-md/
    );
  });

  /**
   * **A varredura do app inteiro não entra nesta entrega, e é decisão.**
   *
   * O detector existe e achou **16 selos escritos à mão** fora de `Badges.tsx`
   * — em Dashboard, Publicações, Portal, Whitelabel, Admin e outros. Mas eles
   * não são todos a mesma coisa: um deles pinta com a cor da agência em `style`
   * inline (nenhuma variante cobre isso), outros são rótulo informativo de uma
   * tela só, e outros são selo de verdade.
   *
   * Migrá-los em bloco é o erro que a migração dos botões já pagou: nove cards
   * clicáveis viraram `<Button>` por engano e a altura fixa cortou o conteúdo.
   * Cada um precisa ser olhado, e o que ficar de fora entra numa lista fechada
   * com o papel que justifica — como `COM_BOTAO_A_MAO` faz.
   *
   * Uma guarda que passasse hoje afirmaria uma cobertura que não existe. Ela
   * entra junto com a varredura, e o número acima é o que mede o progresso.
   */
});
