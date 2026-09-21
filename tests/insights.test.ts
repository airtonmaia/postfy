import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { derivarInsights } from '../src/lib/insights';
import type { Client, Job } from '../src/types';
import { semComentarios } from './util/semComentarios';

/**
 * O card de insights do Dashboard afirmava duas coisas que ninguém mediu:
 * que o cliente "EcoModa Brasil" acumulava 6 solicitações de ajuste na
 * quinzena, e que "Café Aroma Gourmet" aprovava 100% dos carrosséis em menos
 * de 24 horas. Nenhum dos dois existe em base nenhuma.
 *
 * É a armadilha 9, e na tela mais vista do produto. O custo não é a tela
 * errada — é a agência cobrar o cliente que não atrasou.
 *
 * `derivarInsights` é pura, então o que vale aqui é **comportamento**: dados
 * entram, e a asserção é sobre o que sai. Guarda que descrevesse o mecanismo
 * aprovaria qualquer mecanismo com aquela forma — foi assim que as quatro
 * guardas da bandeira booleana passaram enquanto o produto perdia dado.
 *
 * O relógio entra por parâmetro em toda chamada. Asserção que dependesse de
 * `Date.now()` apodreceria sozinha, como os dois testes de `quandoDeveSair`
 * que começaram a falhar com o código intacto.
 */

const AGORA = new Date('2026-09-21T12:00:00.000Z');
const ONTEM = '2026-09-20T12:00:00.000Z';
const AMANHA = '2026-09-22T12:00:00.000Z';

const cliente = (id: string, name: string): Client =>
  ({ id, name, workspaceId: 'w1' }) as Client;

const job = (parcial: Partial<Job>): Job =>
  ({
    id: Math.random().toString(36).slice(2),
    workspaceId: 'w1',
    clientId: 'c1',
    title: 'peça',
    status: 'in_production',
    currentVersion: 1,
    deadlineProduction: AMANHA,
    deadlineApproval: AMANHA,
    ...parcial,
  }) as Job;

const textoDe = (insights: ReturnType<typeof derivarInsights>) =>
  insights.map((i) => i.titulo + ': ' + i.partes.map((p) => p.texto).join('')).join(' | ');

const fortesDe = (insights: ReturnType<typeof derivarInsights>) =>
  insights.flatMap((i) => i.partes.filter((p) => p.forte).map((p) => p.texto));

