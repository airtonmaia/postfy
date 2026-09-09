import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { CHANGELOG } from '../src/data/changelog';
import { formatarData } from '../src/components/modals/ChangelogModal';

/**
 * O changelog é a única coisa que o cliente lê sobre o que mudou. Ele já
 * mentiu: anunciava três funcionalidades que nunca existiram, porque morava
 * dentro do componente e ninguém mexia. Estes testes prendem o que dá para
 * verificar sozinho — o resto é honestidade na hora de escrever.
 */
describe('changelog', () => {
  it('a versão do topo é a que o app publica', () => {
    // Se estas duas divergirem, o rodapé mostra uma versão que a tela de
    // novidades não conhece — e aí não dá para saber o que subiu.
    const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
    expect(CHANGELOG[0].versao).toBe(version);
  });

  it('vai da entrega mais recente para a mais antiga', () => {
    const datas = CHANGELOG.map((e) => new Date(e.data).getTime());
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it('toda entrada tem data válida, resumo e ao menos um item', () => {
    for (const entrada of CHANGELOG) {
      expect(Number.isNaN(new Date(entrada.data).getTime()), entrada.versao).toBe(false);
      expect(entrada.resumo.trim().length, entrada.versao).toBeGreaterThan(0);

      const itens = [
        ...(entrada.novidades ?? []),
        ...(entrada.melhorias ?? []),
        ...(entrada.corrigido ?? []),
      ];
      expect(itens.length, `${entrada.versao} não lista nada`).toBeGreaterThan(0);
    }
  });

  it('não repete versão', () => {
    const versoes = CHANGELOG.map((e) => e.versao);
    expect(new Set(versoes).size).toBe(versoes.length);
  });

  /**
   * A data é um rótulo, não um instante: `2026-09-09` é meia-noite UTC, e
   * formatar isso no nosso fuso (negativo) devolveria o dia 8.
   */
  it('a data não anda para trás na formatação', () => {
    expect(formatarData('2026-09-09')).toBe('9 de setembro de 2026');
    expect(formatarData('2026-01-01')).toBe('1 de janeiro de 2026');
  });
});
