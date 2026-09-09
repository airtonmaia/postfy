import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda contra o id inventado no cliente.
 *
 * Toda tabela usa `id uuid primary key`. Quando o código gerava
 * `job-${Date.now()}`, o Postgres recusava a linha inteira com
 * `invalid input syntax for type uuid` — e como a persistência é derivada de
 * um diff em segundo plano, a tela seguia mostrando o item que nunca foi
 * salvo. O teste de unidade de novoId() passava; o que faltava era garantir
 * que alguém realmente o usasse.
 */

const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });

// `id:` seguido de template literal contendo Date.now() — o formato antigo.
const ID_INVENTADO = /\bid:\s*`[^`]*\$\{Date\.now\(\)\}[^`]*`/;

describe('geração de identificador', () => {
  it('nenhum arquivo monta id com Date.now()', () => {
    const culpados = varrer('src')
      .map((arquivo) => ({ arquivo, texto: readFileSync(arquivo, 'utf-8') }))
      .filter(({ texto }) => ID_INVENTADO.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('o repositório manda o id na inserção', () => {
    // Sem isto o banco gera um id diferente do que a tela guardou, e a
    // primeira edição atualiza uma linha que não existe.
    const db = readFileSync('src/lib/db.ts', 'utf-8');
    expect(db).toMatch(/if \(entidade\.id\) linha\.id = entidade\.id;/);
  });
});
