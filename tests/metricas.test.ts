import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { agregar, medicaoMaisAntiga, type MetricaDePost } from '../src/lib/metricas';

/**
 * Métricas reais, e a regra que sustenta todas elas: **nulo não é zero.**
 *
 * Alcance 0 num post de ontem é um problema de conteúdo. Alcance nulo é a
 * Meta não ter respondido. Somar o segundo como se fosse o primeiro produz um
 * total que parece medido e não é — e esse número vai para a reunião da
 * agência com o cliente dela.
 *
 * É a armadilha 9 na tela que mais custa caro: diferente do Financeiro, aqui
 * quem é enganado não é o dono do produto, é o cliente de quem paga por ele.
 */

const RAIZ = join(__dirname, '..');

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '')
    .replace(/^\s*\/\/.*$/gm, '');

const migracao = readFileSync(
  join(RAIZ, 'supabase', 'migrations', '20260916120000_metricas_das_publicacoes.sql'),
  'utf-8'
);
const cron = readFileSync(join(RAIZ, 'api', 'publicar.ts'), 'utf-8');
const instagram = readFileSync(join(RAIZ, 'api', '_lib', 'instagram.ts'), 'utf-8');
const tela = readFileSync(
  join(RAIZ, 'src', 'components', 'reports', 'DesempenhoReal.tsx'),
  'utf-8'
);

const post = (over: Partial<MetricaDePost>): MetricaDePost => ({
  id: 'x',
  jobId: null,
  clientId: null,
  externalId: '1',
  permalink: null,
  publicadoEm: '2026-09-15T10:00:00Z',
  alcance: null,
  curtidas: null,
  comentarios: null,
  salvamentos: null,
  compartilhamentos: null,
  medidoEm: '2026-09-16T10:00:00Z',
  ultimoErro: null,
  ...over,
});

describe('nulo não entra na conta como zero', () => {
  it('soma só o que foi medido, e diz quantos entraram', () => {
    const r = agregar(
      [post({ alcance: 100 }), post({ alcance: null }), post({ alcance: 40 })],
      'alcance'
    );
    expect(r.total).toBe(140);
    // Três posts, dois medidos. Sem este número a tela diria "140 de alcance"
    // sem dizer que um terço do período não foi medido.
    expect(r.medidos).toBe(2);
  });

  it('nenhuma medição devolve medidos = 0, e não um total de zero', () => {
    const r = agregar([post({}), post({}), post({})], 'alcance');
    expect(r.medidos).toBe(0);
    // `total` é 0 aqui, e por isso ele **sozinho** não serve: é `medidos` que
    // separa "o conteúdo não alcançou ninguém" de "ninguém mediu ainda".
    expect(r.total).toBe(0);
  });

  it('zero medido conta como medição', () => {
    // O caso que a regra existe para preservar: um post que realmente não
    // alcançou ninguém é informação, e não pode virar "—" na tela.
    const r = agregar([post({ alcance: 0 })], 'alcance');
    expect(r.medidos).toBe(1);
    expect(r.total).toBe(0);
  });

  it('a medição mais antiga é o que a tela mostra', () => {
    const d = medicaoMaisAntiga([
      post({ medidoEm: '2026-09-16T10:00:00Z' }),
      post({ medidoEm: '2026-09-14T08:00:00Z' }),
    ]);
    expect(d?.toISOString()).toBe('2026-09-14T08:00:00.000Z');
    expect(medicaoMaisAntiga([])).toBeNull();
  });
});

