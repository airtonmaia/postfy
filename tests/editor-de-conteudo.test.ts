import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * **Um formulário só, para cadastrar e para editar.**
 *
 * A tela de edição tinha menos campos que a de cadastro, e a diferença não
 * dava erro em lugar nenhum: cliente e canais não dava para trocar, a arte do
 * story não tinha campo, os campos da rede (localização, primeiro comentário,
 * capa do Reel) não existiam, o contador de caracteres não contava e a prévia
 * não abria. Quem criava no desktop e corrigia no celular encontrava metade
 * do que tinha usado meia hora antes — e simplesmente não conseguia corrigir
 * o que preencheu.
 *
 * Duas cópias do mesmo formulário divergem na primeira pressa; é a história
 * das doze alturas de botão, das sete barras de abas e da tabela de formatos.
 * Por isso a guarda central aqui não olha rótulo nem classe: ela afirma que
 * **as duas telas montam o mesmo componente** e que **tudo que o formulário
 * tem, as duas gravam**.
 *
 * A lista de campos é **derivada da interface `DadosDoConteudo`**, não escrita
 * à mão. Lista literal teria de ser editada junto com o código, e editar a
 * guarda junto com o código é como ela deixa de guardar — foi assim que a
 * guarda de `REDES_QUE_PUBLICAM` precisou sair de uma lista literal.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const formulario = ler('src', 'components', 'jobs', 'FormularioDoConteudo.tsx');
const editor = ler('src', 'components', 'modals', 'JobDetailModal.tsx');
const cadastro = ler('src', 'components', 'modals', 'CreateJobModal.tsx');
const formatos = ler('src', 'lib', 'formatos.ts');
const redes = ler('src', 'lib', 'redes.ts');

/**
 * O `{ … }` equilibrado que começa depois de `marca`.
 *
 * Contar chaves em vez de parar no primeiro `}` é o que faz a fatia ser o
 * objeto inteiro: os valores aqui têm objetos e arrow functions dentro, e uma
 * versão que parasse no primeiro fechamento mediria meio payload — o mesmo
 * erro que a guarda de rolagem cometeu ao parar no primeiro `>`.
 */
const objetoDepoisDe = (fonte: string, marca: string): string => {
  const i = fonte.indexOf(marca);
  if (i < 0) return '';
  const abre = fonte.indexOf('{', i + marca.length - 1);
  if (abre < 0) return '';

  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') nivel++;
    else if (fonte[j] === '}') {
      nivel--;
      if (nivel === 0) return fonte.slice(abre, j + 1);
    }
  }
  return '';
};

