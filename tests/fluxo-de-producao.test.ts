import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
import {
  CORES_DA_ETAPA,
  ICONES_DA_ETAPA,
  estourouOSla,
  etapasDoFluxo,
  sanearFluxo,
} from '../src/lib/fluxoDeProducao';
import { ETAPAS_DO_CONTEUDO } from '../src/lib/etapasDoConteudo';
import { linhaDoTempo, type EventoDeEtapa } from '../src/lib/historicoDeEtapas';

/**
 * O fluxo de produção que a agência ajusta em Configurações → Conteúdos.
 *
 * Duas famílias de guarda, e a segunda é a que protege o produto:
 *
 * - **comportamento**, rodando as funções de verdade, porque são puras;
 * - **a fronteira**: nenhuma etapa nova. `jobs.status` tem um `check` com sete
 *   valores, e oferecer um oitavo na tela é o que o `feed_story` custou — a
 *   gravação roda em segundo plano, o Postgres recusa a linha, e dez conteúdos
 *   sumiram em silêncio enquanto o histórico dizia que tinham sido criados.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const DIA = 24 * 60 * 60 * 1000;

describe('o que vem do banco é reduzido ao que o produto reconhece', () => {
  it('descarta a chave desconhecida em vez de recusar o resto', () => {
    /*
      O jsonb não tem `check` de propósito: uma chave de uma versão mais nova,
      de uma edição à mão ou de um campo aposentado não pode derrubar a
      gravação das configurações inteiras.
    */
    const saneado = sanearFluxo({
      in_production: { rotulo: 'Edição' },
      etapa_inventada: { rotulo: 'Qualquer' },
      lixo: 42,
    });

    expect(saneado.in_production?.rotulo).toBe('Edição');
    expect(Object.keys(saneado)).toEqual(['in_production']);
  });

  it('nome em branco, cor desconhecida e prazo absurdo não entram', () => {
    const saneado = sanearFluxo({
      ideas: { rotulo: '   ' },
      for_approval: { cor: 'fucsia' },
      approved: { slaDias: -3 },
      scheduled: { slaDias: 10000 },
      published: { slaDias: 2.6 },
    });

    // Nome em branco deixaria a coluna do quadro sem rótulo nenhum.
    expect(saneado.ideas, 'nome vazio virou um ajuste').toBeUndefined();
    expect(saneado.for_approval, 'cor fora da paleta entrou').toBeUndefined();
    expect(saneado.approved, 'prazo negativo entrou').toBeUndefined();
    expect(saneado.scheduled, 'prazo absurdo entrou').toBeUndefined();
    // Prazo fracionado é arredondado, não descartado: 2,6 dias é um engano de
    // digitação sobre uma intenção clara.
    expect(saneado.published?.slaDias).toBe(3);
  });

  it('etapa sem nenhum ajuste não é guardada', () => {
    /*
      Guardar as sete inteiras na primeira abertura da tela congelaria os nomes
      de hoje nesta agência, e a próxima renomeação do produto nunca chegaria
      nela — a família do `trial_ends_at`: um valor que parece escolha e é só
      uma cópia velha do padrão.
    */
    expect(sanearFluxo({ ideas: {}, in_production: { rotulo: '' } })).toEqual({});
  });

  it('entrada que não é objeto vira fluxo vazio', () => {
    for (const valor of [null, undefined, 'texto', 7, [1, 2]]) {
      expect(sanearFluxo(valor)).toEqual({});
    }
  });
});

