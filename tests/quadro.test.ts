import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * Arrastar o card no quadro.
 *
 * O comentário de `moveJobStatus` já dizia, havia meses, que arrastar o card
 * para "Para Aprovação" é "como a maior parte do conteúdo chega" àquela
 * coluna — e **não havia como arrastar nada**. O quadro tinha um seletor
 * dentro do card e mais nada.
 *
 * O que estas guardas protegem não quebra tipo, teste de componente nem
 * build. Duas delas protegem o produto, não a interação:
 *
 * - **Arrastar nunca enfileira publicação.** É a regra que existe porque o
 *   que sai no perfil do cliente não volta.
 * - **Soltar na coluna de onde a peça saiu não grava nada.**
 */

const RAIZ = join(__dirname, '..');
const PASTA = join(RAIZ, 'src', 'components', 'kanban');

const ler = (arquivo: string) =>
  semComentarios(readFileSync(join(PASTA, arquivo), 'utf-8'));

const quadro = ler('KanbanBoard.tsx');
const cartao = ler('CartaoDoQuadro.tsx');
/** Os dois juntos, para a guarda não morrer quando um trecho mudar de arquivo. */
const tudo = readdirSync(PASTA)
  .filter((f) => f.endsWith('.tsx'))
  .map(ler)
  .join('\n');

