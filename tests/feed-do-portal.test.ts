import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Job } from '../src/types';
import { feedDoCliente, vaiParaOInstagram } from '../src/lib/feedDoInstagram';
import { semComentarios } from './util/semComentarios';

/**
 * A prévia do feed, no portal do cliente.
 *
 * O cliente aprova **uma peça de cada vez**, e o perfil dele não é uma peça de
 * cada vez. A grade existe para ele ver o conjunto antes de publicar — e é
 * justamente por isso que o que entra nela é uma decisão, não um detalhe:
 * mostrar a coluna Ideias prometeria publicação que ninguém decidiu fazer, e
 * ordenar de outro jeito mostraria uma harmonia que o perfil não vai ter.
 *
 * A regra é pura, então ela é **exercitada** aqui, não descrita.
 */

const job = (parcial: Partial<Job> & { id: string }): Job =>
  ({
    workspaceId: 'w1',
    clientId: 'c1',
    title: parcial.id,
    status: 'scheduled',
    platform: 'instagram',
    canais: ['instagram'],
    priority: 'medium',
    currentVersion: 1,
    mediaUrls: [],
    ...parcial,
  }) as Job;

const ids = (lista: Job[]) => lista.map((j) => j.id);

describe('o que entra na grade do feed', () => {
  /**
   * **A regra que o pedido nomeou.** A coluna Ideias é o rascunho da agência —
   * pauta anotada, tema em estudo, o que saiu da reunião e pode não virar
   * nada. No feed do cliente ela viraria promessa.
   */
  it('peça na coluna Ideias fica de fora', () => {
    const lista = feedDoCliente([
      job({ id: 'ideia', status: 'ideas', scheduledDate: '2026-10-10T10:00:00Z' }),
      job({ id: 'agendada', scheduledDate: '2026-10-09T10:00:00Z' }),
    ]);

    expect(ids(lista)).toEqual(['agendada']);
  });

  it('todos os outros estágios entram, inclusive o que ainda está em produção', () => {
    const estagios: Job['status'][] = [
      'in_production',
      'for_approval',
      'in_adjustment',
      'approved',
      'scheduled',
      'published',
    ];

    const lista = feedDoCliente(
      estagios.map((status, i) =>
        job({ id: status, status, scheduledDate: `2026-10-0${i + 1}T10:00:00Z` })
      )
    );

    expect(lista).toHaveLength(estagios.length);
  });

  /**
   * A ordem é a do Instagram: o mais recente no canto superior esquerdo. É o
   * que faz a simulação valer — a grade tem de ser a que vai existir.
   */
  it('a mais recente vem primeiro', () => {
    const lista = feedDoCliente([
      job({ id: 'meio', scheduledDate: '2026-10-21T10:00:00Z' }),
      job({ id: 'antiga', scheduledDate: '2026-10-07T10:00:00Z' }),
      job({ id: 'nova', scheduledDate: '2026-11-02T10:00:00Z' }),
    ]);

    expect(ids(lista)).toEqual(['nova', 'meio', 'antiga']);
  });

  /**
   * Peça sem data existe — a pauta entra antes de ganhar dia. Ela cai no fim
   * em vez de sumir, e **sem desordenar as outras**: comparador que devolve
   * `NaN` faz a ordem depender do algoritmo do navegador, e a grade passaria a
   * se reorganizar sozinha entre recarregamentos.
   */
  it('peça sem data vai para o fim sem bagunçar o resto', () => {
    const lista = feedDoCliente([
      job({ id: 'sem-data-1' }),
      job({ id: 'nova', scheduledDate: '2026-11-02T10:00:00Z' }),
      job({ id: 'sem-data-2' }),
      job({ id: 'antiga', scheduledDate: '2026-10-07T10:00:00Z' }),
    ]);

    expect(ids(lista).slice(0, 2)).toEqual(['nova', 'antiga']);
    expect(ids(lista).slice(2).sort()).toEqual(['sem-data-1', 'sem-data-2']);
  });

  it('o prazo de produção vale quando não há data de publicação', () => {
    const lista = feedDoCliente([
      job({ id: 'so-prazo', deadlineProduction: '2026-11-20T10:00:00Z' }),
      job({ id: 'agendada', scheduledDate: '2026-10-07T10:00:00Z' }),
    ]);

    expect(ids(lista)).toEqual(['so-prazo', 'agendada']);
  });
});