describe('o que a agência não mexeu cai no padrão do produto', () => {
  it('sem ajuste nenhum, as sete etapas são as do produto', () => {
    const etapas = etapasDoFluxo();

    expect(etapas.map((e) => e.status)).toEqual(ETAPAS_DO_CONTEUDO.map((e) => e.valor));
    expect(etapas.map((e) => e.rotulo)).toEqual(ETAPAS_DO_CONTEUDO.map((e) => e.rotulo));
    expect(etapas.every((e) => !e.ajustada)).toBe(true);
    expect(etapas.every((e) => CORES_DA_ETAPA.some((c) => c.valor === e.cor))).toBe(true);
  });

  it('o ajuste de uma etapa não contamina as outras', () => {
    const etapas = etapasDoFluxo(sanearFluxo({ in_production: { rotulo: 'Edição', cor: 'purple' } }));
    const edicao = etapas.find((e) => e.status === 'in_production')!;
    const ideias = etapas.find((e) => e.status === 'ideas')!;

    expect(edicao.rotulo).toBe('Edição');
    expect(edicao.rotuloPadrao, 'o nome do produto sumiu, e a tela não tem de onde partir').toBe(
      'Produção'
    );
    expect(edicao.ajustada).toBe(true);
    expect(ideias.rotulo).toBe('Ideias');
    expect(ideias.ajustada).toBe(false);
  });
});

describe('prazo em branco nunca acusa atraso', () => {
  it('sem SLA combinado, a resposta é não', () => {
    /*
      É a regra de `post_metrics` aplicada ao tempo: um prazo que ninguém
      combinou não pode acusar atraso, porque esse aviso vai para a conversa
      com quem fez o trabalho.
    */
    expect(estourouOSla(30 * DIA, undefined)).toBe(false);
    expect(estourouOSla(30 * DIA, 0)).toBe(false);
  });

  it('com SLA, o estouro é estritamente maior que o prazo', () => {
    expect(estourouOSla(2 * DIA, 2)).toBe(false);
    expect(estourouOSla(2 * DIA + 1, 2)).toBe(true);
  });
});

describe('renomear a etapa muda a frase do histórico — e só então', () => {
  const evento = (status: string, ms: number): EventoDeEtapa =>
    ({ id: status, status, entrouEm: new Date(Date.now() - ms).toISOString(), origem: 'equipe' }) as EventoDeEtapa;

  const eventos = [evento('ideas', 3 * DIA), evento('for_approval', DIA)];

  it('quem não mexeu no fluxo continua lendo a frase boa', () => {
    /*
      "Aprovado" descreve o **ato**, e o ato não muda quando a coluna muda de
      nome. Trocar todas as frases por "Movido para X" no dia em que o recurso
      entrou seria piorar o texto de todas as agências para atender a que
      renomeou.
    */
    const linha = linhaDoTempo(eventos, 'for_approval', new Date(), etapasDoFluxo());
    expect(linha.acontecimentos[1].acao).toBe('Enviado para aprovação');
  });

  it('quem renomeou não lê uma palavra que o produto dele não tem', () => {
    const etapas = etapasDoFluxo(sanearFluxo({ for_approval: { rotulo: 'Revisão do cliente' } }));
    const linha = linhaDoTempo(eventos, 'for_approval', new Date(), etapas);

    expect(linha.acontecimentos[1].acao).toBe('Movido para Revisão do cliente');
    expect(
      linha.acontecimentos[1].acao,
      'a frase ficou falando de uma etapa que esta agência não tem mais'
    ).not.toContain('aprovação');
  });

  it('as etapas que faltam também usam o nome da agência', () => {
    const etapas = etapasDoFluxo(sanearFluxo({ published: { rotulo: 'No ar' } }));
    const linha = linhaDoTempo(eventos, 'for_approval', new Date(), etapas);

    expect(linha.pendentes.map((p) => p.rotulo)).toContain('No ar');
  });
});