describe('os insights saem do dado, nunca de um texto fixo', () => {
  it('sem conteúdo nenhum, não inventa nada', () => {
    expect(derivarInsights([], [cliente('c1', 'EcoModa Brasil')], AGORA)).toEqual([]);
  });

  it('nunca nomeia cliente que não está carregado', () => {
    /*
      O gargalo existe e é real — três peças em ajuste —, mas o cliente não
      veio na carga. Nomear "Cliente" ou o id seria apontar um gargalo que
      ninguém consegue atender; o insight é descartado.
    */
    const jobs = [
      job({ clientId: 'desconhecido', status: 'in_adjustment' }),
      job({ clientId: 'desconhecido', status: 'in_adjustment' }),
      job({ clientId: 'desconhecido', status: 'in_adjustment' }),
    ];

    const saida = derivarInsights(jobs, [], AGORA);

    expect(fortesDe(saida)).toEqual([]);
    expect(textoDe(saida)).not.toMatch(/desconhecido/);
  });

  it('aprovação vencida vem antes de ajuste acumulado', () => {
    /*
      Prazo vencido é o cliente esperando agora; ajuste acumulado é
      tendência. Com os dois em cena, quem aparece é o vencido.
    */
    const jobs = [
      job({ clientId: 'c1', status: 'for_approval', deadlineApproval: ONTEM }),
      job({ clientId: 'c2', status: 'in_adjustment' }),
      job({ clientId: 'c2', status: 'in_adjustment' }),
      job({ clientId: 'c2', status: 'in_adjustment' }),
    ];

    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa'), cliente('c2', 'Beta')], AGORA);

    expect(saida[0].id).toBe('aprovacao-vencida');
    expect(saida[0].tom).toBe('atencao');
  });

  it('conta as peças vencidas e nomeia quem concentra', () => {
    const jobs = [
      job({ clientId: 'c1', status: 'for_approval', deadlineApproval: ONTEM }),
      job({ clientId: 'c1', status: 'for_approval', deadlineApproval: ONTEM }),
      job({ clientId: 'c2', status: 'for_approval', deadlineApproval: ONTEM }),
      // Dentro do prazo: não entra na conta.
      job({ clientId: 'c2', status: 'for_approval', deadlineApproval: AMANHA }),
    ];

    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa'), cliente('c2', 'Beta')], AGORA);

    expect(textoDe(saida)).toMatch(/3 conteúdos passaram do prazo de aprovação/);
    expect(fortesDe(saida)).toContain('Alfa');
    expect(fortesDe(saida)).not.toContain('Beta');
  });

  it('com uma peça só, a frase vai no singular', () => {
    const jobs = [job({ clientId: 'c1', status: 'for_approval', deadlineApproval: ONTEM })];
    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA);

    expect(textoDe(saida)).toMatch(/1 conteúdo passou do prazo de aprovação e continua aguardando/);
    // Um cliente só com uma peça não é "a maior parte" de coisa nenhuma.
    expect(fortesDe(saida)).toEqual([]);
  });

  it('ajuste em um cliente só não vira "maior acúmulo da agência"', () => {
    const umaSo = derivarInsights(
      [job({ clientId: 'c1', status: 'in_adjustment' })],
      [cliente('c1', 'Alfa')],
      AGORA
    );
    expect(umaSo.find((i) => i.id === 'ajustes-concentrados')).toBeUndefined();
    expect(textoDe(umaSo)).toMatch(/1 conteúdo aguarda ajuste/);

    const duas = derivarInsights(
      [
        job({ clientId: 'c1', status: 'in_adjustment' }),
        job({ clientId: 'c1', status: 'in_adjustment' }),
      ],
      [cliente('c1', 'Alfa')],
      AGORA
    );
    expect(duas[0].id).toBe('ajustes-concentrados');
    expect(fortesDe(duas)).toEqual(['Alfa']);
  });

  it('produção atrasada não conta o que já foi aprovado', () => {
    const jobs = [
      job({ status: 'in_production', deadlineProduction: ONTEM }),
      job({ status: 'ideas', deadlineProduction: ONTEM }),
      // Já concluídos: o prazo de produção passou e não importa mais.
      job({ status: 'approved', deadlineProduction: ONTEM }),
      job({ status: 'published', deadlineProduction: ONTEM }),
      job({ status: 'scheduled', deadlineProduction: ONTEM }),
    ];

    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA);

    expect(textoDe(saida)).toMatch(/2 conteúdos passaram do prazo de produção/);
  });

  it('prazo vazio não vira atraso', () => {
    /*
      `new Date('')` é data inválida, e `NaN < agora` é falso — mas isso é
      acidente, não decisão. A conferência é explícita porque o campo chega
      vazio do banco, e um atraso inventado num card de gargalo manda a
      agência atrás de peça que está no prazo.
    */
    const jobs = [
      job({ status: 'in_production', deadlineProduction: '' }),
      job({ status: 'for_approval', deadlineApproval: undefined }),
    ];

    expect(textoDe(derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA))).not.toMatch(
      /passar?am? do prazo/
    );
  });

  it('a taxa de primeira versão exige amostra', () => {
    /*
      Com duas peças, "100% na primeira versão" é ruído com cara de mérito, e
      o card passaria a eleger sempre o cliente mais novo da agência.
    */
    const duasPecas = [
      job({ clientId: 'c1', status: 'published', currentVersion: 1 }),
      job({ clientId: 'c1', status: 'published', currentVersion: 1 }),
    ];
    expect(
      derivarInsights(duasPecas, [cliente('c1', 'Alfa')], AGORA).find(
        (i) => i.id === 'aprovacao-de-primeira'
      )
    ).toBeUndefined();

    const tresPecas = [...duasPecas, job({ clientId: 'c1', status: 'published', currentVersion: 1 })];
    const saida = derivarInsights(tresPecas, [cliente('c1', 'Alfa')], AGORA);
    expect(saida.find((i) => i.id === 'aprovacao-de-primeira')).toBeDefined();
    expect(textoDe(saida)).toMatch(/aprovou 3 de 3 na primeira versão \(100%\)/);
  });

  it('"a melhor taxa da agência" só aparece quando há com quem comparar', () => {
    const doCliente = (id: string, versoes: number[]) =>
      versoes.map((v) => job({ clientId: id, status: 'published', currentVersion: v }));

    const sozinho = derivarInsights(
      doCliente('c1', [1, 1, 1]),
      [cliente('c1', 'Alfa')],
      AGORA
    );
    expect(textoDe(sozinho)).not.toMatch(/melhor taxa/);

    const comparando = derivarInsights(
      [...doCliente('c1', [1, 1, 1]), ...doCliente('c2', [1, 2, 2])],
      [cliente('c1', 'Alfa'), cliente('c2', 'Beta')],
      AGORA
    );
    expect(textoDe(comparando)).toMatch(/melhor taxa da agência/);
    expect(fortesDe(comparando)).toContain('Alfa');
  });

  it('taxa ruim não vira elogio', () => {
    const jobs = [
      job({ clientId: 'c1', status: 'published', currentVersion: 2 }),
      job({ clientId: 'c1', status: 'published', currentVersion: 2 }),
      job({ clientId: 'c1', status: 'published', currentVersion: 3 }),
    ];

    expect(
      derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA).find(
        (i) => i.id === 'aprovacao-de-primeira'
      )
    ).toBeUndefined();
  });

  it('tudo no prazo é um ponto positivo medido, não uma frase de efeito', () => {
    const jobs = [
      job({ status: 'in_production', deadlineProduction: AMANHA }),
      job({ status: 'for_approval', deadlineApproval: AMANHA }),
    ];

    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA);
    const bom = saida.find((i) => i.tom === 'bom');

    expect(bom?.id).toBe('sem-atraso');
    expect(textoDe(saida)).toMatch(/2 conteúdos abertos estão dentro do prazo/);
  });

  it('devolve no máximo um de cada tom', () => {
    const jobs = [
      job({ clientId: 'c1', status: 'for_approval', deadlineApproval: ONTEM }),
      job({ clientId: 'c1', status: 'in_adjustment' }),
      job({ clientId: 'c1', status: 'in_adjustment' }),
      job({ clientId: 'c1', status: 'published', currentVersion: 1 }),
      job({ clientId: 'c1', status: 'published', currentVersion: 1 }),
      job({ clientId: 'c1', status: 'published', currentVersion: 1 }),
    ];

    const saida = derivarInsights(jobs, [cliente('c1', 'Alfa')], AGORA);

    expect(saida).toHaveLength(2);
    expect(saida.filter((i) => i.tom === 'atencao')).toHaveLength(1);
    expect(saida.filter((i) => i.tom === 'bom')).toHaveLength(1);
  });
});