/**
 * A grade é um perfil do Instagram, então ela só mostra o que vai para lá.
 * Uma peça de LinkedIn no meio do grid afirmaria uma publicação que não vai
 * acontecer, e é sobre essa grade que o cliente decide a estética do perfil.
 */
describe('só o que vai ao Instagram', () => {
  it('a peça marcada em várias redes entra, desde que uma seja o Instagram', () => {
    expect(vaiParaOInstagram({ canais: ['facebook', 'instagram'], platform: 'facebook' })).toBe(
      true
    );
  });

  it('a peça que não vai ao Instagram fica de fora', () => {
    const lista = feedDoCliente([
      job({ id: 'linkedin', platform: 'linkedin', canais: ['linkedin'] }),
      job({ id: 'insta' }),
    ]);

    expect(ids(lista)).toEqual(['insta']);
  });

  /**
   * `canais` é a lista nova; `platform` é o campo de quando o conteúdo ia para
   * uma rede só. Lista vazia não pode esconder a peça do dono dela.
   */
  it('sem canais, vale o canal principal', () => {
    expect(vaiParaOInstagram({ canais: [], platform: 'instagram' })).toBe(true);
    expect(vaiParaOInstagram({ canais: undefined, platform: 'instagram' })).toBe(true);
    expect(vaiParaOInstagram({ canais: undefined, platform: 'tiktok' })).toBe(false);
  });
});

describe('a aba no portal', () => {
  const RAIZ = join(__dirname, '..');
  const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

  const portal = semComentarios(ler('src', 'components', 'portal', 'ClientPortalView.tsx'));
  const grade = semComentarios(ler('src', 'components', 'portal', 'FeedDoInstagram.tsx'));

  it('a aba existe e monta a grade', () => {
    expect(portal).toMatch(/rotulo: 'Feed'/);
    expect(portal).toMatch(/<FeedDoInstagram/);
  });

  /**
   * O aprovador vê o Feed: ele é quem decide sobre a peça, e o conjunto é
   * parte dessa decisão. Não há dado novo ali — a grade é montada com as
   * mesmas peças que ele já recebe do banco.
   */
  it('o aprovador enxerga a aba', () => {
    const recorte = portal.slice(portal.indexOf('if (ehAprovador)'));
    expect(recorte.slice(0, 200)).toContain("a.id === 'feed'");
  });

  /**
   * **A grade não inventa número.**
   *
   * O simulador interno da agência escreve `14.8k` seguidores e `482`
   * seguindo à mão — num painel interno isso passa como enfeite de maquete.
   * No portal não: o cliente conhece o número dele, e ver um inventado no
   * próprio perfil é a tela afirmando o que não mediu, na frente de quem sabe
   * a resposta. É a armadilha 9 no lugar mais caro dela.
   */
  it('não mostra seguidores nem seguindo', () => {
    expect(grade).not.toMatch(/seguidores|seguindo/);
    expect(grade).not.toMatch(/14\.8k|\b482\b/);
  });

  /**
   * E não monta o arroba a partir do nome: `nome.toLowerCase()` quase nunca é
   * o identificador de verdade, e um perfil que mostra o handle errado ao
   * próprio dono não é maquete, é erro.
   */
  it('não inventa o @ do cliente', () => {
    expect(grade).not.toMatch(/toLowerCase\(\)/);
  });

  /** A moldura de celular é a exceção nomeada do vocabulário de canto. */
  it('a grade tem três colunas, como o Instagram', () => {
    expect(grade).toMatch(/grid-cols-3/);
  });

  /**
   * **A miniatura do perfil é 4:5, e não quadrada.**
   *
   * O grid quadrado é o Instagram de antes. Numa grade quadrada com
   * `object-cover`, o topo e a base de cada arte somem **só na simulação** e
   * voltam no perfil de verdade — a tela mostrando um corte que não vai
   * existir, que é o oposto do que ela serve para fazer. E o erro passa
   * despercebido porque *parece* o Instagram: só quem compara com o app vê.
   */
  it('cada arte da grade é 4:5, como o perfil recorta hoje', () => {
    expect(grade).toMatch(/aspect-\[4\/5\]/);
    expect(grade, 'a grade voltou a ser quadrada').not.toMatch(/aspect-square/);
  });
});