describe('a fronteira: o fluxo é ajustável, não extensível', () => {
  const aba = ler('src', 'components', 'settings', 'tabs', 'SettingsConteudos.tsx');
  const quadro = ler('src', 'components', 'kanban', 'KanbanBoard.tsx');
  const cartao = ler('src', 'components', 'kanban', 'CartaoDoQuadro.tsx');

  it('a tela não oferece acrescentar nem remover etapa', () => {
    /*
      `jobs.status` tem um `check` com os sete valores. Uma etapa a mais na
      tela sem valor no `check` é o `feed_story` de novo: a tela oferece, o
      banco recusa, a gravação roda em segundo plano e o conteúdo some sem
      erro em lugar nenhum.
    */
    expect(aba, 'apareceu um "adicionar etapa" sem valor correspondente no banco').not.toMatch(
      /Nova etapa|Adicionar etapa|Criar etapa/i
    );
    expect(aba, 'a lista de etapas da tela deixou de ser a do produto').toContain(
      'etapasDoFluxo('
    );
  });

  it('a tela diz que as etapas são fixas, em vez de deixar a pessoa descobrir', () => {
    // Esconder a limitação faz concluir que o produto não tem a
    // funcionalidade; dizê-la explica o que ela custa. É a regra da aba
    // Integrações.
    expect(aba, 'a tela parou de explicar por que não dá para criar etapa').toMatch(
      /sete etapas são fixas/
    );
  });

  it('quadro, card e histórico leem os nomes do mesmo lugar', () => {
    /*
      Três listas divergem na primeira pressa — é a história das doze alturas
      de botão. Aqui divergir significa a coluna e o card chamando a mesma
      etapa de coisas diferentes, na mesma tela.
    */
    for (const [nome, fonte] of [
      ['o quadro', quadro],
      ['o card', cartao],
    ] as const) {
      expect(fonte, `${nome} deixou de ler as etapas do fluxo da agência`).toContain(
        'etapasDoFluxo('
      );
    }
    expect(quadro, 'voltou um título de coluna escrito à mão').not.toMatch(/\btitle: '/);
  });

  it('arquivar só alcança o que já foi publicado', () => {
    /*
      Esconder uma peça **aberta** por idade seria o quadro omitindo trabalho
      que ainda precisa ser feito — e a pessoa concluiria que ela foi perdida.
    */
    const corpo = quadro.slice(quadro.indexOf('const arquivada'));
    expect(corpo.slice(0, 400), 'o arquivamento deixou de olhar o status').toMatch(
      /job\.status !== 'published'/
    );
    expect(corpo.slice(0, 400), 'zero deixou de valer "nunca arquivar"').toMatch(
      /diasParaArquivar <= 0/
    );
  });
});

describe('a migração do fluxo', () => {
  const arquivo = readdirSync(join(RAIZ, 'supabase', 'migrations'))
    .filter((f) => f.includes('fluxo_de_producao'))
    .sort()
    .pop();

  it('existe e é repetível', () => {
    expect(arquivo, 'a migração do fluxo de produção sumiu').toBeTruthy();
    const sql = semComentarios(
      readFileSync(join(RAIZ, 'supabase', 'migrations', arquivo!), 'utf-8')
    ).toLowerCase();

    expect(sql).toMatch(/add column if not exists fluxo_de_producao jsonb/);
    expect(sql).toMatch(/add column if not exists arquivar_publicados_apos_dias/);

    /*
      **Sem `check` no conteúdo do jsonb, e isto é deliberado.** Quem valida é
      `sanearFluxo`, que descarta o que não reconhece; um `check` aqui faria
      uma chave desconhecida derrubar a gravação das configurações inteiras,
      que é a troca errada para um campo de aparência.
    */
    expect(sql, 'apareceu um check no jsonb do fluxo').not.toMatch(
      /check[\s\S]{0,80}fluxo_de_producao/
    );
  });
});

/**
 * A paleta da etapa e a marca da agência não podem ser a mesma cor.
 *
 * `DynamicThemeProvider` injeta uma folha de `!important` que repinta **toda**
 * classe de uma família de cor com a cor da agência — é assim que o whitelabel
 * funciona. A paleta tinha "Roxo", que é justamente essa família: numa agência
 * de marca rosa, a bolinha roxa saía **rosa**, idêntica à do "Rosa" ao lado, e
 * a etapa escolhida como roxa aparecia no quadro com a cor de outra.
 *
 * Chegou como *"não está sincronizado"*, que descreve bem o que se vê: a
 * escolha e o resultado não batem, e nada explica por quê.
 *
 * **A guarda deriva a família da própria folha**, em vez de escrever "purple":
 * no dia em que a marca mudar de família, ela segue junto. Lista literal
 * obrigaria a editá-la com o código, que é como ela deixa de guardar.
 */
describe('a cor da etapa não colide com a cor da agência', () => {
  const tema = ler('src', 'components', 'common', 'DynamicThemeProvider.tsx');

  const familiaDaMarca = () => {
    const nomes = new Set<string>();
    for (const [, familia] of tema.matchAll(/\.(?:dark .)?(?:[a-z\:-]*)bg-([a-z]+)-\d/g)) {
      nomes.add(familia);
    }
    return [...nomes];
  };

  it('a folha de !important repinta alguma família, e a paleta não a usa', () => {
    const familias = familiaDaMarca();

    expect(
      familias.length,
      'a folha do whitelabel deixou de repintar classe nenhuma — ou o formato mudou'
    ).toBeGreaterThan(0);

    for (const cor of CORES_DA_ETAPA) {
      const classes = `${cor.ponto} ${cor.caixa} ${cor.borda}`;
      for (const familia of familias) {
        expect(
          classes.includes(`${familia}-`),
          `a cor "${cor.valor}" usa ${familia}, que o whitelabel repinta com a cor da ` +
            'agência: a etapa apareceria com a cor da marca, não com a escolhida'
        ).toBe(false);
      }
    }
  });

  it('quem já tinha escolhido o roxo não perde a escolha', () => {
    /*
      `sanearFluxo` descarta cor desconhecida — certo para chave inventada,
      errado aqui: a agência escolheu, o produto é que mudou de nome. Sem a
      tradução, a etapa voltaria calada para a cor padrão.
    */
    const saneado = sanearFluxo({ scheduled: { cor: 'purple' } });

    expect(saneado.scheduled?.cor, 'a cor escolhida foi descartada na renomeação').toBeTruthy();
    expect(
      CORES_DA_ETAPA.some((c) => c.valor === saneado.scheduled?.cor),
      'a tradução devolveu uma cor que a paleta não tem'
    ).toBe(true);
  });
});

/**
 * O ícone da etapa: lista fechada, e as duas pontas conferidas.
 *
 * A lista de **chaves** mora em `fluxoDeProducao.ts`, que é dado puro; o
 * **desenho** mora em `IconeDaEtapa.tsx`, porque importar React naquele módulo
 * levaria a árvore de ícones para dentro de funções que só decidem strings.
 *
 * O preço da separação é que as duas podem divergir — e divergir aqui **não
 * quebra nada visível**: a etapa fica sem ícone, com a tela desenhada e um
 * buraco onde a pessoa escolheu alguma coisa.
 */
describe('o ícone da etapa', () => {
  const desenhos = ler('src', 'components', 'common', 'IconeDaEtapa.tsx');

  const chavesDesenhadas = () => {
    const inicio = desenhos.indexOf('const DESENHO');
    const corpo = desenhos.slice(inicio, desenhos.indexOf('};', inicio));
    return [...corpo.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]);
  };

  it('toda chave oferecida tem desenho, e todo desenho é oferecido', () => {
    const oferecidas = ICONES_DA_ETAPA.map((i: { valor: string }) => i.valor);
    const desenhadas = chavesDesenhadas();

    expect(desenhadas.length, 'o mapa de desenhos ficou vazio — o recorte mudou').toBeGreaterThan(
      0
    );
    expect([...oferecidas].sort(), 'a lista de ícones e o mapa de desenhos divergiram').toEqual(
      [...desenhadas].sort()
    );
  });

  it('toda etapa tem ícone, mesmo sem a agência ter escolhido', () => {
    /*
      Padrão ausente deixaria a coluna com um buraco do tamanho do ícone e o
      título deslocado em relação às vizinhas — parece defeito do quadro, não
      configuração faltando.
    */
    for (const etapa of etapasDoFluxo(null)) {
      expect(etapa.icone, `a etapa ${etapa.status} ficou sem ícone padrão`).toBeTruthy();
    }
  });

  it('o ícone escolhido é guardado, e o inventado é descartado', () => {
    const bom = sanearFluxo({ ideas: { icone: 'foguete' } });
    expect(bom.ideas?.icone).toBe('foguete');

    const ruim = sanearFluxo({ ideas: { icone: 'nave-espacial' } });
    expect(ruim.ideas, 'ícone inventado virou um ajuste vazio').toBeUndefined();
  });
});