/** Os campos que o formulário compartilhado possui, lidos da interface. */
const camposDoFormulario = (): string[] => {
  const corpo = objetoDepoisDe(formulario, 'export interface DadosDoConteudo');
  return [...corpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
};

describe('o cadastro e a edição montam o mesmo formulário', () => {
  it('a interface do formulário existe e tem campos', () => {
    // Sem isto a guarda abaixo passaria com uma lista vazia — que é a forma
    // mais silenciosa de uma guarda deixar de guardar.
    expect(camposDoFormulario().length).toBeGreaterThanOrEqual(10);
  });

  for (const [nome, fonte] of [
    ['CreateJobModal', cadastro],
    ['JobDetailModal', editor],
  ] as const) {
    it(`${nome} monta o formulário compartilhado`, () => {
      expect(
        fonte,
        `${nome} voltou a desenhar o próprio formulário — as duas cópias ` +
          `divergem na primeira pressa, e campo que existe num lado só não dá ` +
          `erro em lugar nenhum`
      ).toMatch(/<FormularioDoConteudo/);
    });

    it(`${nome} não tem a própria lista de canais`, () => {
      /**
       * `CANAIS` é a tabela de rede, ícone e cor. Duas cópias fariam a rede
       * nova aparecer num lado só — e a que sumisse do outro deixaria de ser
       * oferecida sem ninguém notar.
       */
      expect(fonte, `${nome} voltou a ter a própria lista de canais`).not.toMatch(
        /const CANAIS(?:\s*:|\s*=)/
      );
    });
  }

  for (const campo of camposDoFormulario()) {
    it(`${campo} é gravado pelas duas telas`, () => {
      /**
       * O cadastro grava em `createJob({…})`; o editor, em `mudancas`. A
       * guarda confere o **caminho da gravação**, não o rótulo: rótulo muda
       * com a redação, o payload só muda se o campo sair.
       */
      const payloadDoCadastro = objetoDepoisDe(cadastro, 'createJob(');
      const payloadDoEditor = objetoDepoisDe(editor, 'const mudancas: Partial<Job> =');

      expect(payloadDoCadastro, 'o payload do cadastro sumiu').not.toBe('');
      expect(payloadDoEditor, 'o payload do editor sumiu').not.toBe('');

      const escreve = new RegExp(`\\b${campo}:`);
      expect(payloadDoCadastro, `${campo} deixou de ser gravado no cadastro`).toMatch(escreve);
      expect(
        payloadDoEditor,
        `${campo} deixou de ser gravado na edição — o campo continua em tela e ` +
          `o "Salvar" não o leva ao banco`
      ).toMatch(escreve);
    });
  }

  it('a edição também grava o que só existe depois de criado', () => {
    // CTA, hashtags e campanha saíram do cadastro de propósito, e continuam
    // editáveis aqui. Sem eles no payload, "Mais opções" seria decoração.
    const payload = objetoDepoisDe(editor, 'const mudancas: Partial<Job> =');
    for (const campo of ['cta', 'hashtags', 'campaign']) {
      expect(payload, `${campo} deixou de ser gravado na edição`).toMatch(
        new RegExp(`\\b${campo}:`)
      );
    }
  });
});

describe('nada é gravado sem alguém confirmar', () => {
  it('mexer num campo não chama o banco', () => {
    /**
     * Salvar a cada tecla — ou no `blur` de cada campo — grava o que a pessoa
     * ainda estava escrevendo quando clicou fora para reler a peça. No
     * conteúdo que vai ao perfil do cliente isso publica um rascunho, e o que
     * sai no perfil do cliente não volta.
     *
     * O formulário é controlado e **não conhece o banco**: quem grava é a
     * tela, num clique.
     */
    expect(
      formulario,
      'o formulário passou a gravar sozinho — mexer num campo virou escrita no banco'
    ).not.toMatch(/updateJob|createJob|supabase/);

    // No editor, o único caminho até o banco é o `salvar()`; o que o
    // formulário devolve cai em `setDados`.
    expect(editor, 'o rascunho do editor deixou de ser estado local').toMatch(
      /const mudar = \(parcial: Partial<RascunhoDoConteudo>\) =>\s*setDados\(/
    );
  });

  it('fechar com alteração pendente pergunta', () => {
    /**
     * `Esc` e clique fora são caminhos de um toque, e o formulário guarda o
     * trabalho de quem acabou de reescrever uma legenda. Fechar calado é a
     * perda silenciosa que a tela não tem como desfazer — e nada local acusa.
     */
    expect(editor, 'o editor voltou a fechar direto').toMatch(
      /onOpenChange=\{\(aberto\) => !aberto && fechar\(\)\}/
    );
    expect(editor, 'a pergunta de sair sem salvar sumiu').toMatch(/Sair sem salvar/);
    // A descrição é obrigatória no diálogo do projeto: "tem certeza?" é a
    // pergunta errada, o que decide é a consequência.
    expect(editor).toMatch(/descricao:/);
  });

  it('salvar está sempre no rodapé, e numa barra só', () => {
    /*
      **A decisão mudou, e a guarda mudou com ela.** Antes a barra de salvar
      aparecia só quando havia mudança, e só na coluna da esquerda — e no
      celular quem a mostrava era o assistente. Eram dois lugares para a mesma
      pergunta, e nenhum deles estava à vista o tempo todo.

      Agora o rodapé é um só, fixo, atravessando as duas colunas e existindo em
      toda largura: dá para salvar em qualquer passo e em qualquer aba, que é o
      que se pediu. O que a guarda afirma é isso — **um** rodapé, **um** botão
      de salvar, e o assistente sem barra própria.
    */
    /*
      A âncora é **código**, não um comentário: `ler` remove os comentários
      antes de medir, e uma guarda ancorada num deles recebe -1 do `indexOf`,
      fatia o arquivo ao contrário e passa a afirmar sobre o lugar errado — sem
      falhar. Já aconteceu aqui com a fatia de `setIsWhatsAppOpen(true)`.

      O que prova que o rodapé está fora da área que rola é a **posição**: ele
      vem depois do `</aside>` que fecha a coluna da direita, portanto fora do
      `flex-1 min-h-0 overflow-y-auto` que embrulha as duas colunas.
    */
    const depoisDasColunas = editor.slice(editor.indexOf('</aside>'));
    const rodape = depoisDasColunas.slice(0, depoisDasColunas.indexOf('</DialogContent>'));
    expect(rodape, 'o rodapé voltou para dentro da área que rola').toMatch(
      /shrink-0 border-t/
    );
    expect(rodape, 'o salvar saiu do rodapé fixo').toMatch(/Salvar/);

    /*
      Um "Salvar alterações" só. Dois — um no rodapé e um no assistente, como
      havia — fariam um ganhar o estado de "salvando" que o outro não tem, e a
      pessoa clicaria num botão que não responde.
    */
    expect(
      (editor.match(/Salvar alterações/g) ?? []).length,
      'os botões de salvar viraram duas cópias'
    ).toBe(1);
    expect(editor, 'o assistente voltou a ter barra de ações própria').not.toMatch(
      /acoes=\{/
    );

    /*
      E ele é **desligado sem mudança**, nunca escondido: botão que some é
      botão que a pessoa procura. Gravar sem mudança carimbaria `updated_at` à
      toa, e o rodapé passaria a dizer "há menos de 1m" sobre uma alteração que
      não houve.
    */
    expect(editor, 'o salvar voltou a gravar sem haver mudança').toMatch(
      /disabled=\{salvando \|\| !sujo\}/
    );
    expect(editor, 'a marca de alteração pendente sumiu do rodapé').toMatch(
      /\{sujo \? \(/
    );
  });

  it('o texto vindo da IA cai no rascunho, não no banco', () => {
    // É uma sugestão. Gravá-la direto publicaria um texto que ninguém leu.
    const bloco = editor.slice(editor.indexOf('onApplyCopy='));
    expect(bloco.slice(0, 300), 'a copy da IA voltou a ser gravada direto').toMatch(
      /mudar\(\{/
    );
  });
});

describe('a data editada é a do fuso da agência', () => {
  it('o editor converte nos dois sentidos', () => {
    /**
     * `datetime-local` interpreta no fuso do **navegador**. Sem a conversão,
     * um membro da equipe em outro estado agendaria uma hora diferente da do
     * colega, no mesmo post, sem nada avisar — armadilha 8.2, e o pior sintoma
     * dela: horário errado com cara de certo.
     */
    expect(editor, 'a data voltou a ser lida no fuso do aparelho').toMatch(
      /deUtcParaParede\(new Date\(job\.scheduledDate\)\)/
    );
    expect(editor, 'o prazo voltou a ser lido no fuso do aparelho').toMatch(
      /deUtcParaParede\(new Date\(job\.deadlineApproval\)\)/
    );
    expect(editor, 'a data voltou a ser gravada no fuso do aparelho').toMatch(
      /deParedeParaUtc\(parede\)/
    );
  });

  it('campo esvaziado não vira uma data', () => {
    /**
     * `new Date('')` é `Invalid Date`, mas `deParedeParaUtc('')` montaria o
     * texto `':00Z'` — e **isso o V8 aceita, devolvendo 1º de janeiro de
     * 2000**. Um agendamento em 2000 já está vencido: o cron publicaria na
     * primeira passada.
     */
    expect(editor, 'o campo de data esvaziado voltou a produzir uma data').toMatch(
      /if \(!parede\) return undefined;/
    );
    expect(editor).toMatch(/isNaN\(d\.getTime\(\)\) \? undefined/);
  });
});

describe('a tabela de formatos por rede mora num lugar só', () => {
  it('o formulário lê a tabela compartilhada', () => {
    /**
     * Era um `const` dentro de `CreateJobModal.tsx`. Uma segunda cópia
     * divergiria na primeira vez que alguém acrescentasse um formato num lado
     * só — e a rede que ganhasse "Feed + Story" sem publicador voltaria a
     * descartar a arte do story em silêncio, com a fila dizendo "publicado".
     */
    expect(formatos, 'a tabela sumiu de src/lib/formatos.ts').toMatch(
      /export const FORMATOS_POR_CANAL/
    );
    for (const [nome, fonte] of [
      ['FormularioDoConteudo', formulario],
      ['CreateJobModal', cadastro],
      ['JobDetailModal', editor],
    ] as const) {
      expect(fonte, `${nome} voltou a ter a própria cópia da tabela`).not.toMatch(
        /const FORMATOS_POR_CANAL/
      );
    }
    expect(formulario, 'o formulário deixou de ler a tabela compartilhada').toMatch(
      /from '\.\.\/\.\.\/lib\/formatos'/
    );
  });

  it('o seletor oferece só os formatos das redes da peça', () => {
    // Oferecer a lista inteira deixaria escolher "Story" no YouTube, que não
    // existe lá — e o erro só apareceria na hora de publicar.
    expect(formulario, 'o seletor de formato voltou a oferecer a lista inteira').toMatch(
      /formatosComuns\(canais\)/
    );
  });

  it('trocar de canal reaproveita um formato válido', () => {
    // Sem isto o `select` ficava em branco e a peça era salva com um formato
    // que aquela rede não aceita, sem ninguém ver.
    expect(formulario, 'o formato deixou de ser revalidado ao trocar de canal').toMatch(
      /!formatosDoCanal\.some\(\(f\) => f\.valor === format\)/
    );
  });
});

describe('publicar agora diz o que saiu, e o que não saiu', () => {
  it('o aviso do story chega à tela', () => {
    /**
     * `api/publicar.ts` já devolvia `aviso` — o caso em que o feed saiu e o
     * story não — e **ninguém lia**. A rota fecha o item como publicado, com o
     * motivo em `last_error`, porque marcar `falhou` republicaria o feed na
     * passada seguinte. Sem o campo na tela, "Publicado em @conta" afirmava
     * duas saídas onde houve uma.
     *
     * **A guarda saiu da forma.** Ela exigia o ternário `aviso ? { ok: false`
     * dentro do editor, e reprovou quando o texto da publicação mudou de casa
     * — a mesma lição das cinco guardas ancoradas em `CreateJobModal`. O que
     * ela protege é a decisão: o aviso existe no resultado e chega à frase.
     * Onde a frase é montada é detalhe, e `textoDaPublicacao` é um lugar só
     * para as duas telas, pela razão de sempre.
     */
    expect(redes, 'o aviso do story sumiu do resultado da publicação').toMatch(
      /aviso\?: string/
    );
    expect(redes, 'o texto da publicação parou de repassar o aviso do story').toMatch(
      /if \(p\.aviso\) partes\.push\(p\.aviso\)/
    );
    expect(editor, 'o editor voltou a montar o texto da publicação sozinho').toMatch(
      /textoDaPublicacao\(/
    );
  });

  it('a resposta aparece em linha, não em diálogo', () => {
    /**
     * `useAviso` é para **falha que interrompe**. "Publicado em @conta" não é:
     * confirmação de que deu certo não merece uma caixa que precisa ser
     * fechada. E o erro em linha continua legível enquanto a pessoa relê a
     * peça — num diálogo ele some ao ser dispensado, que é quando ela precisa
     * dele.
     */
    expect(editor, 'a publicação voltou a responder por diálogo').not.toMatch(
      /avisar\(\{\s*titulo: 'Publicado'/
    );
    expect(editor, 'o resultado da publicação sumiu da tela').toMatch(/\{resultado && \(/);
  });

  it('o editor também põe na fila de verdade', () => {
    /**
     * `agendarPublicacao` só era chamada pelo cadastro. Uma peça reagendada
     * depois de criada mudava de data na tela e **nunca voltava para a
     * `publish_queue`** — o card ficava em "Agendado", a data passava e nada
     * publicava. É a mesma armadilha que já custou caro, só que um passo
     * adiante no fluxo.
     */
    expect(editor, 'o editor voltou a agendar sem produzir a fila').toMatch(
      /agendarPublicacao\(/
    );
  });
});

/**
 * O espaço da tela de conteúdo: o que fica à vista e o que fica a um clique.
 *
 * A tela mostrava tudo ao mesmo tempo — formulário, arte, legenda e uma
 * moldura de celular com a prévia ocupando o topo da coluna da direita. O
 * efeito não é "informação completa", é ninguém achar nada: as ações de
 * workflow e os dados da peça ficavam fora da dobra num notebook.
 */
describe('o que ocupa a tela do conteúdo', () => {
  const cadastro = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'modals', 'CreateJobModal.tsx'), 'utf-8')
  );
  const editor = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'modals', 'JobDetailModal.tsx'), 'utf-8')
  );
  const formulario = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'jobs', 'FormularioDoConteudo.tsx'), 'utf-8')
  );

  it('a prévia nasce fechada nas duas telas', () => {
    /*
      Guarda de **efeito**, não de forma: as duas telas guardam o estado
      começando em `false`, e nenhuma delas força a prévia aberta por
      breakpoint. O `lg:flex` que existia no cadastro é exatamente isso —
      estado fechado, prévia à mostra mesmo assim.
    */
    for (const [nome, fonte] of [
      ['CreateJobModal', cadastro],
      ['JobDetailModal', editor],
    ] as const) {
      /*
        A alternativa frouxa aqui era `|useState(false)`, que casa com
        **qualquer** estado booleano do arquivo — e há vários. Guarda que
        aceita o vizinho no lugar do alvo não guarda.
      */
      expect(fonte, `${nome} deixou de abrir a peça com a prévia fechada`).toMatch(
        /\[previaAberta, setPreviaAberta\] = useState\(false\)/
      );
      expect(
        fonte,
        `${nome} voltou a forçar a prévia aberta no desktop: o botão deixa de valer`
      ).not.toMatch(/previaAberta[\s\S]{0,80}lg:flex/);
    }
  });

  it('o botão diz qual dos dois estados ele leva', () => {
    // "Prévia" sozinho não distingue abrir de fechar, e um gatilho que não
    // muda de texto faz a pessoa clicar duas vezes para descobrir.
    for (const fonte of [cadastro, editor]) {
      expect(fonte).toMatch(/'Ocultar prévia'/);
      expect(fonte).toMatch(/Ver prévia/);
    }
  });

  it('a arte e o texto dividem a linha, e só quando há arte', () => {
    /*
      Empilhados, a legenda ficava uma tela inteira abaixo da arte — e escrever
      legenda olhando para a imagem é o caso normal. Sem arte (copy, roteiro) o
      texto ocupa a largura inteira: metade da tela vazia ao lado de um campo
      de texto é pior que o campo largo.
    */
    expect(
      formulario,
      'a arte e o texto voltaram a ser empilhados em qualquer largura'
    ).toMatch(/tipo\.pedeArte && arte && texto \?[\s\S]{0,80}lg:grid-cols-\d/);
  });
});

/**
 * O formulário é um só, montado duas vezes com recortes diferentes.
 *
 * A tela de conteúdo partiu os campos em duas colunas — arte e texto de um
 * lado; cliente, canais, título, formato, responsáveis, prioridade e datas do
 * outro. A saída fácil seria escrever os campos de gestão direto na coluna da
 * direita, e aí haveria **duas** definições do mesmo formulário: é a história
 * das doze alturas de botão, da tabela de formatos e das sete barras de abas.
 */
describe('as duas colunas saem do mesmo formulário', () => {
  const formulario = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'jobs', 'FormularioDoConteudo.tsx'), 'utf-8')
  );
  const editor = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'modals', 'JobDetailModal.tsx'), 'utf-8')
  );

  it('a tela monta as duas metades do mesmo componente', () => {
    expect(editor, 'a coluna da peça deixou de usar o formulário compartilhado').toMatch(
      /blocos=\{\['arte', 'texto'\]\}/
    );
    expect(editor, 'a coluna de gestão deixou de usar o formulário compartilhado').toMatch(
      /blocos=\{\['identificacao', 'agenda'\]\}/
    );

    /*
      **Toda montagem declara o recorte dela**, e é isso que a guarda mede — e
      não um número de montagens, que muda a cada arranjo novo de tela (foram
      duas, viraram três quando o celular ganhou o assistente).

      Uma montagem sem `blocos` desenharia o formulário **inteiro** no meio de
      uma coluna que já mostra metade dele: os mesmos campos duas vezes na
      mesma tela, e a pessoa editando um deles sem saber qual vale.
    */
    const usos = (editor.match(/<FormularioDoConteudo/g) ?? []).length;
    const recortes = (editor.match(/\bblocos=\{/g) ?? []).length;

    expect(usos, 'o formulário sumiu da tela de conteúdo').toBeGreaterThan(1);
    expect(recortes, 'uma montagem do formulário ficou sem dizer qual recorte desenha').toBe(
      usos
    );
  });

  it('o efeito que revalida o formato roda numa metade só', () => {
    /*
      Com duas montagens, um efeito sem recorte roda duas vezes. **Aqui as duas
      chamadas gravariam o mesmo valor** — inofensivo por coincidência, e é
      assim que um efeito duplicado passa a ser aceito num lugar onde ele não
      é. A saída antecipada vem antes da condição, na metade que tem o campo.
    */
    const i = formulario.indexOf('formatosDoCanal.some');
    expect(i, 'o efeito que revalida o formato sumiu').toBeGreaterThan(-1);

    const acima = formulario.slice(Math.max(0, i - 300), i);
    expect(acima, 'o efeito do formato voltou a rodar nas duas montagens').toMatch(
      /if \(!gestao\) return;/
    );
  });

  it('recolhida, a trilha continua dizendo a etapa', () => {
    /*
      **A guarda antiga exigia que ela nascesse aberta**, e o argumento era que
      quem nunca a vê não descobre que ela existe. Ele valia enquanto recolhida
      ela sumia por inteiro, deixando um botão "Ver fluxo" sozinho.

      Agora ela nasce recolhida e a faixa recolhida **informa**: a etapa atual e
      há quanto tempo a peça está nela. O que a guarda protege é isto — não o
      estado inicial, mas que o estado recolhido não volte a ser um controle
      mudo.
    */
    const trilha = ler('src', 'components', 'jobs', 'TrilhaDeEtapas.tsx');

    const recolhida = trilha.slice(trilha.indexOf('if (!aberta)'));
    expect(recolhida, 'a trilha deixou de ter estado recolhido').not.toBe(trilha);
    expect(recolhida, 'a faixa recolhida parou de dizer a etapa').toMatch(/Etapa:/);
    expect(recolhida, 'a faixa recolhida ficou sem como abrir o fluxo').toMatch(
      /Ver fluxo completo/
    );

    /*
      E o tempo na etapa sai do **histórico**, nunca de `updated_at`: aquela
      coluna é a última edição de qualquer campo, inclusive de uma vírgula na
      legenda — ela diria "há 2m nesta etapa" de uma peça parada há uma semana.
      Sem linha no histórico, nenhum número: a tela não afirma o que não mediu.
    */
    expect(trilha, 'o tempo na etapa passou a sair de updated_at').not.toMatch(
      /updatedAt/
    );
    expect(trilha, 'o tempo na etapa deixou de depender do histórico').toMatch(
      /tempoNaEtapa = entradaNaEtapa \? /
    );
    expect(trilha, 'o botão não diz mais para onde o clique leva').toMatch(
      /'Ocultar fluxo'|Ocultar fluxo/
    );
  });
});