/**
 * **A prévia que a grade abre também mostra a arte na proporção dela.**
 *
 * Tocar numa peça do feed abre a prévia do calendário, e ela mostrava um
 * carrossel de 1080×1440 como uma faixa deitada: a proporção estava escrita no
 * **mesmo elemento** que o teto de altura (`aspect-[4/5] max-h-72`). Junto,
 * esse par não é proporção nenhuma — a largura continua vindo da modal, a
 * altura é cortada pelo teto, e o `object-cover` recorta a arte para caber no
 * que sobrou.
 *
 * O que torna isso caro é o lugar: o corte existia **só na prévia**, e no
 * perfil a arte volta inteira. Quem aprova decide sobre um enquadramento que
 * não vai ao ar — e é justamente o enquadramento que esta tela existe para
 * mostrar.
 */
describe('a prévia que a grade abre', () => {
  const RAIZ = join(__dirname, '..');
  const portal = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'portal', 'ClientPortalView.tsx'), 'utf-8')
  );

  const daPrevia = portal.slice(portal.indexOf('open={!!calendarPreviewJob}'));
  const bloco = daPrevia.slice(0, daPrevia.indexOf('</DialogContent>'));

  it('a arte ocupa a largura inteira, na proporção da peça', () => {
    expect(bloco, 'a prévia deixou de montar o quadro na proporção da peça').toMatch(
      /w-full \$\{proporcaoDoCriativo\(/
    );
  });

  it('a proporção não divide o elemento com um teto de altura', () => {
    expect(
      bloco,
      'a proporção voltou a dividir o elemento com um teto de altura, e a arte sai deitada'
    ).not.toMatch(
      /max-h-\S*\s*\$\{proporcaoDoCriativo|\$\{proporcaoDoCriativo\([^)]*\)\}\s*max-h-/
    );
  });

  /**
   * A arte grande só é possível porque ela **rola**. Sem a rolagem, a única
   * saída para caber é espremer a altura — e espremer a altura de um quadro
   * que tem proporção é o bug de cima, de volta.
   */
  it('a arte entra na área que rola', () => {
    const rolagem = bloco.indexOf('flex-1 min-h-0 overflow-y-auto');
    const arte = bloco.indexOf('proporcaoDoCriativo(');

    expect(rolagem, 'a prévia perdeu a área de rolagem').toBeGreaterThan(-1);
    expect(arte, 'a arte ficou fora da área que rola').toBeGreaterThan(rolagem);
  });

  /**
   * O quadro da peça **não** é onde o simulador do perfil manda: o feed recorta
   * tudo para 4:5, e a peça é o que ela é — um Reels é 9:16 aqui. Confundir os
   * dois faria a aprovação decidir sobre um enquadramento e a publicação sair
   * com outro.
   */
  it('o quadro da peça sai da peça, não da grade', () => {
    expect(bloco, 'a prévia passou a usar a proporção da grade do perfil').not.toMatch(
      /aspect-\[4\/5\]/
    );
  });

  /**
   * Um X só. O primitivo desenha o dele quando `semFechar` não vai, e ele é
   * `ghost` — pensado para faixa branca de cabeçalho. Aqui ele cai **sobre a
   * arte**, onde um X cinza sobre foto some; eram dois botões empilhados no
   * mesmo canto, e o de cima era o que não dava para ver.
   */
  it('a prévia tem um fechar só, e é o que se enxerga sobre a arte', () => {
    expect(bloco, 'o fechar do primitivo voltou, empilhado com o nosso').toMatch(/semFechar/);
    expect(
      (bloco.match(/aria-label="Fechar"/g) ?? []).length,
      'a prévia ficou com mais de um botão de fechar'
    ).toBe(1);
  });
});
