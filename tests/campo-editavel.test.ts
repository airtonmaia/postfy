import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * A tela de detalhe do conteúdo **mostrava tudo e não editava nada**.
 *
 * Para corrigir uma vírgula na legenda era preciso abrir outra tela; para
 * trocar o formato de uma peça, o mesmo. O que o documento pediu foi editar
 * onde se lê — e isso vale para tudo que o cadastro insere, não só para a
 * legenda.
 *
 * O que estas guardas protegem não quebra nada visível quando é violado, que é
 * a definição do que merece guarda aqui:
 *
 * - **Salvar no `blur` publica o rascunho de quem só clicou fora.** O campo
 *   fica aberto até alguém confirmar, e nenhum teste de tipo pega isso.
 * - **Um campo que só aparece com valor não pode ser preenchido.** CTA,
 *   hashtags e primeiro comentário eram `{campo && (...)}`: vazios, sumiam — a
 *   tela informava a falta e mandava procurar outra tela para resolvê-la.
 * - **Duas tabelas de formato divergem na primeira pressa.** A de rede por
 *   formato agora é editada em dois lugares, e uma cópia que ganhasse "Feed +
 *   Story" no Facebook voltaria a prometer meia publicação.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const campo = ler('src', 'components', 'common', 'CampoEditavel.tsx');
const selo = ler('src', 'components', 'common', 'SeloEditavel.tsx');
const modal = ler('src', 'components', 'modals', 'JobDetailModal.tsx');
const cadastro = ler('src', 'components', 'modals', 'CreateJobModal.tsx');
const formatos = ler('src', 'lib', 'formatos.ts');
const redes = ler('src', 'lib', 'redes.ts');

