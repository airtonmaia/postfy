import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * "Feed + Story": uma peça, duas saídas.
 *
 * A guarda que importa é a segunda. Quando o feed já saiu e o story falha, a
 * tentação é deixar a exceção subir — e aí a fila marca `pendente`, a passada
 * seguinte roda de novo e **republica o feed**. Post duplicado no perfil do
 * cliente não volta, e é o pior desfecho desta rota.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const publicar = ler('api', 'publicar.ts');
const instagram = ler('api', '_lib', 'instagram.ts');
const modal = ler('src', 'components', 'modals', 'CreateJobModal.tsx');
/**
 * A tabela de formatos por rede saiu da modal de cadastro para cá.
 *
 * A modal de detalhe passou a editar o formato da peça já criada, e duas
 * cópias da tabela divergiriam na primeira pressa — a rede que ganhasse "Feed
 * + Story" num lado só voltaria a oferecer o que o publicador não entrega.
 * Esta guarda seguiu a tabela: é ela que decide, não o arquivo onde ela mora.
 */
const formatos = ler('src', 'lib', 'formatos.ts');
const portal = ler('src', 'components', 'portal', 'ClientPortalView.tsx');
const previa = ler('src', 'components', 'common', 'PreviaDaRede.tsx');

describe('o story sai como story, não no feed', () => {
  it('o publicador manda media_type STORIES', () => {
    /**
     * **Isto faltava, e a falta era um bug em produção.** A função nunca
     * mandava `media_type: 'STORIES'`: um conteúdo com formato "Story" criava
     * um contêiner comum e ia parar **no feed**, com legenda e tudo. A Meta
     * aceita e publica, então não havia erro em lugar nenhum — quem olhasse a
     * fila via "publicado".
     */
    expect(
      instagram,
      'o story voltou a ser publicado como post de feed, e a Meta aceita calada'
    ).toMatch(/media_type: 'STORIES'/);
  });

  it('STORIES vence REELS', () => {
    // Um vídeo publicado como story é story, não reel. Com a ordem trocada, o
    // vídeo vertical do story viraria um Reel no perfil.
    const corpo = instagram.slice(instagram.indexOf('export const publicarNoInstagram'));
    expect(
      corpo.slice(0, 1200),
      'o REELS passou a vencer o STORIES — vídeo de story vira Reel'
    ).toMatch(/ehStory \? \{ media_type: 'STORIES' \}\s*:\s*ehVideo \? \{ media_type: 'REELS' \}/);
  });

  it('story não leva legenda', () => {
    // A Meta **ignora** `caption` em story. Mandá-la faria a tela prometer um
    // texto que não aparece em lugar nenhum.
    const corpo = instagram.slice(instagram.indexOf('export const publicarNoInstagram'));
    expect(corpo.slice(0, 1200), 'a legenda voltou a ser mandada no story').toMatch(
      /ehStory \? \{\} : \{ caption: legenda \}/
    );
  });

  it('o formato do job chega ao publicador', () => {
    // Sem ler `format` do banco, o publicador não tem como saber para onde a
    // peça vai — e era exatamente essa a causa do story cair no feed.
    expect(publicar, 'o publicador deixou de ler o formato do conteúdo').toMatch(
      /select\('title, caption, media_urls, story_media_urls, format, hashtags'\)/
    );
  });
});

describe('o feed publicado nunca é republicado', () => {
  it('a falha do story é capturada, não propagada', () => {
    /**
     * Esta é **a** guarda desta entrega.
     *
     * Se a exceção do story subir, o laço marca o item como `pendente` (ou
     * `falhou`) e a passada seguinte chama `publicarItem` de novo — que começa
     * publicando o feed. O cliente fica com dois posts iguais no perfil.
     */
    const corpo = publicar.slice(publicar.indexOf('const ehFeedStory'));
    const tentativa = corpo.indexOf('try {');
    const captura = corpo.indexOf('} catch (erro) {', tentativa);

    expect(tentativa, 'a publicação do story saiu do try — a falha volta a propagar').toBeGreaterThan(-1);
    expect(captura, 'o catch do story sumiu').toBeGreaterThan(tentativa);
    expect(
      corpo.slice(captura, captura + 400),
      'o catch do story passou a relançar o erro: a passada seguinte republica o feed'
    ).toMatch(/avisoDoStory/);
    expect(
      corpo.slice(captura, captura + 400),
      'o catch do story voltou a lançar'
    ).not.toMatch(/throw/);
  });

  it('o item fecha como publicado, com o aviso à vista', () => {
    /**
     * `status: 'falhou'` aqui seria a fila mentindo nos dois sentidos: o feed
     * saiu (não falhou) e a passada seguinte tentaria de novo. O motivo vai
     * para `last_error` **em publicado**, que é o único estado honesto.
     */
    const bloco = publicar.slice(publicar.indexOf("status: 'publicado'"));
    expect(
      bloco.slice(0, 500),
      'o aviso do story deixou de ser gravado — o story falha em silêncio'
    ).toMatch(/last_error: publicado\.avisoDoStory/);
    expect(bloco.slice(0, 500)).toMatch(/story_external_id: publicado\.idDoStory/);
  });

  it('o feed é publicado antes do story', () => {
    // Ele tem métrica, permalink e vida longa; o story expira em 24h. Na ordem
    // trocada, uma falha no feed deixaria um story órfão no ar.
    const corpo = publicar.slice(publicar.indexOf('const ehFeedStory'));
    expect(corpo.indexOf('const idDoFeed')).toBeLessThan(corpo.indexOf("'story'\n    );"));
  });
});

