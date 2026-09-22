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
    expect(corpo.slice(0, 900), 'o soltar deixou de passar por moveJobStatus').toMatch(
      /moveJobStatus\(job\.id, novoStatus\)/
    );
  });

  it('arrastar nunca enfileira publicação', () => {
    /**
     * **Esta é a guarda que protege o produto, não a interação.**
     *
     * "Agendado" não é só um status: significa que a peça está na
     * `publish_queue` e vai ao ar sozinha na data. Enfileirar é um clique,
     * nunca um efeito — um disparo a partir de um gesto de arrastar é a forma
     * mais barata de publicar o que ninguém decidiu publicar, e postagem no
     * perfil do cliente não volta.
     */
    expect(
      tudo.match(/agendarPublicacao|publicarAgora/)?.[0] ?? null,
      'o quadro passou a publicar ou enfileirar a partir de um arrasto'
    ).toBeNull();
  });

  it('a coluna que junta dois status escolhe o de menor compromisso', () => {
    /**
     * "Aprovado / Agendado" é alimentada por `['approved', 'scheduled']`, e o
     * arrasto leva ao **primeiro**. Levar a `scheduled` diria que a peça está
     * na fila quando ela não está — a tela afirmando o que não aconteceu.
     */
    const corpo = quadro.slice(quadro.indexOf('const statusAoSoltar'));
    expect(corpo.slice(0, 400), 'o arrasto deixou de escolher o primeiro status').toMatch(
      /return col\.statuses\[0\]/
    );
    expect(quadro, 'a ordem da coluna juntada mudou — o arrasto passaria a agendar').toMatch(
      /statuses: \['approved', 'scheduled'\]/
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
