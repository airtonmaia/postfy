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
    expect(modal, 'o formato Feed + Story saiu do seletor').toMatch(
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