describe('arrastar muda de etapa, e só isso', () => {
  it('soltar chama moveJobStatus', () => {
    /**
     * `updateJob` direto pularia duas coisas que `moveJobStatus` faz: o
     * carimbo da data ao entrar em "Publicado" e o aviso ao cliente ao entrar
     * em "Para Aprovação" — que é justamente o caminho que arrastar abre.
     */
    const corpo = quadro.slice(quadro.indexOf('const aoTerminarArrasto'));
    expect(corpo.slice(0, 1600), 'o soltar deixou de passar por moveJobStatus').toMatch(
      /moveJobStatus\(job\.id, novoStatus\)/
    );
  });

  it('arrastar não enfileira publicação sem passar por uma pergunta', () => {
    /**
     * **Esta é a guarda que protege o produto, não a interação**, e ela mudou
     * de forma quando "Agendado" virou coluna própria.
     *
     * Antes o quadro não podia nem mencionar `agendarPublicacao`: não havia
     * destino que pedisse isso, e a coluna juntada escolhia sempre `approved`.
     * Hoje há — e a regra não é "o quadro não agenda", é **"nenhum gesto
     * agenda sozinho"**: "Agendado" significa que a peça está na
     * `publish_queue` e vai ao ar na data, e postagem no perfil do cliente
     * não volta.
     *
     * Então a guarda afirma três coisas, e as três são de efeito:
     *
     * 1. soltar em `scheduled` sai do caminho que grava, antes de gravar;
     * 2. quem chama `agendarPublicacao` é uma função que a **confirmação**
     *    dispara, nunca o `onDragEnd`;
     * 3. a confirmação diz a consequência — `descricao` existe para isso.
     */
    const corpo = quadro.slice(quadro.indexOf('const aoTerminarArrasto'));
    const ate = corpo.slice(0, corpo.indexOf('const aoComecarArrasto') + 1 || 1600);

    expect(
      ate,
      'soltar em "Agendado" voltou a gravar direto: o card diria "Agendado" com a fila vazia'
    ).toMatch(/novoStatus === 'scheduled'[\s\S]{0,200}return;/);

    expect(
      ate,
      'o arrasto passou a enfileirar publicação direto, sem perguntar'
    ).not.toMatch(/agendarPublicacao/);

    const pergunta = quadro.slice(quadro.indexOf('const pedirAgendamento'));
    expect(pergunta, 'o agendamento do quadro deixou de perguntar').toMatch(/pedir\(\{/);
    expect(pergunta.slice(0, 1600), 'a pergunta não diz mais o que vai acontecer').toMatch(
      /descricao:/
    );
  });

  it('agendar pelo quadro confere a data e a arte do story', () => {
    /*
      **Sem data, `quandoDeveSair` entende "agora"** — é a regra do "agendei
      para agora" —, então uma peça sem data entraria na fila para sair na
      primeira passada do cron: arrastar um card publicaria no perfil do
      cliente em cinco minutos.

      E `faltaArteDoStory` é a conferência que mora **antes** da ação: o
      publicador não troca mais a arte do story pela do feed, mas descobrir lá
      é tarde — o feed já está no ar e a peça ficou pela metade.
    */
    const pergunta = quadro.slice(
      quadro.indexOf('const pedirAgendamento'),
      quadro.indexOf('const agendar =')
    );

    expect(pergunta, 'o quadro agenda peça sem data').toMatch(/!job\.scheduledDate/);
    expect(pergunta, 'a conferência da arte do story saiu do quadro').toMatch(
      /faltaArteDoStory\(job\)/
    );
  });

  it('soltar onde a peça já estava não grava nada', () => {
    // Sem isto, arrastar e desistir gravaria o mesmo status de novo — e cada
    // gravação dessas vira uma linha no histórico de atividade que não
    // aconteceu.
    const corpo = quadro.slice(quadro.indexOf('const statusAoSoltar'));
    expect(corpo.slice(0, 400), 'soltar na mesma coluna voltou a gravar').toMatch(
      /if \(col\.statuses\.includes\(job\.status\)\) return null;/
    );
  });
});

describe('o mesmo gesto abre e arrasta', () => {
  it('os sensores têm restrição de ativação', () => {
    /**
     * Sem restrição, o dnd-kit começa a arrastar no `pointerdown` e o clique
     * nunca acontece: **o quadro deixa de abrir conteúdo**. Nada local acusa
     * isso — `tsc` compila, o vitest não monta componente e o `vite build` não
     * mede gesto nenhum.
     */
    const corpo = quadro.slice(quadro.indexOf('const sensores'));
    expect(corpo.slice(0, 500), 'o sensor de mouse perdeu a distância de ativação').toMatch(
      /MouseSensor, \{ activationConstraint: \{ distance: \d+ \} \}/
    );
  });

  it('no toque a ativação é por tempo, não por distância', () => {
    /**
     * Distância no toque **sequestra a rolagem**: a coluna rola na vertical e
     * o quadro na horizontal, então qualquer deslize viraria arrasto e o
     * quadro ficaria impossível de percorrer no telefone. Com a pausa,
     * deslizar rola e segurar arrasta.
     */
    const corpo = quadro.slice(quadro.indexOf('const sensores'));
    expect(
      corpo.slice(0, 500),
      'o toque voltou a ativar por distância — a rolagem do quadro vira arrasto'
    ).toMatch(/TouchSensor, \{ activationConstraint: \{ delay: \d+, tolerance: \d+ \} \}/);
  });

  it('o seletor de status dentro do card não inicia arrasto', () => {
    // Sem parar o `pointerdown`, encostar no seletor começa a mover o card em
    // vez de abrir a lista — e o card tem sete status que o quadro não tem.
    const corpo = cartao.slice(cartao.indexOf('<select'));
    const acima = cartao.slice(Math.max(0, cartao.indexOf('<select') - 500), cartao.indexOf('<select'));
    expect(
      acima,
      'o seletor do card voltou a disparar o arrasto'
    ).toMatch(/onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/);
    expect(corpo.length).toBeGreaterThan(0);
  });
});

describe('o card arrastado é o mesmo card', () => {
  it('o overlay monta o componente, não uma cópia do JSX', () => {
    /**
     * O `DragOverlay` desenha o card fora da coluna, e a saída fácil é copiar
     * o JSX para lá. Duas cópias divergem na primeira pressa — e aqui o custo
     * é imediato: o card sob o cursor deixa de parecer o card que a pessoa
     * pegou.
     */
    expect(quadro, 'o overlay sumiu — o card ficaria preso no overflow da coluna').toMatch(
      /<DragOverlay/
    );
    expect(quadro, 'o overlay voltou a desenhar o card à mão').toMatch(
      /<CartaoDoQuadro[\s\S]{0,200}flutuando/
    );
    expect(cartao, 'o desenho do card saiu do componente compartilhado').toMatch(
      /export const CartaoDoQuadro/
    );
  });

  it('a coluna vazia continua sendo alvo', () => {
    // Sem altura mínima, a coluna sem card não tem área para soltar nada — e a
    // primeira peça de uma coluna vazia é justamente a que alguém arrasta.
    expect(quadro, 'a coluna vazia perdeu a área de soltura').toMatch(/min-h-24/);
    expect(quadro).toMatch(/Solte aqui/);
  });
});

describe('a ordem da coluna, e a posição que o arrasto grava', () => {
  /**
   * **O quadro nunca ordenou nada.** `filteredJobs` não tinha um `.sort()`: a
   * ordem de cada coluna era a da carga do banco — que ninguém escolheu, que
   * muda quando a consulta muda, e que *parecia* ser por data. Acidente com
   * cara de regra é o pior tipo.
   *
   * O comportamento do algoritmo é exercitado em `tests/ordem-do-quadro.test.ts`,
   * com dados de verdade. O que fica aqui é o que só a tela pode errar: usar a
   * lista errada, gravar o que não devia, ou esconder peça sem dizer.
   */
  it('a guarda está lendo o quadro', () => {
    // Sem isto, um arquivo renomeado faria todas as asserções abaixo passarem
    // sobre string vazia.
    expect(quadro).toMatch(/const KanbanBoard|KanbanBoard: React\.FC|export default KanbanBoard/);
    expect(quadro.length).toBeGreaterThan(2000);
  });

  it('a coluna desenha a lista ordenada, não o filtro cru', () => {
    /*
      A lista é calculada uma vez e usada no desenho **e** no `onDragEnd`, que
      converte "soltei em cima deste card" em índice. Duas listas divergentes
      fariam a peça cair num lugar diferente do que a pessoa viu.
    */
    expect(quadro).toMatch(/ordenarColuna\(/);
    expect(quadro).toMatch(/jobsPorColuna/);
    expect(
      quadro,
      'a coluna voltou a filtrar direto de filteredJobs, ignorando a ordem'
    ).not.toMatch(/const colJobs = filteredJobs\.filter/);
  });

  it('o arrasto grava a posição, e é ela que a ordenação respeita', () => {
    expect(quadro).toMatch(/posicaoFixa: destino/);
    // `SortableContext` é o que dá posição ao arrasto: sem ele o dnd-kit só
    // sabe em qual coluna o cursor está, e soltar no meio da lista seria
    // indistinguível de soltar no fim.
    expect(quadro).toMatch(/SortableContext/);
  });

  it('soltar onde a peça já estava continua não gravando nada', () => {
    /*
      A regra é a mesma de antes, agora mais larga: cobria a coluna, passou a
      cobrir a posição. Sem ela, pegar um card e devolvê-lo ao mesmo lugar o
      fixaria — um gesto de desistência viraria uma decisão que o quadro
      respeita para sempre.
    */
    const corpo = quadro.slice(quadro.indexOf('const aoTerminarArrasto'));
    const handler = corpo.slice(0, corpo.indexOf('\n  };'));

    expect(handler.length).toBeGreaterThan(200);
    expect(handler, 'sumiu a saída de "soltei em cima de mim mesmo"').toMatch(
      /alvo === job\.id && !novoStatus/
    );
    expect(handler, 'sumiu a saída de "mesma posição"').toMatch(
      /job\.posicaoFixa === destino/
    );
  });

  it('o card fixado se identifica e dá como soltar', () => {
    /*
      Card parado num lugar que a ordem escolhida não explica parece defeito
      do quadro. Sem a marca, quem fixou semana passada não tem como descobrir
      que foi ele mesmo — e sem a saída, não tem como desfazer.
    */
    expect(cartao).toMatch(/posicaoFixa != null/);
    expect(cartao).toMatch(/aoSoltarPosicao/);
    // O menu de ordenação também solta, para quem não sabe em qual card olhar.
    expect(quadro).toMatch(/soltarTodos/);
  });

  it('a janela de datas não esconde peça em silêncio', () => {
    /*
      A janela pergunta "o que acontece neste período", e o que não tem data
      não acontece em período nenhum — então some. Sumiço silencioso é a
      armadilha 9: quem filtra e não encontra a peça que acabou de criar
      conclui que ela não foi salva.
    */
    expect(quadro).toMatch(/semDataEscondidas/);
    expect(quadro).toMatch(/fora desta janela/);
  });

  it('arrastar continua sem enfileirar publicação', () => {
    // A regra mais cara do quadro, repetida aqui porque o handler foi
    // reescrito: o que sai no perfil do cliente não volta.
    expect(quadro).toMatch(/statusAoSoltar/);
    expect(quadro, 'o arrasto passou a escolher `scheduled`').not.toMatch(
      /novoStatus\s*=\s*['"]scheduled['"]/
    );
  });
});

/**
 * A faixa de clientes no topo do quadro.
 *
 * Ela não é um segundo filtro: é outro jeito de mexer no `clientFilter` que o
 * seletor "Todos os Clientes" já usava. **Dois controles para um estado é uma
 * coisa; dois estados para a mesma pergunta é outra**, e é a que este projeto
 * paga caro — a tela passaria a mostrar um recorte e o seletor a afirmar
 * outro, sem erro em lugar nenhum.
 *
 * Nada local acusa se isso quebrar: `tsc` aceita um `useState` a mais, o
 * vitest não monta componente e o `vite build` não sabe o que é filtro. Só
 * aparece clicando numa foto e vendo o seletor continuar dizendo "Todos".
 */
describe('a faixa de clientes filtra o quadro', () => {
  const faixa = ler('ClientesDoQuadro.tsx');
  const quadro = ler('KanbanBoard.tsx');

  it('a seleção mora no contexto, nunca dentro da faixa', () => {
    /*
      Um `useState` aqui faria a faixa guardar a própria escolha. O quadro
      continuaria lendo `clientFilter`, e clicar na foto pintaria o anel sem
      filtrar nada — ou pior, filtraria e deixaria o seletor mentindo.
    */
    expect(faixa, 'a faixa passou a guardar a seleção por conta própria').not.toMatch(
      /useState/
    );
    expect(faixa).toMatch(/selecionado/);
  });

  it('o quadro liga a faixa ao mesmo estado do seletor', () => {
    // O seletor e a faixa precisam ler e escrever o mesmo par. A guarda mede
    // o efeito: os dois identificadores chegam à faixa.
    const uso = quadro.slice(quadro.indexOf('<ClientesDoQuadro'));

    expect(uso.slice(0, 300), 'a faixa deixou de ler o filtro do quadro').toMatch(
      /selecionado=\{clientFilter\}/
    );
    expect(uso.slice(0, 300), 'clicar na foto deixou de mudar o filtro').toMatch(
      /aoSelecionar=\{setClientFilter\}/
    );
  });

  it('a faixa lista os mesmos clientes do seletor', () => {
    /*
      Conjuntos diferentes nos dois controles fariam um cliente existir num e
      não no outro — e quem não o achasse na faixa concluiria que ele saiu da
      agência. Por isso a faixa recebe a lista pronta, sem filtrar por conta.
    */
    expect(quadro).toMatch(/clientes=\{clients\}/);
    expect(faixa, 'a faixa passou a recortar a lista por conta própria').not.toMatch(
      /clientes\.filter\(/
    );
  });

  it('há sempre como voltar para todos', () => {
    // Sem o item "Todos", sair de um cliente dependeria de descobrir que
    // clicar de novo desmarca — regra que ninguém adivinha, e que deixaria a
    // pessoa presa achando que o quadro esvaziou.
    expect(faixa).toMatch(/id: 'all'/);
  });
});

/**
 * Calendário e Quadro são um menu só.
 *
 * Eram dois itens na barra lateral, e isso era a pergunta errada: não são
 * lugares diferentes, são a mesma fila de conteúdo desenhada por etapa ou por
 * data. Quem queria ver o que sai na terça e quem queria ver o que está parado
 * em aprovação abriam menus diferentes para olhar o mesmo dado — cada um com
 * os filtros do outro invisíveis.
 *
 * **Tirar um menu mexe em sete lugares**, e este arquivo já registra a conta.
 * Aqui o cuidado é o oposto do de Aprovações: a aba **não** foi apagada. Ela
 * continua em `TabType`, nas permissões e em `/calendario` — porque o endereço
 * está em favorito de quem trabalha aqui, e o F5 nele tem de continuar
 * abrindo o calendário.
 */
describe('o calendário é uma visão do WorkFlow, não um menu', () => {
  const app = semComentarios(readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8'));
  const permissoes = semComentarios(
    readFileSync(join(RAIZ, 'src', 'lib', 'permissions.ts'), 'utf-8')
  );
  const rotas = semComentarios(readFileSync(join(RAIZ, 'src', 'lib', 'rotas.ts'), 'utf-8'));

  it('a barra lateral não tem item de Calendário', () => {
    // A lista de menus é a única coisa que some. O resto da fiação fica.
    expect(app, 'o Calendário voltou a ser um item da barra lateral').not.toMatch(
      /\{\s*id:\s*'calendario'\s*,\s*label:/
    );
  });

  it('mas a aba continua existindo, e a URL dela continua respondendo', () => {
    /*
      Apagar a aba quebraria `/calendario` — um endereço que está em favorito.
      É o lado oposto do erro de Aprovações: lá a URL ficou respondendo sem
      menu nenhum; aqui ela responde **de propósito**, e o menu que a acende é
      o WorkFlow.
    */
    expect(app, 'o calendário deixou de ser montado').toMatch(
      /activeTab === 'calendario' && <CalendarApp/
    );
    expect(rotas).toMatch(/calendario: '\/calendario'/);
    expect(permissoes, 'o papel perdeu acesso ao calendário e a URL passa a recusar').toContain(
      "'calendario'"
    );
  });

  it('o WorkFlow fica aceso nas duas visões', () => {
    // Menu apagado com a tela aberta faz a pessoa procurar onde ela está.
    expect(app, 'o item do menu voltou a apagar no calendário').toMatch(
      /item\.id === 'producao' && activeTab === 'calendario'/
    );
  });

  it('as duas telas trazem o alternador', () => {
    // Sem ele numa das duas, a visão vira um beco: dá para entrar e não dá
    // para voltar sem a barra lateral.
    for (const arquivo of [
      join(RAIZ, 'src', 'components', 'kanban', 'KanbanBoard.tsx'),
      join(RAIZ, 'src', 'components', 'calendar', 'CalendarHeader.tsx'),
    ]) {
      expect(semComentarios(readFileSync(arquivo, 'utf-8')), arquivo).toMatch(
        /<AlternarVisaoDoWorkflow/
      );
    }
  });

  it('a troca mexe no activeTab, nunca num estado de visão à parte', () => {
    /*
      Um estado novo de "visão" daria duas verdades para a mesma pergunta: a
      URL diria `/kanban` e a tela mostraria o calendário, ou o contrário. É o
      mesmo raciocínio da faixa de clientes — dois controles, um estado.
    */
    const alternador = semComentarios(
      readFileSync(
        join(RAIZ, 'src', 'components', 'common', 'AlternarVisaoDoWorkflow.tsx'),
        'utf-8'
      )
    );

    expect(alternador, 'o alternador passou a guardar a visão por conta própria').not.toMatch(
      /useState/
    );
    expect(alternador).toMatch(/setActiveTab\(/);
  });
});

/**
 * O recorte do conteúdo é um só, nas cinco telas.
 *
 * O predicado estava escrito **cinco vezes** — no quadro e nas quatro visões
 * do calendário — e já tinha divergido antes de alguém notar: o filtro de
 * formato existia só no quadro, então "o que está marcado para esta semana em
 * Reels?" tinha resposta numa tela e não tinha na outra.
 *
 * **Filtro que diverge esconde conteúdo, e conteúdo escondido não avisa que
 * sumiu.** Quem olha conclui que a peça não existe — que é a classe de falha
 * mais cara deste produto, e a razão de a guarda derivar a lista de telas em
 * vez de nomeá-las: tela nova que filtre conteúdo precisa cair aqui sozinha.
 */
describe('o filtro de conteúdo é o mesmo nas cinco telas', () => {
  const TELAS = [
    join(RAIZ, 'src', 'components', 'kanban', 'KanbanBoard.tsx'),
    ...readdirSync(join(RAIZ, 'src', 'components', 'calendar'))
      .filter((n) => /View\.tsx$/.test(n))
      .map((n) => join(RAIZ, 'src', 'components', 'calendar', n)),
  ];

  it('nenhuma tela escreve o próprio predicado', () => {
    /*
      A guarda mede o **efeito**: a comparação crua com `platformFilter` ou
      `clientFilter` é a assinatura da cópia. Exigir o nome da função deixaria
      passar uma sexta cópia escrita ao lado da chamada.
    */
    for (const arquivo of TELAS) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      if (!/clientFilter|platformFilter/.test(fonte)) continue;

      expect(
        fonte,
        `${arquivo}: voltou a comparar o filtro à mão em vez de usar passaNosFiltros`
      ).not.toMatch(/if \(\s*(?:clientFilter|platformFilter) !== 'all'/);
    }
  });

  it('toda tela que filtra conteúdo chama a função única', () => {
    const comFiltro = TELAS.filter((a) =>
      /clientFilter|platformFilter/.test(semComentarios(readFileSync(a, 'utf-8')))
    );

    // Cinco: o quadro e as quatro visões. Menos que isso significa que uma
    // delas parou de filtrar — e aí ela mostra o que o filtro recortou fora.
    expect(comFiltro.length).toBeGreaterThanOrEqual(5);

    for (const arquivo of comFiltro) {
      expect(semComentarios(readFileSync(arquivo, 'utf-8')), arquivo).toMatch(
        /passaNosFiltros\(/
      );
    }
  });

  it('a barra de filtros é a mesma peça nas duas telas', () => {
    // Duas barras divergem na primeira pressa, e divergir aqui é o bug que
    // esta entrega veio consertar.
    for (const arquivo of [
      join(RAIZ, 'src', 'components', 'kanban', 'KanbanBoard.tsx'),
      join(RAIZ, 'src', 'components', 'calendar', 'CalendarHeader.tsx'),
    ]) {
      expect(semComentarios(readFileSync(arquivo, 'utf-8')), arquivo).toMatch(
        /<BarraDeFiltrosDoConteudo/
      );
    }
  });

  it('tirar a ordenação não levou embora a saída de soltar os fixados', () => {
    /*
      "Soltar todos" morava dentro do menu Ordenar, que saiu da barra — e sair
      levaria junto o **único** caminho de soltar um card fixado. Quem fixou
      uma peça e esqueceu veria o quadro numa ordem que a data não explica,
      concluiria que a ordenação quebrou, e a saída estaria escondida dentro de
      cada card. "Sempre há porta de saída" é regra, e tirar um controle não
      pode levar a única que existe.
    */
    const quadro = semComentarios(
      readFileSync(join(RAIZ, 'src', 'components', 'kanban', 'KanbanBoard.tsx'), 'utf-8')
    );

    expect(quadro, 'a saída para soltar os cards fixados sumiu da tela').toMatch(
      /onClick=\{soltarTodos\}/
    );
  });
});

/**
 * A faixa de clientes: o anel inteiro, em todos.
 *
 * Duas coisas estavam erradas ao mesmo tempo, e uma escondia a outra:
 *
 * - **o anel do selecionado saía cortado no topo.** O `ring` do Tailwind é
 *   `box-shadow`, desenhado **fora** da caixa do elemento; o container da
 *   faixa é `overflow-x-auto`, e pela regra do CSS que este projeto já pagou
 *   uma vez — eixo que deixa de ser `visible` faz o outro virar `auto` — o
 *   recorte vertical estava ligado junto. Os 2px do anel eram aparados, e o
 *   círculo lia como foto mal recortada;
 * - **só o selecionado tinha anel.** Uma foto com contorno no meio de oito sem
 *   lê como "esta está em destaque", não como "esta é a escolhida". Com o
 *   neutro em volta de todas, o que distingue passa a ser a cor.
 */
describe('o anel da faixa de clientes', () => {
  const faixa = ler('ClientesDoQuadro.tsx');

  it('o container que rola deixa espaço para o anel', () => {
    /*
      Guarda de **efeito**: a linha que liga o recorte tem de trazer respiro
      vertical. Sem ele o anel volta a ser aparado, e nada local acusa — `tsc`
      compila, o vitest não monta componente e o `vite build` não mede caixa.
    */
    const linha = faixa.split('\n').find((l) => l.includes('overflow-x-auto'));

    expect(linha, 'a faixa deixou de rolar na horizontal').toBeTruthy();
    expect(linha, 'o container que recorta ficou sem respiro: o anel sai cortado').toMatch(
      /\b(?:py|pt)-[1-9]/
    );
  });

  it('todo item tem anel, e nenhum estado fica sem', () => {
    /*
      A decisão é medida pela **ausência de um ramo vazio**: enquanto o anel
      nascer de um ternário com `''` de um lado, metade da faixa fica sem
      contorno. E os dois ramos têm de ter a mesma espessura — anel que engorda
      ao ser escolhido empurra o vizinho e faz a faixa tremer na troca.
    */
    const inicio = faixa.indexOf('const anel');
    expect(inicio, 'o anel da faixa deixou de sair de um lugar só').toBeGreaterThan(-1);

    const corpo = faixa.slice(inicio, faixa.indexOf(';', inicio));
    expect(corpo, 'o item não selecionado voltou a ficar sem contorno').toMatch(
      /ring-2 ring-slate-/
    );
    expect(corpo, 'o selecionado perdeu a cor que o distingue').toMatch(/ring-2 ring-purple-/);
    expect(corpo, 'o anel voltou a ter um ramo sem contorno nenhum').not.toMatch(/: ''/);

    /* E ele é aplicado nos dois desenhos da faixa — o "Todos", que é um ícone,
       e o avatar do cliente. Um deles de fora deixa um buraco na fileira. */
    expect(faixa.match(/anel\(\s*ativo\s*\)/g)?.length, 'um dos itens ficou sem o anel').toBe(2);
  });
});
