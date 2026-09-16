import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * O Facebook é **outro fluxo**, e a armadilha é achar que é o mesmo com outro
 * nome.
 *
 * Publicar numa Página usa o login do Facebook, outro app id, e o token **da
 * Página** — obtido em `/me/accounts`, não o do usuário que o login devolve.
 * E os escopos daqui (`pages_show_list`, `pages_read_engagement`,
 * `pages_manage_posts`) **invalidam a autorização do Instagram** se forem
 * misturados no mesmo pedido.
 *
 * Todas as falhas abaixo têm o mesmo sintoma: erro **depois** de a pessoa já
 * ter digitado a senha, com mensagem que não nomeia a causa. É o que custou
 * quatro rodadas de diagnóstico quando o fluxo errado do Instagram foi
 * escolhido, e é por isso que cada uma tem guarda.
 */

const RAIZ = join(__dirname, '..');


const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

const facebook = ler('api', '_lib', 'facebook.ts');
const instagram = ler('api', '_lib', 'instagram.ts');
const connect = ler('api', 'social-connect.ts');
const callback = ler('api', 'social-callback.ts');
const publicar = ler('api', 'publicar.ts');

describe('os dois fluxos nunca se misturam', () => {
  it('os escopos de Página não entram no fluxo do Instagram', () => {
    /**
     * `pages_show_list` e `pages_read_engagement` fazem a **tela de
     * autorização do Instagram recusar**, e o erro diz "escopo inválido" sem
     * nomear qual. Foi por isso que `api/_lib/meta.ts` foi apagado em vez de
     * virar um parâmetro.
     */
    for (const escopo of ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']) {
      expect(
        semComentarios(instagram),
        `${escopo} entrou no fluxo do Instagram — a autorização passa a ser recusada ` +
          `depois do login, com um erro que não nomeia o escopo`
      ).not.toContain(escopo);
    }
  });

  it('o Instagram não fala com graph.facebook.com, nem o contrário', () => {
    // Os hosts são a assinatura de qual fluxo é qual. Trocar um pelo outro
    // devolve 400 sem explicar nada.
    expect(semComentarios(instagram)).not.toContain('graph.facebook.com');
    expect(semComentarios(facebook)).not.toContain('graph.instagram.com');
    expect(semComentarios(facebook)).not.toContain('api.instagram.com');
  });

  it('cada rede lê o app id do próprio app', () => {
    /**
     * `FACEBOOK_APP_ID` não é `INSTAGRAM_APP_ID`: são apps diferentes no mesmo
     * painel da Meta. Usar um no lugar do outro falha depois do login, com
     * mensagem que não nomeia a causa.
     */
    for (const fonte of [connect, callback]) {
      expect(fonte).toMatch(/FACEBOOK_APP_ID/);
      expect(fonte).toMatch(/INSTAGRAM_APP_ID/);
      expect(
        semComentarios(fonte),
        'a escolha do app id deixou de depender da rede'
      ).toMatch(/rede === 'facebook'/);
    }
  });
});

