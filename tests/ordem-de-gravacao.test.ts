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

/**
 * O carregamento do banco não pode virar escrita.
 *
 * `hidratado` sozinho não bastava: ele é ligado dentro de carregarTudo, mas
 * `setState` é assíncrono e os efeitos das coleções só rodam no render
 * seguinte, com a bandeira já ligada. O estado anterior estava vazio e o novo
 * cheio, então o carregamento inteiro era interpretado como inserção — a
 * causa da multiplicação de linhas a cada recarga.
 *
 * A correção depende de ordem de declaração: o efeito que baixa a bandeira
 * roda depois dos das coleções porque é declarado depois. Mover para cima
 * reintroduz o bug sem nenhum sintoma no teste de unidade.
 */
describe('carregamento do banco não é gravado de volta', () => {
  it('as coleções pulam o diff durante a carga', () => {
    expect(fonte).toMatch(/if \(aplicandoCargaDoBanco\.current\) return;/);
  });

  it('a bandeira é levantada antes de aplicar os dados', () => {
    const levanta = fonte.indexOf('aplicandoCargaDoBanco.current = true');
    const aplica = fonte.indexOf('setAllClients(dados.clients)');
    expect(levanta).toBeGreaterThan(-1);
    expect(levanta).toBeLessThan(aplica);
  });

  it('a bandeira é baixada depois de todas as coleções', () => {
    const ultimaColecao = fonte.lastIndexOf('useColecaoSincronizada(');
    const baixa = fonte.indexOf('aplicandoCargaDoBanco.current = false');
    expect(baixa).toBeGreaterThan(ultimaColecao);
  });
});
