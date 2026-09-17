import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
/**
 * O formulário do conteúdo, que agora é **um só**: cadastrar e editar montam
 * o mesmo componente.
 *
 * A guarda apontava para `CreateJobModal.tsx`, e passou a apontar para
 * errado no dia em que o formulário saiu de lá. Ela seguiu o *arquivo*, e o
 * que ela existe para proteger é a *decisão* — dois campos de upload, a arte
 * do story fora de `media_urls`. É a mesma lição da guarda do despacho por
 * rede, que precisou sair da sintaxe do ternário.
 */
const modal = ler('src', 'components', 'jobs', 'FormularioDoConteudo.tsx');

/** Onde a decisão de gravar vira linha do banco: as duas telas que salvam. */
const telasQueSalvam = [
  ler('src', 'components', 'modals', 'CreateJobModal.tsx'),
  ler('src', 'components', 'modals', 'JobDetailModal.tsx'),
];
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
    /**
     * **As duas telas gravam**, e as duas precisam da condição. O editor
     * passou a salvar a peça inteira: sem a mesma linha ali, reabrir um
     * carrossel e clicar em "Salvar" carimbaria a arte do story num post de
     * feed — e nenhuma tela mostraria essa mídia órfã.
     */
    for (const fonte of telasQueSalvam) {
      expect(fonte, 'a arte do story voltou a ser gravada em mediaUrls').toMatch(
        /storyMediaUrls: (?:dados\.)?format === 'feed_story' \? (?:dados\.)?storyMediaUrls : \[\]/
      );
    }
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

  it('há pelo menos uma rede oferecendo, senão a guarda não mede nada', () => {
    // Lista vazia faria os laços abaixo passarem sem afirmar coisa alguma —
    // a forma mais silenciosa de uma guarda deixar de guardar.
    expect(redesQueOferecem().length).toBeGreaterThan(0);
  });

  /**
   * **A regra não é "só o Instagram".**
   *
   * A primeira versão desta guarda exigia `['instagram']` literalmente, e ela
   * estava certa enquanto o Facebook não tinha publicador de story. Mas uma
   * lista literal obriga a editar a guarda junto com o código — e editar a
   * guarda junto com o código é como ela deixa de guardar: quem acrescentasse
   * uma rede trocaria a lista sem pensar no publicador, que é justamente a
   * decisão.
   *
   * O que precisa valer é **a rede que oferece sabe publicar story**, venha
   * ela de onde vier. É a mesma correção que a guarda de `REDES_QUE_PUBLICAM`
   * já tinha precisado.
   */
  it('toda rede que oferece sabe publicar story', () => {
    for (const rede of redesQueOferecem()) {
      const caminho = join(RAIZ, 'api', '_lib', `${rede}.ts`);
      expect(
        existsSync(caminho),
        `${rede} oferece Feed + Story e não tem api/_lib/${rede}.ts — a arte do ` +
          `story não tem para onde ir`
      ).toBe(true);

      const lib = semComentarios(readFileSync(caminho, 'utf-8'));
      /*
        Duas formas legítimas, porque as duas redes resolvem isto de jeitos
        diferentes: o Instagram passa um `destino` ao mesmo publicador; o
        Facebook tem endpoint próprio (`/photo_stories`, `/video_stories`).
        Exigir uma das duas formas engessaria a rede seguinte.
      */
      expect(
        /destino: 'feed' \| 'story'/.test(lib) ||
          /_stories`/.test(lib) ||
          /publicarStoryNo/.test(lib),
        `${rede} oferece Feed + Story sem caminho de story no publicador — a arte ` +
          `seria descartada em silêncio, com a fila dizendo "publicado"`
      ).toBe(true);
    }
  });

  it('a falha do story é capturada em toda rede que oferece', () => {
    /**
     * **É esta a guarda que substituiu o `throw` do Facebook.**
     *
     * O `throw` era o cinto de quando não havia publicador. Agora que há, o
     * que protege contra a meia publicação é a captura: o feed sai primeiro, e
     * se o story falhar o motivo vira `avisoDoStory` — `last_error`, à vista
     * na fila e na tela do conteúdo.
     *
     * A contagem é o que pega a rede acrescentada sem a captura: uma rede a
     * mais na lista de formatos sem um `avisoDoStory` a mais aqui significa
     * que, naquela rede, a exceção sobe — e a passada seguinte **republica o
     * feed**.
     */
    const capturas = [...publicar.matchAll(/avisoDoStory: `O feed saiu, o story não/g)];
    expect(
      capturas.length,
      'uma rede oferece Feed + Story sem capturar a falha do story: a exceção ' +
        'sobe, o item volta para pendente e a passada seguinte republica o feed'
    ).toBe(redesQueOferecem().length);
  });

  it('o Facebook publica o feed antes do story', () => {
    // Na ordem trocada, uma falha no feed deixaria um story órfão no ar — e o
    // feed é o que tem métrica, permalink e vida longa.
    const facebook = publicar.slice(publicar.indexOf("if (conexao.platform === 'facebook')"));
    const feed = facebook.indexOf('publicarNoFacebook(');
    const story = facebook.indexOf('publicarStoryNoFacebook(\n        conexao.account_id');

    expect(feed, 'o publicador de feed do Facebook sumiu').toBeGreaterThan(-1);
    expect(story, 'o publicador de story do Facebook sumiu do caminho feed+story').toBeGreaterThan(-1);
    expect(feed, 'o story do Facebook passou a sair antes do feed').toBeLessThan(story);
  });

  it('a foto do story de Página entra não publicada', () => {
    /**
     * `/{page-id}/photos` publica **no feed** por padrão. Sem
     * `published: false`, a arte vertical do story apareceria também no feed
     * da Página — o cliente ficaria com uma peça a mais, cortada, e nada
     * avisaria.
     */
    const facebook = ler('api', '_lib', 'facebook.ts');
    const bloco = facebook.slice(facebook.indexOf('publicarStoryNoFacebook'));
    const foto = bloco.indexOf('photos`');
    expect(foto, 'o passo da foto sumiu do story de Página').toBeGreaterThan(-1);
    expect(
      bloco.slice(foto, foto + 400),
      'a foto do story voltou a ser publicada direto no feed'
    ).toMatch(/published: false/);
  });
});