describe('o schema preserva a diferença entre nulo e zero', () => {
  it('nenhuma coluna de métrica tem default 0', () => {
    // Um `default 0` apagaria a distinção no nascimento da linha: toda
    // publicação entraria com alcance zero e a tela nunca saberia que aquilo
    // não foi medido.
    for (const coluna of [
      'alcance',
      'curtidas',
      'comentarios',
      'salvamentos',
      'compartilhamentos',
    ]) {
      const linha = semComentarios(migracao)
        .split('\n')
        .find((l) => l.trim().startsWith(`${coluna} `));

      expect(linha, `a coluna ${coluna} sumiu da migração`).toBeTruthy();
      expect(
        linha,
        `${coluna} ganhou default — nulo e zero deixam de ser distinguíveis`
      ).not.toMatch(/default/i);
      expect(linha, `${coluna} virou not null`).not.toMatch(/not null/i);
    }
  });

  it('o navegador não escreve métrica', () => {
    /**
     * Mesma decisão de `subscriptions`: uma política de update aqui deixaria
     * qualquer dono de agência afirmar o alcance que quisesse — e o número
     * existe justamente para ser mostrado ao cliente dela.
     */
    const politicas = semComentarios(migracao).match(/for\s+(select|insert|update|delete)/gi) || [];
    expect(
      politicas.map((p) => p.toLowerCase().replace(/\s+/g, ' ')),
      'post_metrics ganhou política de escrita para sessão autenticada'
    ).toEqual(['for select']);
  });
});

describe('a medição é do cron, e não trava', () => {
  it('a atualização respeita o orçamento de tempo da passada', () => {
    // Sem isto a medição estoura o tempo da função no meio da fila, que é o
    // pior desfecho desta rota: a peça vai ao ar e a fila não sabe.
    expect(semComentarios(cron)).toMatch(/Date\.now\(\) - comecou > ORCAMENTO_MS/);
  });

  it('medido_em avança mesmo quando a medição falha', () => {
    /**
     * A linha quebrada é a primeira da fila por ter `medido_em` mais antigo.
     * Se a falha não avançar a data, ela é tentada de novo em toda passada e
     * segura todas as outras atrás dela — a fila para de medir sem nunca dar
     * erro visível.
     */
    const catchDaMedicao = semComentarios(cron).slice(
      semComentarios(cron).indexOf('const atualizarMetricas')
    );
    const trecho = catchDaMedicao.slice(catchDaMedicao.indexOf('} catch (erro) {'));
    expect(
      trecho.slice(0, 600),
      'a falha da medição deixou de avançar medido_em — a fila trava na linha quebrada'
    ).toMatch(/medido_em: new Date\(\)\.toISOString\(\)/);
  });

  it('o insights é opcional e não derruba curtidas e comentários', () => {
    /**
     * `/insights` é o primeiro a falhar quando a revisão do app não cobre a
     * permissão. Sem o try próprio, perder o alcance levaria junto as
     * curtidas que já tinham vindo na outra chamada.
     */
    const corpo = instagram.slice(instagram.indexOf('export const buscarMetricas'));
    const insights = corpo.indexOf('/insights');
    const tryAntes = corpo.lastIndexOf('try {', insights);
    expect(
      tryAntes > -1 && tryAntes < insights,
      'a chamada de insights saiu do try próprio — falhar nela apaga as curtidas também'
    ).toBe(true);
  });
});

describe('a tela diz o que não mediu', () => {
  it('o recorte da fila do Orquesia está escrito', () => {
    // Sem ele o número parece o desempenho do perfil inteiro, e a agência
    // responde pelo que não mediu.
    expect(tela).toMatch(/pela fila do Orquesia/);
  });

  it('o traço significa não medido, e a tela explica isso', () => {
    expect(tela).toMatch(/ainda não medido/);
    expect(semComentarios(tela), 'o vazio virou zero na tela').toMatch(/semMedicao \? '—'/);
  });
});

describe('a medição não custou uma função nova', () => {
  it('api/ continua em 12', () => {
    const funcoes = readdirSync(join(RAIZ, 'api')).filter((f) => f.endsWith('.ts'));
    expect(
      funcoes.length,
      'o plano Hobby aceita 12 funções, e passar disso derruba o deploy com o CI verde'
    ).toBeLessThanOrEqual(12);
  });
});