describe('as duas artes existem em todo lugar que decide', () => {
  it('o editor mostra dois campos de upload', () => {
    expect(formatos, 'o formato Feed + Story saiu do seletor').toMatch(
      /valor: 'feed_story', rotulo: 'Feed \+ Story'/
    );
    expect(modal, 'o segundo upload, do story, sumiu').toMatch(/label="Mídia do Story"/);
    // Um arquivo só: story é uma tela, não uma sequência.
    const storyUploader = modal.slice(modal.indexOf('label="Mídia do Story"') - 300);
    expect(storyUploader.slice(0, 400)).toMatch(/maxFiles=\{1\}/);
  });

  it('a arte do story não entra em media_urls', () => {
    /**
     * O segundo item de `media_urls` já significa "página 2 do carrossel".
     * Guardar o story ali faria um carrossel de duas páginas virar feed+story
     * sozinho, e vice-versa.
     */
    expect(modal, 'a arte do story voltou a ser gravada em mediaUrls').toMatch(
      /storyMediaUrls: format === 'feed_story' \? storyMediaUrls : \[\]/
    );
  });

  it('o cliente vê as duas no portal', () => {
    // Aprovar só o feed é aprovar metade da peça sem saber — e a metade não
    // vista é a vertical, que é onde o corte errado aparece.
    expect(portal, 'o portal voltou a mostrar só a arte do feed').toMatch(
      /<CriativoDeFeedEStory/
    );
    expect(portal).toMatch(/story=\{job\.storyMediaUrls\?\.\[0\]\}/);
  });

  it('a prévia da agência mostra a arte do story no quadro de story', () => {
    // A prévia é onde a agência confere antes de mandar para aprovação.
    // Repetir a do feed ali prometeria um enquadramento que não vai ao ar.
    expect(previa, 'a prévia deixou de receber a arte do story').toMatch(/artesDoStory/);
    expect(previa, 'o quadro de story voltou a desenhar a arte do feed').toMatch(
      /ehStory && artesDoStory\.length \? artesDoStory\[0\] : artes\[pagina\]/
    );
  });
});

describe('o formato só é oferecido onde as duas saídas existem', () => {
  /**
   * **Esta guarda nasceu de um erro da primeira versão desta entrega, e ele
   * chegou a produção.**
   *
   * "Feed + Story" foi oferecido para o **Facebook** enquanto `publicarItem`
   * retornava logo depois do feed: a arte do story era **descartada em
   * silêncio**, e a fila dizia "publicado". A pessoa subia duas artes, aprovava
   * as duas com o cliente, e uma não saía.
   *
   * Story de Página é outro fluxo (`/{page-id}/photo_stories`, com a foto
   * enviada não publicada antes) e não existe em `api/_lib/facebook.ts`.
   *
   * É exatamente o motivo de `FORMATOS_POR_CANAL` ser por rede, escrito no
   * próprio arquivo: "oferecer a lista inteira em toda rede deixava escolher
   * combinação que não vai ao ar, e o erro só apareceria na hora de publicar".
   */
  const redesQueOferecem = (): string[] => {
    const inicio = formatos.indexOf('FORMATOS_POR_CANAL');
    expect(inicio, 'a tabela de formatos por rede sumiu de src/lib/formatos.ts').toBeGreaterThan(-1);

    const bloco = formatos.slice(inicio, formatos.indexOf('\n};', inicio));
    const achadas: string[] = [];

    // `instagram: [ … ],` — a rede e a lista dela.
    for (const m of bloco.matchAll(/^\s{2}(\w+):\s*\[([\s\S]*?)\],?$/gm)) {
      if (m[2].includes("'feed_story'")) achadas.push(m[1]);
    }
    return achadas;
  };

  it('só o Instagram oferece Feed + Story', () => {
    expect(
      redesQueOferecem(),
      'uma rede passou a oferecer Feed + Story. O publicador dela precisa sair ' +
        'com as duas peças, ou a arte do story é descartada em silêncio'
    ).toEqual(['instagram']);
  });

  it('a rede que oferece tem caminho de story no publicador', () => {
    // O que a guarda acima mede indiretamente, medido de frente: a rede
    // oferecida precisa ter um publicador que aceite o destino `story`.
    for (const rede of redesQueOferecem()) {
      expect(
        instagram,
        `${rede} oferece Feed + Story sem o publicador aceitar o destino story`
      ).toMatch(/destino: 'feed' \| 'story'/);
    }
  });

  it('o publicador recusa em vez de publicar metade', () => {
    /**
     * O cinto. A lista de formatos e o publicador podem divergir numa edição
     * futura — e quando divergirem, a falha tem que ser **barulhenta**: fica em
     * `last_error`, à vista na fila, em vez de meia publicação com cara de
     * sucesso.
     */
    const facebook = publicar.slice(publicar.indexOf("if (conexao.platform === 'facebook')"));
    const recusa = facebook.indexOf("job.format === 'feed_story'");
    const publica = facebook.indexOf('publicarNoFacebook(');

    expect(recusa, 'o publicador do Facebook deixou de recusar feed+story').toBeGreaterThan(-1);
    expect(
      recusa,
      'a recusa ficou depois da publicação — o feed sai e o story é descartado'
    ).toBeLessThan(publica);
    expect(facebook.slice(recusa, publica), 'a recusa deixou de lançar').toMatch(/throw new Error/);
  });
});
