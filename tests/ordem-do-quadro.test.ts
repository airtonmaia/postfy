import { describe, it, expect } from 'vitest';
import {
  ordenarColuna,
  dentroDoPeriodo,
  dataQueOrdena,
  ORDEM_PADRAO,
  PERIODO_PADRAO,
  ORDENS,
  PERIODOS,
} from '../src/lib/ordemDoQuadro';
import type { Job } from '../src/types';

/**
 * A ordem das colunas do quadro.
 *
 * **O quadro nunca ordenou nada.** `filteredJobs` não tinha um `.sort()`: a
 * ordem era a da carga do banco, que ninguém escolheu e que muda quando a
 * consulta muda. Ela *parecia* ser por data, e acidente com cara de regra é o
 * pior tipo — as pessoas passam a contar com ele, e ele muda sem aviso no dia
 * em que alguém mexe numa consulta em outro arquivo.
 *
 * O que estas guardas exercitam é a regra que substituiu o acidente: por
 * data, do mais próximo para o mais distante, **com o card arrastado
 * segurando o índice e o resto fluindo em volta dele**.
 *
 * Comportamento, não forma. As quatro guardas da bandeira booleana passavam
 * enquanto o produto perdia dado porque descreviam o mecanismo; aqui entram
 * dados e sai ordem.
 *
 * O relógio entra por parâmetro em toda asserção de período: os dois testes
 * de `quandoDeveSair` começaram a falhar com o código intacto por terem
 * instante absoluto dentro de função que lê `Date.now()`.
 */

const HOJE = new Date('2026-09-22T12:00:00.000Z');

/**
 * O fuso vai explicito em toda assercao de dia.
 *
 * O teste de `descreverBuild` criava a data no fuso do runner e conferia a
 * saida no mesmo fuso: os dois lados se cancelavam e ele passava em qualquer
 * maquina sem nunca afirmar em que fuso o rodape deveria estar. Aqui a
 * fronteira do dia e o que esta sendo testado, entao ela nao pode depender de
 * onde o teste roda.
 */
const FUSO = 'America/Sao_Paulo';

const job = (parcial: Partial<Job> & { id: string }): Job =>
  ({
    workspaceId: 'w1',
    clientId: 'c1',
    title: parcial.id,
    status: 'ideas',
    priority: 'medium',
    currentVersion: 1,
    posicaoFixa: null,
    ...parcial,
  }) as Job;

/** Só as datas, na ordem em que saíram. Torna a asserção legível. */
const ids = (lista: Job[]) => lista.map((j) => j.id);

describe('a ordem padrão é por data, do mais próximo para o mais distante', () => {
  it('o padrão declarado é data e qualquer data', () => {
    // Se alguém trocar o padrão, que seja de propósito e não por descuido.
    expect(ORDEM_PADRAO).toBe('data');
    expect(PERIODO_PADRAO).toBe('todos');
    expect(ORDENS.map((o) => o.valor)).toContain('data');
    expect(PERIODOS.map((p) => p.valor)).toContain('todos');
  });

  it('ordena crescente: o que vence antes sobe', () => {
    const lista = [
      job({ id: 'c', scheduledDate: '2026-10-19T10:00:00Z' }),
      job({ id: 'a', scheduledDate: '2026-09-23T10:00:00Z' }),
      job({ id: 'b', scheduledDate: '2026-10-05T10:00:00Z' }),
    ];

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['a', 'b', 'c']);
  });

  it('peça sem data vai para o fim, nunca para o topo', () => {
    /*
      Ela não tem urgência para comparar, e no topo empurraria para baixo
      justamente o que tem prazo. Continua visível na coluna, com "sem data"
      escrito no card — que é o que avisa que falta agendar.
    */
    const lista = [
      job({ id: 'sem-data' }),
      job({ id: 'tem-data', scheduledDate: '2026-10-19T10:00:00Z' }),
    ];

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['tem-data', 'sem-data']);
  });

  it('data inválida conta como sem data, não como ano 2000', () => {
    // `new Date(':00Z')` devolve 1º de janeiro de 2000 no V8, não data
    // inválida — o mesmo permissivismo que fez `deParedeParaUtc` conferir o
    // formato com regex antes de o `Date` ver o texto.
    const lista = [
      job({ id: 'quebrada', scheduledDate: 'nao-e-data' }),
      job({ id: 'boa', scheduledDate: '2026-10-19T10:00:00Z' }),
    ];

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['boa', 'quebrada']);
  });

  it('a ordem é estável: dois cards iguais não trocam de lugar', () => {
    /*
      Sem o desempate pelo id, a saída depende do `sort` do motor e a lista
      "treme" entre renderizações — o tipo de instabilidade que ninguém
      reporta como bug e todo mundo sente.
    */
    const mesmaData = '2026-10-19T10:00:00Z';
    const lista = [
      job({ id: 'zz', scheduledDate: mesmaData }),
      job({ id: 'aa', scheduledDate: mesmaData }),
    ];

    const uma = ids(ordenarColuna(lista, 'data'));
    const outra = ids(ordenarColuna([...lista].reverse(), 'data'));
    expect(uma).toEqual(outra);
    expect(uma).toEqual(['aa', 'zz']);
  });

  it('a data que ordena é a que o card mostra', () => {
    // Ordenar por um prazo que não está na tela produz uma lista que a pessoa
    // não consegue conferir olhando — indistinguível de desordem.
    const j = job({
      id: 'x',
      scheduledDate: '2026-10-19T10:00:00Z',
      deadlineProduction: '2026-01-01T10:00:00Z',
    });
    expect(dataQueOrdena(j)).toBe('2026-10-19T10:00:00Z');
  });
});