describe('a rede viaja no estado assinado', () => {
  it('o callback lê a rede do estado, não da query', () => {
    /**
     * Quem chega no retorno veio da Meta, **sem sessão**. Uma `rede` na URL
     * seria escolhida por quem quisesse: o retorno do Instagram cairia no
     * fluxo do Facebook, que bate em outro endpoint com outro segredo, e o
     * erro sairia como "código inválido" — que não aponta para nada.
     */
    const corpo = semComentarios(callback);
    expect(corpo, 'a rede passou a vir da query do retorno').toMatch(
      /const rede = dados\.rede/
    );
    expect(corpo).not.toMatch(/searchParams\.get\(['"]rede['"]\)/);
  });

  it('a rede só é lida depois de a assinatura conferir', () => {
    // Lida antes, ela viria de um estado que ainda pode ser forjado — e a
    // escolha do app secret sairia do que o atacante mandou.
    const corpo = semComentarios(callback);
    expect(corpo.indexOf('conferirEstado(estado, segredo)')).toBeLessThan(
      corpo.indexOf('const rede = dados.rede')
    );
  });
});

describe('o token guardado é o da Página', () => {
  it('o callback troca o token do usuário pelo da Página', () => {
    /**
     * O login devolve o token **do usuário**, que só serve para listar as
     * Páginas. Guardar ele faz a publicação falhar com "permissão
     * insuficiente" depois de a conexão já parecer pronta — o pior momento
     * para descobrir.
     */
    expect(semComentarios(callback)).toMatch(/paginasDoUsuario\(/);
    expect(semComentarios(callback)).toMatch(/tokenDaPagina/);
  });

  it('sem Página administrada, a conexão recusa em vez de gravar vazio', () => {
    expect(semComentarios(callback)).toMatch(/if \(!paginas\.length\)/);
  });
});

describe('publicar despacha pela rede da conexão', () => {
  it('o cron chama o publicador certo', () => {
    /**
     * A âncora é o **despacho**, não a forma de escrevê-lo.
     *
     * A primeira versão exigia o ternário literal
     * `conexao.platform === 'facebook' ? publicarNoFacebook`, e reprovou
     * quando o bloco virou um `if` — porque o caminho do Instagram passou a
     * ter dois passos (feed e story) e não cabia mais numa expressão.
     *
     * O comportamento não mudou, só a sintaxe. Guarda presa à forma obriga a
     * editá-la junto com o código, e editar a guarda junto com o código é como
     * ela deixa de guardar.
     */
    const corpo = semComentarios(publicar);
    const inicio = corpo.indexOf("conexao.platform === 'facebook'");
    expect(inicio, 'o despacho por rede saiu de publicarItem').toBeGreaterThan(-1);

    /**
     * O fim do trecho é **estrutural**, não um número de caracteres.
     *
     * A primeira versão desta âncora recortava 260 caracteres a partir do
     * `if`, e quebrou na entrega seguinte: o bloco que recusa feed+story no
     * Facebook entrou antes da chamada e empurrou ela para fora da janela.
     * Guarda medida em caracteres envelhece a cada linha acrescentada — o
     * limite certo é onde o próximo caminho começa.
     */
    const ramoDoFacebook = corpo.slice(inicio, corpo.indexOf('publicarNoInstagram(', inicio));

    expect(
      ramoDoFacebook,
      'a rede facebook deixou de cair no publicador do Facebook'
    ).toMatch(/publicarNoFacebook\(/);
    expect(corpo, 'o publicador do Instagram saiu do caminho').toMatch(
      /publicarNoInstagram\(/
    );
  });

  it('rede fora das duas continua sendo recusada', () => {
    // O cinto: mesmo que a fila receba um item de outra rede, a rota não
    // tenta publicar às cegas.
    expect(semComentarios(publicar)).toMatch(
      /conexao\.platform !== 'instagram' && conexao\.platform !== 'facebook'/
    );
  });

  it('a medição de métrica continua só do Instagram', () => {
    /**
     * `buscarMetricas` fala com `graph.instagram.com`. Medir um post de Página
     * por ali falha sempre, e encheria `ultimo_erro` de falha previsível —
     * escondendo as reais no meio.
     */
    const corpo = semComentarios(publicar);
    const medicao = corpo.slice(corpo.indexOf('const atualizarMetricas'));

    /**
     * Ancorada em `data: aMedir`, que é a **fila de medição** — e não no
     * primeiro `.from('post_metrics')`, que é o upsert do *backfill*, nem em
     * qualquer `.eq('platform', ...)` do arquivo.
     *
     * As duas âncoras erradas foram tentadas antes desta, e cada uma passou
     * com a fila sem filtro nenhum: a primeira casava com o filtro de
     * `social_connections`, a segunda com o upsert logo acima. Guarda que casa
     * com a linha errada é pior que guarda nenhuma — ela dá a impressão de
     * cobrir o que não cobre.
     */
    const fila = medicao.slice(medicao.indexOf('data: aMedir'));
    expect(
      fila.slice(0, 400),
      'a fila de medição deixou de filtrar por Instagram e vai tentar medir Página do Facebook'
    ).toMatch(/\.eq\('platform', 'instagram'\)/);
  });
});

describe('a tela não promete o que não está configurado', () => {
  it('a rota recusa com o nome da variável quando falta credencial', () => {
    // A regra da aba Integrações: quem depende de configuração externa diz o
    // que falta, com nome — nunca finge sucesso.
    expect(connect).toMatch(/FACEBOOK_APP_ID, /);
    expect(connect).toMatch(/SOCIAL_NOT_CONFIGURED/);
  });

  it('o /api/status reporta o par do Facebook separado do Instagram', () => {
    const status = ler('api', 'status.ts');
    expect(status).toMatch(/facebook: temTodas\('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'\)/);
  });

  it('o .env.example avisa que é outro app', () => {
    const env = ler('.env.example');
    expect(env).toMatch(/FACEBOOK_APP_ID/);
    expect(env).toMatch(/FACEBOOK_APP_SECRET/);
  });
});
