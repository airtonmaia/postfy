import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Ordem de gravação entre tabelas ligadas por chave estrangeira.
 *
 * Converter um lead em cliente cria o cliente e o contrato dele no mesmo
 * render. Cada coleção tem seu próprio efeito, então os inserts saíam em
 * paralelo e o contrato podia chegar antes do cliente existir: o Postgres
 * recusava com 23503, ninguém repetia, e a tela seguia mostrando um contrato
 * que sumia no reload.
 *
 * A correção serializa as gravações numa fila só. Isso só funciona enquanto
 * os hooks forem declarados na ordem de dependência — é isso que este teste
 * protege, porque reordená-los parece inofensivo.
 */

const fonte = readFileSync('src/context/PostfyContext.tsx', 'utf-8');

const posicaoDe = (colecao: string): number => {
  const i = fonte.indexOf(`useColecaoSincronizada('${colecao}'`);
  expect(i, `coleção ${colecao} não está sincronizada`).toBeGreaterThan(-1);
  return i;
};

describe('ordem das coleções sincronizadas', () => {
  // Cada par é uma chave estrangeira real do schema.
  const dependencias: [filho: string, pai: string][] = [
    ['jobs', 'clients'],
    ['contracts', 'clients'],
    ['clientMaterials', 'clients'],
    ['proposals', 'leads'],
  ];

  for (const [filho, pai] of dependencias) {
    it(`${pai} é gravada antes de ${filho}`, () => {
      expect(posicaoDe(pai)).toBeLessThan(posicaoDe(filho));
    });
  }

  it('as gravações passam por uma fila única', () => {
    // Sem a fila, a ordem dos hooks não garante ordem de chegada no banco.
    expect(fonte).toMatch(/filaDeGravacao\.current = filaDeGravacao\.current\.then/);
  });
});