describe('o card não pode voltar a escrever o dado à mão', () => {
  const tela = semComentarios(
    readFileSync('src/components/dashboard/DashboardView.tsx', 'utf-8')
  );

  it('a guarda está lendo o arquivo certo', () => {
    // Sem isto, um caminho errado faria todas as asserções abaixo passarem
    // sobre string vazia — que é como uma guarda deixa de guardar em
    // silêncio.
    expect(tela).toMatch(/export const DashboardView/);
  });

  it('todo negrito do Dashboard vem de dado, nunca de literal', () => {
    /*
      É a forma que os dois nomes fictícios tinham: `<strong>EcoModa
      Brasil</strong>`. Exigir que todo `<strong>` seja seguido de `{` fecha a
      forma inteira em vez de proibir os dois nomes que alguém lembrou de
      escrever — a lista literal é como a guarda de `--radius` e as três
      versões da guarda de formato erraram.
    */
    const literais = [...tela.matchAll(/<strong>\s*([^{<][^<]*)</g)].map((m) => m[1].trim());
    expect(literais).toEqual([]);
  });

  it('os insights saem da função, não do componente', () => {
    expect(tela).toMatch(/derivarInsights\(/);
    // O selo prometia IA sobre o que é contagem.
    expect(tela).not.toMatch(/IA Operacional/);
  });

  it('o card diz o que falta quando não há o que medir', () => {
    expect(tela).toMatch(/Ainda não há o que medir/);
  });
});