describe('a arte do story nunca é substituída pela do feed', () => {
  /**
   * **Esta é a guarda de um post errado que foi ao ar no perfil de um
   * cliente.**
   *
   * `publicarItem` tinha `(job.story_media_urls || [])[0] || midia`. Faltando
   * a arte vertical, ele mandava a **do feed** para o story: a Meta aceita e
   * publica, então a fila fechou como `publicado`, com `story_external_id`
   * preenchido e `last_error` nulo — sucesso completo, story errado no ar.
   *
   * Conferido na `publish_queue` de produção depois do primeiro teste real:
   * item `publicado`, os dois ids, nenhum erro, e `story_media_urls` da peça
   * **vazio**.
   *
   * O fallback parecia generoso e era o oposto: as proporções são 4:5 e 9:16,
   * e a mesma imagem nos dois sai cortada num deles — é a razão de
   * `story_media_urls` ser coluna própria. Substituir uma arte por outra é
   * decisão de quem produz a peça, nunca do publicador.
   */
  it('nenhum publicador cai na mídia do feed quando falta a do story', () => {
    /**
     * O padrão procurado é o do bug: uma leitura de `story_media_urls`
     * seguida de `||` com outra coisa. Vale para as duas redes — o Facebook
     * tinha a mesma linha —, e a busca é pelo **efeito**, não pelo nome da
     * variável, que muda.
     */
    expect(
      publicar.match(/story_media_urls[^\n]*\|\|\s*midia/),
      'o publicador voltou a usar a arte do feed como story — a peça sai ' +
        'cortada no perfil do cliente e a fila diz "publicado"'
    ).toBeNull();
  });

  it('faltando a arte, o feed sai e o motivo fica em last_error', () => {
    /**
     * `falhou` aqui seria a fila mentindo nos dois sentidos: o feed saiu, e a
     * passada seguinte o republicaria. É a mesma regra da falha do story, e o
     * desfecho tem de ser o mesmo.
     */
    expect(publicar, 'o caso "sem arte de story" deixou de ter motivo próprio').toMatch(
      /SEM_ARTE_DE_STORY/
    );
    const trecho = publicar.slice(publicar.indexOf('const midiaDoStory'));
    expect(
      trecho.slice(0, 400),
      'faltando a arte, o retorno deixou de ser o feed com aviso'
    ).toMatch(/if \(!midiaDoStory\)[\s\S]{0,120}avisoDoStory: SEM_ARTE_DE_STORY/);
  });

  it('a conferência também mora antes da ação, num lugar só', () => {
    /**
     * Descobrir no publicador é tarde: o feed já está no perfil e a peça ficou
     * pela metade. Antes da ação ainda dá para subir a arte.
     *
     * E a regra mora em `formatos.ts`, não em cada tela: são quatro botões em
     * três telas que disparam publicação, e repetir a conferência em cada um
     * garante esquecer um — que é exatamente como o `aviso` do story ficou
     * sem ser lido na modal de cadastro.
     */
    const formatos = ler('src', 'lib', 'formatos.ts');
    expect(formatos, 'faltaArteDoStory saiu da fonte única').toMatch(
      /export const faltaArteDoStory/
    );
    expect(formatos, 'a conferência deixou de olhar o formato e a arte juntos').toMatch(
      /format === 'feed_story'[\s\S]{0,200}storyMediaUrls/
    );
  });

  it('os quatro caminhos que disparam publicação conferem antes', () => {
    /**
     * A lista é **derivada**: todo arquivo de `src` que chama
     * `agendarPublicacao` ou `publicarAgora` precisa conferir. Lista literal
     * teria de ser editada junto com o código — e é assim que uma guarda
     * deixa de guardar.
     */
    const pastas = ['modals', 'publications'];
    const arquivos: string[] = [];
    for (const pasta of pastas) {
      const dir = join(RAIZ, 'src', 'components', pasta);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
        const fonte = semComentarios(readFileSync(join(dir, f), 'utf-8'));
        if (/agendarPublicacao\(|publicarAgora\(/.test(fonte)) arquivos.push(f);
      }
    }

    expect(arquivos.length, 'nenhum arquivo dispara publicação — a busca quebrou')
      .toBeGreaterThan(2);

    for (const f of arquivos) {
      const pasta = pastas.find((p) =>
        existsSync(join(RAIZ, 'src', 'components', p, f))
      )!;
      const fonte = semComentarios(
        readFileSync(join(RAIZ, 'src', 'components', pasta, f), 'utf-8')
      );
      expect(
        fonte,
        `${f} dispara publicação sem conferir a arte do story — ` +
          'feed+story sem a arte vertical sairia pela metade'
      ).toMatch(/faltaArteDoStory\(/);
    }
  });

  it('a tela não diz "publicado" liso quando o story não saiu', () => {
    /**
     * `api/publicar.ts` devolve `aviso` desde que o feed+story existe, e a
     * modal de **cadastro** o descartava: dizia "Publicado em @conta" onde
     * houve uma saída de duas. É a mesma mentira do `|| midia`, só na tela em
     * vez de no perfil.
     */
    for (const tela of telasQueSalvam) {
      if (!/publicarAgora\(/.test(tela)) continue;
      expect(
        tela,
        'uma tela que publica voltou a ignorar o aviso do story'
      ).toMatch(/aviso/);
    }
  });
});
