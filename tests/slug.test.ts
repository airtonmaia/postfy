import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { gerarSlug } from '../src/lib/slug';

/**
 * A prévia na tela tem que bater com o que o banco grava.
 *
 * A tela mostra o endereço do portal enquanto a pessoa digita o nome da
 * agência. Se a normalização daqui divergir da do Postgres, a tela promete
 * um endereço e o banco grava outro — e o link que a agência já anotou não
 * abre.
 */
describe('slug igual ao do banco', () => {
  const casos: [string, string][] = [
    ['Pulmin', 'pulmin'],
    ['Ação & Comunicação Ltda.', 'acao-comunicacao-ltda'],
    ['  Agência   Nova  ', 'agencia-nova'],
    ['São Paulo Criativa', 'sao-paulo-criativa'],
    ['---', 'agencia'],
    ['###', 'agencia'],
    ['', 'agencia'],
    ['Über Marketing', 'uber-marketing'],
    ['A'.repeat(80), 'a'.repeat(50)],
  ];

  for (const [entrada, esperado] of casos) {
    it(`"${entrada.slice(0, 30)}" -> ${esperado.slice(0, 30)}`, () => {
      expect(gerarSlug(entrada)).toBe(esperado);
    });
  }

  it('a tabela de acentos é a mesma da função do banco', () => {
    // `public.unaccent_simples` faz um translate com estas duas strings. Se
    // uma mudar sem a outra, um nome com acento passa a virar slug diferente
    // aqui e lá.
    const sql = readFileSync(
      'supabase/migrations/20260908223614_rpc_criar_agencia.sql',
      'utf-8'
    );
    const ts = readFileSync('src/lib/slug.ts', 'utf-8');

    const doBanco = sql.match(/translate\(\s*txt,\s*'([^']+)',\s*'([^']+)'/s);
    expect(doBanco, 'unaccent_simples não encontrada na migração').toBeTruthy();

    expect(ts).toContain(doBanco![1]);
    expect(ts).toContain(doBanco![2]);
  });
});
