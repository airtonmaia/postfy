import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { formatCurrency } from '../src/lib/utils';
import { semComentarios } from './util/semComentarios';

/**
 * Dinheiro tem duas casas, sempre.
 *
 * `formatCurrency` existia em `utils.ts` **sem um único chamador**, enquanto
 * treze lugares escreviam `R$ {valor.toLocaleString('pt-BR')}` à mão — e esse
 * formato não força as casas decimais: R$ 1.200,50 chega ao cliente como
 * `R$ 1.200,5`. Dois deles nem formatavam: `R$ {plan.price}` imprime o número
 * cru, com ponto decimal, numa tela em português.
 *
 * Nada local acusava. `tsc` compila, o vitest não monta componente e o build
 * não lê texto de tela — só aparece olhando a tela, e o pior lugar em que
 * aparecia é o corpo do contrato que a agência manda para o cliente dela.
 */
describe('dinheiro', () => {
  /*
    O `Intl` separa o símbolo do número com espaço **inquebrável** (U+00A0),
    e não com o espaço comum. Comparar com a tecla de espaço reprovaria a
    saída correta — que é o tipo de guarda que ensina a ignorá-la.
  */
  const comum = (texto: string) => texto.replace(/ /g, ' ');

  it('as duas casas aparecem mesmo quando o valor tem uma só', () => {
    expect(comum(formatCurrency(1200.5))).toBe('R$ 1.200,50');
  });

  it('o inteiro também leva as duas casas', () => {
    expect(comum(formatCurrency(1200))).toBe('R$ 1.200,00');
  });

  it('zero é dito, não escondido', () => {
    expect(comum(formatCurrency(0))).toBe('R$ 0,00');
  });

  /**
   * Antes, metade dos pontos escrevia `(valor || 0)` e a outra confiava no
   * número: `null` derrubava a tela com `TypeError`, e `undefined` imprimia a
   * palavra "undefined" ao lado do cifrão.
   */
  it('campo em branco vale zero, e nunca NaN nem undefined', () => {
    expect(comum(formatCurrency(null))).toBe('R$ 0,00');
    expect(comum(formatCurrency(undefined))).toBe('R$ 0,00');
    expect(comum(formatCurrency(Number.NaN))).toBe('R$ 0,00');
  });

  const arquivosDe = (raiz: string): string[] =>
    readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = join(raiz, entrada.name);
      if (entrada.isDirectory()) return arquivosDe(caminho);
      return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
    });

  const telas = arquivosDe('src/components');

  /**
   * A guarda mede o **efeito**, não o nome da função: qualquer cifrão colado
   * numa expressão é o padrão que produz `R$ 1.200,5`, independente de como
   * essa expressão esteja escrita.
   *
   * Lida sem os comentários, porque este projeto registra o bug neles — a
   * própria memória de `R$ 1.200,5` faria a guarda acusar a explicação.
   */
  it('nenhuma tela monta o valor com o cifrão à mão', () => {
    const culpados = telas.filter((arquivo) =>
      /R\$\s*\{/.test(semComentarios(readFileSync(arquivo, 'utf-8')))
    );
    expect(
      culpados,
      'use formatCurrency() — o cifrão colado numa expressão é o que imprime "R$ 1.200,5"'
    ).toEqual([]);
  });

  /**
   * E o contrário: a função precisa ter leitor.
   *
   * Ela passou meses escrita e sem chamador nenhum, que é a armadilha do
   * `trial_ends_at` — parece uma regra e não é. Uma guarda que só proibisse o
   * cifrão à mão continuaria passando no dia em que alguém trocasse tudo por
   * outra coisa igualmente errada.
   */
  it('as telas de dinheiro passam por formatCurrency', () => {
    const usam = telas.filter((arquivo) =>
      readFileSync(arquivo, 'utf-8').includes('formatCurrency(')
    );
    expect(usam.length).toBeGreaterThanOrEqual(6);
  });
});