describe('nada é gravado sem alguém confirmar', () => {
  it('sair do campo não salva', () => {
    /**
     * `onBlur={salvar}` é a forma mais curta de fazer o campo "funcionar", e
     * ela grava o que a pessoa ainda estava escrevendo quando clicou fora para
     * reler a peça. No conteúdo que vai ao perfil do cliente, isso publica um
     * rascunho.
     */
    expect(campo, 'o campo voltou a salvar no blur').not.toMatch(/onBlur=\{?\s*salvar/);
    expect(campo, 'o campo voltou a salvar no blur').not.toMatch(/onBlur=\{\(\)\s*=>\s*salvar/);
  });

  it('Esc devolve o valor original', () => {
    // Sem saída, um clique errado vira uma edição que a pessoa não sabe
    // desfazer — e o valor de antes já não está em tela para ser redigitado.
    expect(campo, 'o Esc deixou de cancelar').toMatch(/e\.key === 'Escape'/);
    expect(campo, 'cancelar deixou de repor o valor').toMatch(
      /const cancelar = \(\) => \{\s*setRascunho\(valor\);/
    );
  });

  it('o valor que muda por fora repõe o rascunho', () => {
    /**
     * `useState(valor)` é lido só na primeira renderização. Sem o efeito, o
     * campo ficaria com o texto de quando montou depois de a peça ser salva
     * noutro lugar — a mesma armadilha 8.1 do `WhatsAppShareModal`, que
     * quebrava "compartilhar no WhatsApp" desde que foi escrito.
     */
    expect(campo, 'o campo voltou a prender o valor da primeira renderização').toMatch(
      /useEffect\(\(\) => \{\s*if \(!editando\) setRascunho\(valor\);\s*\}, \[valor, editando\]\)/
    );
  });

  it('o valor em leitura é um botão de verdade', () => {
    // `<div onClick>` não recebe foco, não responde ao Enter e não é anunciado
    // como clicável. Aqui o alvo do clique é o conteúdo inteiro do campo.
    //
    // A fatia vai do fim do modo de edição até o começo do `DataEditavel`, que
    // é o segundo componente do arquivo: a primeira versão usou
    // `lastIndexOf('return (')` e caiu dentro dele — e aí media o componente
    // errado, que por acaso também tem um `<button>`. Guarda ancorada em "o
    // último que aparece" mede o que o arquivo tiver, não o que ela quer.
    const leitura = campo.slice(
      campo.indexOf('setEditando(true)') - 600,
      campo.indexOf('export const DataEditavel')
    );
    expect(leitura, 'o valor em leitura virou div com onClick').toMatch(/<button\b/);
    expect(leitura).toMatch(/type="button"/);
  });
});

describe('a data editada é a do fuso da agência', () => {
  it('o campo converte nos dois sentidos', () => {
    /**
     * `datetime-local` interpreta no fuso do **navegador**. Sem a conversão, um
     * membro da equipe em outro estado agendaria uma hora diferente da do
     * colega, no mesmo post, sem nada avisar — armadilha 8.2, e o pior sintoma
     * dela: horário errado com cara de certo.
     */
    expect(campo, 'a data voltou a ser lida no fuso do aparelho').toMatch(
      /value=\{deUtcParaParede\(rascunho\)\}/
    );
    expect(campo, 'a data voltou a ser gravada no fuso do aparelho').toMatch(
      /deParedeParaUtc\(parede\)\.toISOString\(\)/
    );
  });

  it('campo esvaziado não vira uma data', () => {
    /**
     * `new Date('')` é `Invalid Date`, mas `deParedeParaUtc('')` montaria o
     * texto `':00Z'` — e **isso o V8 aceita, devolvendo 1º de janeiro de
     * 2000**. Um agendamento em 2000 já está vencido: o cron publicaria na
     * primeira passada.
     */
    expect(campo, 'o campo de data esvaziado voltou a produzir uma data').toMatch(
      /parede \? deParedeParaUtc\(parede\)\.toISOString\(\) : ''/
    );
  });
});

describe('tudo que o cadastro insere, a tela de detalhe edita', () => {
  /**
   * O pedido do documento é literal: "nessa tela precisamos ter a possibilidade
   * de alterar tudo o que foi inserido na tela de cadastro".
   *
   * A guarda confere o caminho da gravação, e não o texto do rótulo: rótulo
   * muda com a redação, `updateJob(selectedJob.id, { campo: ... })` só muda se
   * a edição sair.
   */
  const CAMPOS = [
    'title',
    'caption',
    'draft',
    'cta',
    'hashtags',
    'firstComment',
    'scheduledDate',
    'deadlineApproval',
    'format',
    'priority',
    'mediaUrls',
  ];

  for (const nome of CAMPOS) {
    it(`${nome} é editável`, () => {
      expect(
        modal,
        `${nome} deixou de ser editável na modal de detalhe — voltou a exigir ` +
          `outra tela para corrigir`
      ).toMatch(new RegExp(`\\{\\s*${nome}:`));
    });
  }

  it('CTA, hashtags e primeiro comentário aparecem mesmo vazios', () => {
    /**
     * Eram `{selectedJob.cta && (...)}`. Vazios, sumiam da tela — e **o que
     * some não pode ser preenchido**. É a mesma classe da frase "nenhuma
     * imagem cadastrada nesta versão": informar a falta e mandar procurar
     * outra tela para resolvê-la.
     */
    for (const oculto of [
      /\{selectedJob\.cta && \(/,
      /\{selectedJob\.firstComment && \(/,
      /\{selectedJob\.hashtags && selectedJob\.hashtags\.length > 0 && \(/,
    ]) {
      expect(
        modal.match(oculto)?.[0] ?? null,
        'o campo voltou a sumir quando está vazio, e campo que some não pode ser preenchido'
      ).toBeNull();
    }
  });

  it('a rede continua de leitura', () => {
    /**
     * Trocar a rede muda o que a peça **pode ser**: o formato, o limite de
     * texto, os campos do canal — e pode deixar uma arte 9:16 num feed 4:5.
     * Um clique no cabeçalho não é o lugar dessa decisão, e oferecê-la ali
     * deixaria a peça num estado que o publicador recusa.
     */
    expect(modal, 'a rede virou editável no cabeçalho').not.toMatch(
      /\{\s*platform:\s*/
    );
  });
});

describe('a tabela de formatos por rede mora num lugar só', () => {
  it('o cadastro e o detalhe leem a mesma', () => {
    /**
     * Era um `const` dentro de `CreateJobModal.tsx`, e o cadastro era o único
     * que escolhia formato. Deixou de ser: uma segunda cópia divergiria na
     * primeira vez que alguém acrescentasse um formato num lado só — e a rede
     * que ganhasse "Feed + Story" sem publicador voltaria a descartar a arte do
     * story em silêncio, com a fila dizendo "publicado".
     */
    expect(formatos, 'a tabela sumiu de src/lib/formatos.ts').toMatch(
      /export const FORMATOS_POR_CANAL/
    );
    expect(cadastro, 'o cadastro voltou a ter a própria cópia da tabela').not.toMatch(
      /const FORMATOS_POR_CANAL/
    );
    expect(modal, 'a modal de detalhe voltou a ter a própria cópia da tabela').not.toMatch(
      /const FORMATOS_POR_CANAL/
    );

    for (const [arquivo, fonte] of [
      ['CreateJobModal', cadastro],
      ['JobDetailModal', modal],
    ] as const) {
      expect(fonte, `${arquivo} deixou de ler a tabela compartilhada`).toMatch(
        /from '\.\.\/\.\.\/lib\/formatos'/
      );
    }
  });

  it('o detalhe oferece só os formatos das redes da peça', () => {
    // Oferecer a lista inteira deixaria trocar uma peça do YouTube para
    // "Story", que não existe lá — e o erro só apareceria na hora de publicar.
    expect(modal, 'o seletor de formato voltou a oferecer a lista inteira').toMatch(
      /formatosComuns\(/
    );
  });
});

describe('o selo que edita não é um oitavo desenho de selo', () => {
  it('o selo visível vem de fora, sempre', () => {
    /**
     * O desenho continua morando em `Badges.tsx`: o gatilho recebe o selo
     * pronto em `children` e não conhece cor nenhuma. Se ele passar a montar
     * o selo, volta a haver mais de um dono do desenho — que é como nasceram
     * as quatro alturas de badge.
     *
     * **A primeira versão desta guarda procurava classes de caixa e reprovou o
     * `w-3 h-3` da setinha**, que é o tamanho de um ícone, não de um selo. É a
     * mesma lição do `rounded-full` do `PontoDoBadge`: a guarda tem que afirmar
     * a decisão, e a decisão aqui é *de onde vem o selo*, não que string de
     * classe aparece no arquivo.
     */
    expect(selo, 'o gatilho deixou de receber o selo pronto').toMatch(/\{children\}/);

    for (const importado of [/from '.*Badges'/, /from '.*ui\/badge'/]) {
      expect(
        selo.match(importado)?.[0] ?? null,
        'SeloEditavel passou a montar o próprio selo. Ele recebe o selo em ' +
          '`children`: é assim que o desenho continua tendo um dono só'
      ).toBeNull();
    }
  });

  it('a troca é por DropdownMenu, não por select nativo', () => {
    /**
     * O `<select>` do sistema operacional tem a fonte, a seta e o cinza que o
     * aparelho escolher. No meio de uma linha de selos coloridos ele lê como
     * erro de renderização — e o produto é whitelabel, então "a cara do
     * navegador" é justamente o que ele existe para não mostrar.
     */
    expect(selo, 'o seletor de selo virou select nativo').not.toMatch(/<select\b/);
    expect(selo, 'o seletor de selo deixou de usar o DropdownMenu').toMatch(
      /DropdownMenuTrigger/
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
     */
    expect(redes, 'o aviso do story sumiu do resultado da publicação').toMatch(/aviso\?: string/);
    expect(redes, 'o aviso deixou de ser repassado ao chamador').toMatch(/aviso: payload\.aviso/);
    expect(modal, 'a modal voltou a ignorar o aviso do story').toMatch(/aviso\s*\?\s*\{ ok: false/);
  });

  it('a resposta aparece em linha, não em diálogo', () => {
    /**
     * `useAviso` é para **falha que interrompe**. "Publicado em @conta" não é:
     * confirmação de que deu certo não merece uma caixa que precisa ser
     * fechada. E o erro em linha continua legível enquanto a pessoa relê a
     * peça — num diálogo ele some ao ser dispensado, que é quando a pessoa
     * precisa dele.
     */
    expect(modal, 'a publicação voltou a responder por diálogo').not.toMatch(
      /avisar\(\{\s*titulo: 'Publicado'/
    );
    expect(modal, 'o resultado da publicação sumiu da tela').toMatch(
      /resultadoDaPublicacao && \(/
    );
  });
});
