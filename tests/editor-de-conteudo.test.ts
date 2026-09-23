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

  it('a barra de salvar só aparece quando há o que salvar', () => {
    // Um botão de salvar sempre aceso não diz nada; um que aparece é o próprio
    // aviso de que existe trabalho não gravado.
    expect(editor, 'a marca de alteração pendente sumiu').toMatch(/\{sujo && \(/);
    expect(editor).toMatch(/Salvar alterações/);
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
