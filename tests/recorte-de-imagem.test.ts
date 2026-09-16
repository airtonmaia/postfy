import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * O recorte quadrado do avatar, e as quatro maneiras de ele falhar calado.
 *
 * Nenhuma delas quebra `tsc`, o vitest ou o `vite build` — é a família de
 * armadilha que este projeto mais paga. A pior é a primeira: um recorte que
 * acontece **só na tela** parece resolvido e não resolve nada.
 */

const RAIZ = join(__dirname, '..');


const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const recorte = ler('src', 'components', 'ui', 'recorte-quadrado.tsx');
const upload = ler('src', 'components', 'ui', 'file-upload.tsx');
const perfil = ler('src', 'components', 'auth', 'AuthModal.tsx');

describe('o que sobe é o recortado', () => {
  it('o arquivo enviado sai do recorte, não do original', () => {
    /**
     * Guardar o original e cortar só na tela pareceria a mesma coisa e não é:
     * o arquivo grande viajaria em toda leitura, e qualquer lugar que o
     * desenhasse sem `object-cover` mostraria a foto inteira — inclusive o
     * e-mail, que não tem como recortar nada.
     */
    const bloco = upload.slice(upload.indexOf('aoConfirmar={(recortado)'));
    expect(
      bloco.slice(0, 300),
      'o upload voltou a enviar o arquivo original depois do recorte'
    ).toMatch(/enviarParaOArmazenamento\(recortado/);
  });

  it('o original não é enviado quando há recorte pedido', () => {
    // O desvio tem que **voltar** (`return`) antes do envio. Sem isso, sobem
    // os dois: o original primeiro, e o recortado por cima.
    const processa = upload.slice(upload.indexOf('const processFile'));
    const desvio = processa.indexOf('if (recorteQuadrado && !isSvg)');
    const envio = processa.indexOf('void enviarParaOArmazenamento(file, isSvg)');

    expect(desvio, 'o desvio do recorte sumiu de processFile').toBeGreaterThan(-1);
    expect(desvio, 'o desvio ficou depois do envio — o original sobe assim mesmo').toBeLessThan(
      envio
    );
    expect(
      processa.slice(desvio, envio),
      'o desvio deixou de retornar: o original sobe e o recortado sobe por cima'
    ).toMatch(/return;/);
  });

  it('a modal do recorte está na árvore nos dois caminhos', () => {
    /**
     * O estado guarda o arquivo e **nada acontece** sem esta linha: escolher a
     * foto deixa de fazer efeito, sem erro e sem pista. É a mesma família do
     * `useConfirmacao()` sem o `{dialogo}` renderizado.
     *
     * São dois caminhos porque o perfil do próprio usuário não passa pelo
     * `FileUpload` — ele chama `arquivosApi` direto.
     */
    expect(upload, 'o FileUpload guarda o arquivo e não abre o recorte').toMatch(
      /\{aRecortar && \(/
    );
    expect(perfil, 'o perfil guarda a foto e não abre o recorte').toMatch(
      /\{fotoARecortar && \(/
    );
  });
});

describe('o quadrado nunca sai com tarja', () => {
  it('o deslocamento é preso às bordas', () => {
    /**
     * Sem prender, dá para arrastar a foto para fora e confirmar um quadrado
     * com metade vazia — e o vazio vira **preto** no canvas, porque o
     * `drawImage` não desenha onde não há imagem. Nada avisa.
     */
    expect(recorte, 'o arraste deixou de ser preso às bordas do visor').toMatch(
      /Math\.min\(0, Math\.max\(LADO_DO_VISOR - larguraExibida/
    );
    expect(recorte).toMatch(/Math\.min\(0, Math\.max\(LADO_DO_VISOR - alturaExibida/);
  });

  it('o zoom mínimo é o que cobre o visor', () => {
    // `escalaBase` usa o lado **menor**: é o `cover` do CSS escrito à mão.
    // Com o maior, a imagem caberia inteira e sobraria tarja nas laterais.
    expect(recorte, 'a escala base deixou de partir do lado menor').toMatch(
      /LADO_DO_VISOR \/ Math\.min\(origem\.naturalWidth, origem\.naturalHeight\)/
    );
    expect(recorte, 'o zoom passou a aceitar valor abaixo de 1').toMatch(/min=\{1\}/);
  });

  it('o JPEG ganha fundo branco antes do desenho', () => {
    /**
     * O canvas nasce transparente e o JPEG não guarda alfa: um PNG com fundo
     * transparente salvo como JPEG sai com fundo **preto**. Não quebra nada, e
     * ninguém vê antes de a marca aparecer num card branco.
     */
    const gerar = recorte.slice(recorte.indexOf('const gerar ='));
    const fundo = gerar.indexOf('fillRect');
    const desenho = gerar.indexOf('ctx.drawImage');

    expect(fundo, 'o fundo branco do JPEG sumiu — PNG transparente vira preto').toBeGreaterThan(-1);
    expect(fundo, 'o fundo é pintado depois do desenho, e apaga a imagem').toBeLessThan(desenho);
  });

  it('a saída é quadrada', () => {
    const gerar = recorte.slice(recorte.indexOf('const gerar ='));
    expect(gerar).toMatch(/canvas\.width = LADO_DE_SAIDA/);
    expect(gerar).toMatch(/canvas\.height = LADO_DE_SAIDA/);
    // O lado copiado da origem é um só para os dois eixos: com dois valores,
    // um retrato sairia esticado em vez de recortado.
    expect(gerar, 'o recorte deixou de copiar uma área quadrada da origem').toMatch(
      /ladoNaOrigem,\s*ladoNaOrigem,/
    );
  });
});

describe('o recorte é pedido só onde o destino é quadrado', () => {
  it('o vetor entra inteiro', () => {
    /**
     * Recortar um SVG exigiria rasterizar, e um logo em vetor perde
     * exatamente o que o torna a melhor escolha para marca: escala sem borrar.
     * O `file-upload.tsx` chega a mostrar um selo "SVG Vetorial" por isso.
     */
    expect(upload, 'o SVG passou a ser rasterizado pelo recorte').toMatch(
      /recorteQuadrado && !isSvg/
    );
    expect(perfil, 'o SVG do perfil passou a ser rasterizado').toMatch(
      /image\/svg\+xml/
    );
  });

  it('o logo da agência não é recortado', () => {
    /**
     * Ele é desenhado com `object-contain` em toda tela que o mostra — porta
     * do portal, cabeçalho do cliente, lista de agências do admin. É uma
     * marca, muitas vezes deitada; forçar quadrado cortaria o nome dela pela
     * metade, e a pessoa só descobriria abrindo o portal.
     */
    const whitelabel = ler('src', 'components', 'settings', 'tabs', 'SettingsWhitelabel.tsx');
    expect(
      whitelabel,
      'o logo da agência passou a exigir recorte quadrado, e ele é desenhado com object-contain'
    ).not.toMatch(/recorteQuadrado/);
  });

  it('os dois avatares de cliente pedem o recorte', () => {
    for (const [tela, arquivo] of [
      ['cadastro de cliente', join('src', 'components', 'clients', 'ClientsView.tsx')],
      ['ficha do cliente', join('src', 'components', 'clients', 'ClientDetail.tsx')],
    ] as const) {
      expect(
        readFileSync(join(RAIZ, arquivo), 'utf-8'),
        `o avatar do ${tela} deixou de pedir recorte — volta a ser cortado pelo centro`
      ).toMatch(/recorteQuadrado/);
    }
  });
});

describe('o removedor de comentários não come código', () => {
  /**
   * **Esta guarda vale para as 20 guardas que dependem dele.**
   *
   * A versão anterior era `fonte.replace(/\/\*[\s\S]*?\*\//g, '')`, copiada em
   * cada teste. Ela trata **todo** `/*` como abertura de comentário — e
   * `accept="image/*"` tem um, colado no `e` de `image`. A partir dali ela
   * engolia tudo até o primeiro `*` + `/` de verdade, dezenas de linhas abaixo.
   *
   * Medido: **32% do `file-upload.tsx`, 44% do `AuthModal.tsx` e 21% do
   * `MediaUploader.tsx`** sumiam antes de qualquer guarda olhar — justamente
   * os três arquivos que mexem com upload de imagem.
   *
   * E o efeito é o pior possível: **as guardas passavam.** Elas procuram o que
   * não pode existir, e o que não pode existir tinha sido apagado junto. A do
   * `alert()`, a do `<Button>` com conteúdo em bloco e a do `toLocale*` sem
   * fuso estavam cegas para um terço desses arquivos, com o CI verde o tempo
   * todo. É a armadilha 0 dentro da própria rede de proteção.
   */
  it('um tipo MIME com asterisco não abre comentário', () => {
    const fonte = 'const a = "image/*";\nconst naoPodeSumir = 1;\n/* isto some */';
    const limpo = semComentarios(fonte);

    expect(limpo, 'o `image/*` voltou a abrir um comentário falso').toContain('naoPodeSumir');
    expect(limpo, 'o comentário de verdade deixou de ser removido').not.toContain('isto some');
  });

  it('comentário de verdade continua saindo, nas três formas', () => {
    expect(semComentarios('/** doc */\nconst a = 1;')).not.toContain('doc');
    expect(semComentarios('const a = 1;\n{/* jsx */}\nconst b = 2;')).not.toContain('jsx');
    expect(semComentarios('// linha\nconst a = 1;')).not.toContain('linha');
  });

  it('os arquivos de upload chegam inteiros às guardas', () => {
    // O caso real, e não um exemplo: são estes três que têm `image/*`.
    for (const caminho of [
      ['src', 'components', 'ui', 'file-upload.tsx'],
      ['src', 'components', 'auth', 'AuthModal.tsx'],
      ['src', 'components', 'common', 'MediaUploader.tsx'],
    ]) {
      const cru = readFileSync(join(RAIZ, ...caminho), 'utf-8');
      const limpo = semComentarios(cru);
      const sobrou = limpo.length / cru.length;

      expect(
        sobrou,
        `${caminho.at(-1)}: ${Math.round((1 - sobrou) * 100)}% do arquivo sumiu na limpeza ` +
          `de comentários. Acima de ~40% é código indo junto, e as guardas ficam cegas`
      ).toBeGreaterThan(0.6);
    }
  });
});