/**
 * Lista montada na hora não pode ler uma `const` declarada mais abaixo.
 *
 * `passosDoConteudo` é um **array**, construído no corpo do componente: ele
 * chama o montador de campos na hora, e o montador lê `gerarTextoComIA`. Com a
 * declaração dele mais abaixo, a leitura cai na zona morta temporal e a tela
 * inteira cai com `Cannot access 'gerarTextoComIA' before initialization`.
 *
 * **Nada local acusa, e é por isso que esta guarda existe.** O `tsc` não vê
 * através da chamada: para ele `camposDoPasso` é uma função, e funções podem
 * ler o que quiserem — só que esta é *chamada* antes. O vitest não monta
 * componente e o `vite build` compila feliz. É a armadilha 0 outra vez, e desta
 * vez ela chegou a produção: a tela do quadro abriu em branco.
 *
 * A guarda compara **posições**, que é a única forma possível para uma regra
 * que só se manifesta em tempo de execução — a mesma de
 * `equipe-e-transferencia`, que compara a ordem dos dois `update`.
 */
describe('a ordem de declaração dentro das telas de conteúdo', () => {
  for (const nome of ['CreateJobModal', 'JobDetailModal']) {
    it(`${nome}: os passos são montados depois do que eles leem`, () => {
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', 'modals', `${nome}.tsx`), 'utf-8')
      );

      const passos = fonte.indexOf('const passosDoConteudo');
      expect(passos, `${nome} não monta mais os passos do celular`).toBeGreaterThan(-1);

      /*
        Toda `const` que o montador de campos lê precisa estar **acima** da
        linha que monta a lista. A lista é derivada da própria chamada: o que
        for passado ao formulário entra aqui sem ninguém editar a guarda.
      */
      const montador = fonte.slice(
        fonte.lastIndexOf('const ', fonte.indexOf('<FormularioDoConteudo')),
        passos
      );
      const lidos = [...montador.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

      for (const nomeLido of new Set(lidos)) {
        const declaracao = fonte.indexOf(`const ${nomeLido}`);
        if (declaracao < 0) continue; // vem das props ou do contexto
        expect(
          declaracao,
          `${nome}: "${nomeLido}" é declarado depois dos passos, e lê-lo ali derruba a tela`
        ).toBeLessThan(passos);
      }
    });
  }
});