describe('o card arrastado segura o índice, e o resto flui em volta', () => {
  const porData = (ids: string[], base = 5) =>
    ids.map((id, i) =>
      job({ id, scheduledDate: `2026-10-0${base + i}T10:00:00Z` })
    );

  it('sem ninguém fixado, é só a ordem da chave', () => {
    const lista = porData(['a', 'b', 'c', 'd']);
    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('um card fixado ocupa o índice dele e os outros preenchem o resto', () => {
    const lista = porData(['a', 'b', 'c', 'd']);
    // 'd' é o mais distante; alguém o arrastou para a segunda posição.
    lista[3].posicaoFixa = 1;

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('fixar no topo põe no topo, e zero não é "vazio"', () => {
    /*
      `0` é o índice mais fixado que existe. Um `ounull` no mapper, ou um
      `posicaoFixa || null`, transformaria o topo da coluna em "não fixado" —
      e o card voltaria sozinho para o meio da lista depois do F5.
    */
    const lista = porData(['a', 'b', 'c']);
    lista[2].posicaoFixa = 0;

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['c', 'a', 'b']);
  });

  it('dois fixados convivem, cada um no seu índice', () => {
    const lista = porData(['a', 'b', 'c', 'd', 'e']);
    lista[4].posicaoFixa = 0;
    lista[3].posicaoFixa = 2;

    expect(ids(ordenarColuna(lista, 'data'))).toEqual(['e', 'a', 'd', 'b', 'c']);
  });

  it('índice além do fim da coluna cai no fim, sem sumir nem travar', () => {
    // Uma coluna encolhe quando os cards mudam de etapa: um índice válido
    // hoje fica maior que a lista amanhã, sem ninguém editar nada.
    const lista = porData(['a', 'b']);
    lista[0].posicaoFixa = 9;

    const saida = ordenarColuna(lista, 'data');
    expect(saida).toHaveLength(2);
    expect(ids(saida)).toEqual(['b', 'a']);
  });

  it('dois fixados no mesmo índice não perdem card nem viram ordem aleatória', () => {
    /*
      Não deveria acontecer, e pode: o banco é compartilhado e duas pessoas
      fixam ao mesmo tempo. O desempate é a própria chave, então as duas
      máquinas mostram a mesma coluna.
    */
    const lista = porData(['a', 'b', 'c']);
    lista[1].posicaoFixa = 0;
    lista[2].posicaoFixa = 0;

    const saida = ordenarColuna(lista, 'data');
    expect(saida).toHaveLength(3);
    expect(ids(saida)).toEqual(['b', 'c', 'a']);
  });

  it('nenhum card é perdido nem duplicado, em qualquer combinação', () => {
    // A propriedade que importa mais que a ordem: o quadro não pode comer uma
    // peça. A gravação roda em segundo plano, e um card que some da coluna é
    // indistinguível de um que não foi salvo.
    const base = porData(['a', 'b', 'c', 'd', 'e']);

    for (const indices of [[0], [4], [9], [0, 1], [2, 2], [0, 9], [1, 3, 4]]) {
      const lista = base.map((j, i) => job({ ...j, id: j.id, posicaoFixa: null, scheduledDate: j.scheduledDate }));
      indices.forEach((pos, k) => {
        lista[k].posicaoFixa = pos;
      });

      const saida = ordenarColuna(lista, 'data');
      expect(saida, `índices ${JSON.stringify(indices)}`).toHaveLength(lista.length);
      expect(new Set(ids(saida)).size, `índices ${JSON.stringify(indices)}`).toBe(
        lista.length
      );
    }
  });

  it('a fixação vale para qualquer chave de ordenação, não só data', () => {
    // O card fixado segura o lugar; o que muda com a chave é como o resto
    // flui em volta dele.
    const lista = [
      job({ id: 'urgente', priority: 'urgent', scheduledDate: '2026-10-09T10:00:00Z' }),
      job({ id: 'baixa', priority: 'low', scheduledDate: '2026-10-07T10:00:00Z' }),
      job({ id: 'media', priority: 'medium', scheduledDate: '2026-10-08T10:00:00Z' }),
    ];
    lista[1].posicaoFixa = 0;

    expect(ids(ordenarColuna(lista, 'prioridade'))).toEqual([
      'baixa',
      'urgente',
      'media',
    ]);
  });
});

describe('a janela de datas', () => {
  const em = (iso: string) => job({ id: iso, scheduledDate: iso });

  it('"qualquer data" não esconde nada, nem o que não tem data', () => {
    expect(dentroDoPeriodo(job({ id: 'sem' }), 'todos', HOJE, FUSO)).toBe(true);
  });

  it('peça sem data não cabe em janela nenhuma', () => {
    /*
      A janela pergunta "o que acontece neste período", e o que não tem data
      não acontece em período nenhum. Some da tela — por isso quem chama
      **conta as escondidas** e o quadro diz o número. Sumiço silencioso é a
      armadilha 9.
    */
    const sem = job({ id: 'sem' });
    for (const p of ['atrasados', 'proximos_7', 'este_mes', 'mes_que_vem'] as const) {
      expect(dentroDoPeriodo(sem, p, HOJE, FUSO), p).toBe(false);
    }
  });

  it('"já passou" pega ontem e não pega hoje — na fronteira do fuso da agência', () => {
    /*
      **A fronteira é a meia-noite de São Paulo, não a de Greenwich**, e a
      primeira versão deste teste errou exatamente aí: eu afirmei que
      `2026-09-22T01:00:00Z` era "hoje", e ele é 21/09 às 22h na agência —
      ontem, e portanto atrasado. O código estava certo; a asserção é que
      estava escrita em UTC.

      Vale registrar porque é o mesmo engano do lado de quem usa: quem olha o
      quadro às 22h vê o conteúdo de hoje virar "já passou" à meia-noite dele,
      não à meia-noite de um relógio que ele não vê. Os dois instantes abaixo
      cercam essa virada — 03:00Z é meia-noite em São Paulo.
    */
    expect(dentroDoPeriodo(em('2026-09-22T02:59:00Z'), 'atrasados', HOJE, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-09-22T03:01:00Z'), 'atrasados', HOJE, FUSO)).toBe(false);

    // E o dia inteiro de hoje não está atrasado, nem no fim dele.
    expect(dentroDoPeriodo(em('2026-09-23T02:00:00Z'), 'atrasados', HOJE, FUSO)).toBe(false);
  });

  it('a fronteira acompanha a agência, não o dispositivo', () => {
    /*
      O mesmo instante, dois fusos: em Manaus (UTC−4) ele ainda é ontem; em
      São Paulo (UTC−3) já é hoje. Sem o fuso da agência mandando, a mesma
      peça apareceria em "já passou" para um membro da equipe e não para o
      colega — e quem olha conclui que o filtro tem defeito, não que os dois
      relógios discordam. É a armadilha 8.2.
    */
    const instante = em('2026-09-22T03:30:00Z');
    expect(dentroDoPeriodo(instante, 'atrasados', HOJE, 'America/Sao_Paulo')).toBe(false);
    expect(dentroDoPeriodo(instante, 'atrasados', HOJE, 'America/Manaus')).toBe(true);
  });

  it('"próximos 7 dias" começa hoje e não inclui o oitavo', () => {
    expect(dentroDoPeriodo(em('2026-09-22T08:00:00Z'), 'proximos_7', HOJE, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-09-28T23:00:00Z'), 'proximos_7', HOJE, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-09-29T08:00:00Z'), 'proximos_7', HOJE, FUSO)).toBe(false);
    expect(dentroDoPeriodo(em('2026-09-21T08:00:00Z'), 'proximos_7', HOJE, FUSO)).toBe(false);
  });

  it('"este mês" é o mês do calendário, não 30 dias', () => {
    expect(dentroDoPeriodo(em('2026-09-01T08:00:00Z'), 'este_mes', HOJE, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-09-30T20:00:00Z'), 'este_mes', HOJE, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-10-01T08:00:00Z'), 'este_mes', HOJE, FUSO)).toBe(false);
  });

  it('"mês que vem" atravessa a virada do ano', () => {
    const dezembro = new Date('2026-12-15T12:00:00.000Z');
    expect(dentroDoPeriodo(em('2027-01-10T08:00:00Z'), 'mes_que_vem', dezembro, FUSO)).toBe(true);
    expect(dentroDoPeriodo(em('2026-12-20T08:00:00Z'), 'mes_que_vem', dezembro, FUSO)).toBe(false);
  });
});
