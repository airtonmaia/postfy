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