/**
 * **O rodapé de ações, e as duas coisas que ele veio juntar.**
 *
 * A tela tinha dois lugares para a mesma pergunta — *e agora, o que eu faço
 * com esta peça?* A barra de salvar aparecia só quando havia mudança, só na
 * coluna da esquerda, e no celular ela era do assistente; as ações de workflow
 * eram quatro botões empilhados na coluna da direita, abaixo da prévia e da
 * gestão, portanto fora da dobra num notebook. Nenhum dos dois estava à vista
 * o tempo todo, que é a única coisa que um botão de salvar precisa ser.
 */
describe('o rodapé de ações da tela de conteúdo', () => {
  it('o aviso do canal mora no mesmo menu que agendar e publicar', () => {
    /*
      **A conferência vale onde ainda dá para agir.** Este aviso já saiu de
      `textoDoAgendamento` uma vez, por dizer *depois* do clique que o cliente
      não tem conta conectada — a peça entrava como agendada e no dia ninguém
      publicava. Agora o risco é geográfico: com a ação no rodapé e o aviso na
      coluna da direita, no celular ele ficaria **abaixo** do botão que ele
      existe para qualificar.

      A guarda mede a distância entre os dois no arquivo, que é o que
      "no mesmo menu" significa aqui.
    */
    const apartirDoGatilho = editor.slice(editor.indexOf('Outras ações da peça'));
    expect(apartirDoGatilho, 'o menu das ações sumiu do rodapé').not.toBe(editor);

    const menu = apartirDoGatilho.slice(
      apartirDoGatilho.indexOf('<DropdownMenuContent'),
      apartirDoGatilho.indexOf('</DropdownMenuContent>')
    );

    expect(menu, 'o agendar saiu do menu do rodapé').toMatch(/Agendar publicação/);
    expect(
      menu,
      'o aviso do canal voltou a morar longe do botão que ele qualifica'
    ).toMatch(/avisosDosCanais\(/);
  });

  it('a etapa é um seletor só, montado em um lugar de cada vez', () => {
    /*
      Ele saiu do cabeçalho para a Gestão, onde moram os outros campos da peça
      — e **continua no cabeçalho no celular**, porque ali a Gestão vira um
      passo do assistente, atrás de um toque.

      Escrever o `<select>` duas vezes é a história das doze alturas de botão
      com um agravante: as sete opções são a lista fechada que o `check` do
      banco também guarda, e uma cópia perde a etapa nova em silêncio. Por isso
      ele é **uma** constante, montada por `estreita`.
    */
    expect(
      (editor.match(/<option value="ideas">/g) ?? []).length,
      'o seletor de etapa virou duas cópias'
    ).toBe(1);
    expect(editor, 'o seletor de etapa deixou de ser peça única').toMatch(
      /const seletorDeEtapa = \(/
    );
    expect(editor, 'o celular ficou sem o seletor de etapa no cabeçalho').toMatch(
      /\{estreita && <div[^>]*>\{seletorDeEtapa\}/
    );
  });

  it('o checklist e as horas saíram, e nada mais escreve neles', () => {
    /*
      As duas eram seções recolhíveis da peça, e eram processo interno
      disputando a tela com a peça. Tirar a tela e deixar quem escreve é a
      família do `trial_ends_at`: o "Gerar checklist técnico com IA" gravaria
      uma lista que nenhuma parte do produto mostra, com um giro de
      carregamento por cima — e o apontamento de horas somaria minutos que
      ninguém lê.

      Por isso a guarda mede o **efeito** nos dois sentidos: a tela sumiu e o
      escritor sumiu junto.
    */
    const semPainel = () => {
      try {
        readFileSync(join(RAIZ, 'src', 'components', 'jobs', 'PainelDeTimesheet.tsx'));
        return false;
      } catch {
        return true;
      }
    };
    expect(semPainel(), 'o painel de horas voltou sem tela que o abra').toBe(true);

    const contexto = ler('src', 'context', 'PostfyContext.tsx');
    for (const escritor of ['addTimesheetLog', 'toggleChecklistItem', 'convertFeedbackToTasks']) {
      expect(
        contexto,
        `${escritor} voltou ao contexto sem nenhuma tela que mostre o que ele grava`
      ).not.toMatch(new RegExp(`const ${escritor}`));
    }

    expect(editor, 'o checklist voltou à tela de conteúdo').not.toMatch(
      /Checklist de produção/
    );
    expect(editor, 'as horas voltaram à tela de conteúdo').not.toMatch(
      /Horas neste conteúdo/
    );
  });
});

/**
 * **A arte única é a peça, não um item de lista.**
 *
 * A fileira de miniaturas de 128px existe para uma coisa: dizer a ordem das
 * páginas do carrossel. Numa peça de foto só não há ordem — e a arte, que é o
 * assunto da tela, aparecia do tamanho de um ícone encostada à esquerda de uma
 * coluna larga.
 */
describe('a área de mídia muda com a quantidade de arte', () => {
  const uploader = ler('src', 'components', 'common', 'MediaUploader.tsx');

  it('quem decide é a contagem, não o campo Formato', () => {
    /*
      Neste produto o segundo item de `media_urls` **é** a página 2 do
      carrossel — é a razão de a arte do story ter coluna própria. Perguntar ao
      formato daria duas respostas no dia em que alguém marcasse "Carrossel"
      com uma imagem só, e a tela voltaria a mostrar a miniatura de 128px numa
      peça que tem uma arte.
    */
    expect(uploader, 'a arte única deixou de ter desenho próprio').toMatch(
      /const unica = mediaUrls\.length === 1;/
    );
    expect(uploader, 'o desenho da mídia passou a depender do formato da peça').not.toMatch(
      /unica[\s\S]{0,80}format/
    );
  });

  it('com uma arte ela cresce, e o que é do carrossel some', () => {
    /*
      O número é a página e os dois botões reordenam: com uma arte só, o "1" não
      numera nada e os dois nascem desligados — controle explicando que não
      serve para nada.
    */
    expect(uploader, 'a arte única voltou ao tamanho de miniatura').toMatch(
      /unica \? 'w-full' : 'w-32 shrink-0 aspect-\[4\/5\]'/
    );
    expect(uploader, 'o número da página voltou a aparecer na arte única').toMatch(
      /\{!unica && \([\s\S]{0,200}\{idx \+ 1\}/
    );
    expect(uploader, 'os botões de reordenar voltaram a aparecer na arte única').toMatch(
      /\{!unica && \([\s\S]{0,400}handleMoveLeft/
    );

    /*
      E a arte cresce **sem proporção declarada**: `aspect-[4/5]` com teto de
      altura não dá proporção nenhuma (os dois se anulam e o `object-cover`
      recorta), e recortar aqui mostraria à pessoa um enquadramento que não é o
      que ela subiu. Quem responde pelo enquadramento do feed é a Prévia.
    */
    expect(uploader, 'a arte única voltou a ser recortada na área de edição').toMatch(
      /unica \? 'w-full h-auto max-h-\[26rem\] object-contain'/
    );
  });
});

/**
 * **Um editor por valor, e o título já foi os dois.**
 *
 * Ele era editável no cabeçalho; virou leitura quando o campo "Título do
 * conteúdo" entrou na coluna de gestão. O que não pode é ser os dois ao mesmo
 * tempo — dois campos para o mesmo valor na mesma tela deixam a pergunta de
 * qual deles vale, e a pessoa edita um e conclui que o outro não salvou.
 */
describe('o título do conteúdo tem um editor só', () => {
  it('na tela de conteúdo ele é o do cabeçalho', () => {
    expect(editor, 'o título do cabeçalho voltou a ser só leitura').toMatch(
      /onChange=\{\(e\) => mudar\(\{ title: e\.target\.value \}\)\}/
    );

    /*
      **A guarda é derivada do recorte, não da contagem de montagens.** O campo
      Título mora no bloco `identificacao`: quem monta esse bloco precisa do
      `semTitulo`, e quem monta só arte e texto não tem o campo para esconder.
      Uma montagem nova que traga a identificação sem o recorte devolve o
      segundo editor do título sem ninguém notar.
    */
    const comIdentificacao = [...editor.matchAll(/blocos=\{([^}]*)\}([\s\S]{0,60})/g)].filter(
      ([, valor]) => valor === 'blocos' || valor.includes('identificacao')
    );
    expect(
      comIdentificacao.length,
      'a tela de conteúdo não monta mais o bloco de identificação'
    ).toBeGreaterThan(0);
    for (const [, valor, depois] of comIdentificacao) {
      expect(
        depois,
        `a montagem com blocos={${valor}} voltou a trazer o campo Título, que já existe no cabeçalho`
      ).toMatch(/semTitulo/);
    }
  });

  it('no cadastro ele continua sendo o campo do formulário', () => {
    /*
      Lá não há cabeçalho com a peça: esconder o campo faria a peça nascer sem
      nome, e o título é obrigatório.
    */
    expect(cadastro, 'o cadastro passou a esconder o título e a peça nasce sem nome').not.toMatch(
      /semTitulo/
    );
    expect(formulario, 'o campo Título sumiu do formulário').toMatch(/Título do conteúdo \*/);
  });
});

/**
 * **Versão, criação e última alteração são metadado, e metadado é histórico.**
 *
 * Elas eram o cartão "Sobre a peça", no fim da coluna que mais disputa espaço
 * com a arte. A pergunta que respondem é a mesma do painel de histórico — *o
 * que aconteceu com esta peça, e quando?* —, e em dois lugares quem queria
 * saber "quando isto foi criado" procurava nos dois.
 */
describe('o que a tela sabe e não se edita mora no histórico', () => {
  const historico = ler('src', 'components', 'jobs', 'HistoricoDeEtapas.tsx');

  it('as três datas saíram da coluna da direita', () => {
    for (const campo of ['Versão atual', 'Criado em', 'Última atualização']) {
      expect(historico, `"${campo}" não chegou ao histórico`).toContain(campo);
      expect(editor, `"${campo}" voltou para a coluna da direita`).not.toContain(campo);
    }
  });

  it('a última alteração cai para a criação quando a peça nunca mudou', () => {
    /*
      `updated_at` é carimbada por gatilho do banco e é nula no acervo anterior
      a ela. Campo vazio ali faz parecer que a leitura falhou.
    */
    expect(historico, 'a última alteração voltou a poder aparecer vazia').toMatch(
      /job\.updatedAt \|\| job\.createdAt/
    );
  });
});
