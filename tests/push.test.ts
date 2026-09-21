import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios, semComentariosSql } from './util/semComentarios';

/**
 * Web Push e PWA.
 *
 * Quase tudo aqui falha do mesmo jeito: **em silêncio, longe de quem mexeu**.
 * Service worker não registrado não dá erro; ícone que falta não quebra
 * build; `setVapidDetails` no lugar errado derruba a rota inteira antes da
 * primeira linha. Nenhuma ferramenta local acusa nenhum dos três.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf-8');

const publicar = semComentarios(ler('api', 'publicar.ts'));
const push = semComentarios(ler('api', '_lib', 'push.ts'));
const sw = semComentarios(ler('public', 'sw.js'));
const clientePush = semComentarios(ler('src', 'lib', 'push.ts'));

describe('o push sai em toda passada, não só quando há o que publicar', () => {
  it('empurrar vem antes do return antecipado da fila', () => {
    /**
     * **Este é o erro que a guarda existe para pegar, e ele é fácil de
     * cometer.** `api/publicar.ts` tem um `return` logo depois de ler a
     * `publish_queue`, para quando não há nada agendado — que é o estado
     * normal da rota na imensa maioria das passadas.
     *
     * Empurrar depois dele faria a notificação sair **só** nos cinco minutos
     * em que por acaso houvesse um post para publicar. Funcionaria no teste,
     * com um item na fila, e não funcionaria no uso — sem erro em lugar
     * nenhum, que é a pior forma de quebrar.
     */
    const chamada = publicar.indexOf('empurrarNotificacoes(');
    const returnAntecipado = publicar.indexOf('return json({ processados: 0');

    expect(chamada, 'o push sumiu do cron').toBeGreaterThan(-1);
    expect(returnAntecipado, 'o return antecipado da fila sumiu — confira esta guarda').toBeGreaterThan(-1);
    expect(
      chamada,
      'o push passou a sair depois do return antecipado: ele só aconteceria ' +
        'nas passadas em que houvesse conteúdo agendado'
    ).toBeLessThan(returnAntecipado);
  });

  it('a rota devolve o resumo do push nos dois caminhos', () => {
    // Sem isso, "o push saiu?" vira uma pergunta sem resposta — e esta rota é
    // chamada por um cron que ninguém olha.
    expect(publicar).toContain('return json({ processados: 0, renovadas, email, push })');
    expect(publicar.slice(publicar.indexOf('metricas,'))).toBeTruthy();
    expect(publicar, 'o resumo do push saiu da resposta final').toMatch(/push,\s*\n\s*metricas,/);
  });
});

describe('o envio não pode derrubar a publicação', () => {
  it('setVapidDetails não roda no topo do módulo', () => {
    /**
     * Ele **lança** quando a chave é inválida ou o e-mail não tem esquema. No
     * topo do arquivo, esse throw acontece no *import* — e mata
     * `api/publicar.ts` inteiro antes da primeira linha, com
     * `FUNCTION_INVOCATION_FAILED` e sem corpo. A publicação pararia por
     * causa de uma variável de push mal preenchida. É a armadilha 0 na
     * camada do módulo.
     */
    const posicao = push.indexOf('webpush.setVapidDetails');
    const dentroDeFuncao = push.indexOf('const configurar');

    expect(posicao, 'setVapidDetails sumiu').toBeGreaterThan(-1);
    expect(
      posicao,
      'setVapidDetails saiu de dentro da função: um throw no import derruba o cron inteiro'
    ).toBeGreaterThan(dentroDeFuncao);
    expect(dentroDeFuncao, 'a função que configura o VAPID sumiu').toBeGreaterThan(-1);
  });

  it('a inscrição morta é apagada em 404 e 410', () => {
    /**
     * O navegador descarta a inscrição quando a pessoa limpa os dados do
     * site, reinstala o app ou revoga a permissão. A partir daí todo envio
     * para aquele endpoint falha, para sempre. Sem apagar, a tabela vira um
     * cemitério relido a cada cinco minutos e a taxa de falha sobe até
     * esconder as falhas que importam.
     */
    expect(push, 'o 404/410 deixou de remover a inscrição').toMatch(
      /status === 404 \|\| status === 410/
    );
    expect(push).toContain("from('push_subscriptions').delete()");
  });

  it('a marca avança mesmo quando nada foi entregue', () => {
    // Mesma razão de `post_metrics.medido_em`: a fila é ordenada por ela, e
    // uma linha que não avança é retentada em toda passada e segura todas as
    // outras atrás dela. A entrega para sem dar erro visível.
    expect(push, 'o push_enviado_em deixou de ser carimbado').toContain('push_enviado_em');

    const marca = push.indexOf("update({ push_enviado_em");
    const fimDoLeque = push.lastIndexOf('for (const inscricao of');
    expect(marca, 'o carimbo sumiu').toBeGreaterThan(-1);
    expect(
      marca,
      'o carimbo entrou no laço dos dispositivos: sem dispositivo nenhum, o ' +
        'aviso ficaria pendente para sempre'
    ).toBeGreaterThan(fimDoLeque);
  });
});

describe('quem recebe sai de workspace_members, não da inscrição', () => {
  const migracao = semComentariosSql(
    readdirSync(join(RAIZ, 'supabase', 'migrations'))
      .filter((f) => f.endsWith('_web_push.sql'))
      .map((f) => readFileSync(join(RAIZ, 'supabase', 'migrations', f), 'utf-8'))
      .join('\n')
  );

  it('a migração do push foi encontrada', () => {
    expect(migracao, 'a migração do web push sumiu').toContain('push_subscriptions');
  });

  it('a inscrição não guarda agência', () => {
    /**
     * **Guardar `workspace_id` na inscrição abriria um buraco.** A política
     * natural é `auth.uid() = user_id` — e com ela qualquer pessoa gravaria
     * uma linha apontando para a agência de **outro** e passaria a receber
     * os avisos dela. Quem decide o destinatário é `workspace_members`, lido
     * no envio com a chave de serviço.
     */
    const tabela = migracao.slice(
      migracao.indexOf('create table if not exists public.push_subscriptions'),
      migracao.indexOf(');', migracao.indexOf('create table if not exists public.push_subscriptions'))
    );
    expect(tabela, 'a tabela do push voltou a guardar a agência na inscrição').not.toContain(
      'workspace_id'
    );
    expect(push, 'o envio deixou de resolver o destinatário por workspace_members').toContain(
      "from('workspace_members')"
    );
  });

  it('a RLS é por dono', () => {
    expect(migracao).toMatch(/auth\.uid\(\)\) = user_id/);
  });

  it('o acervo nasce marcado, senão a estreia é um despejo', () => {
    /**
     * Sem o backfill, a primeira passada do cron empurraria toda notificação
     * que a agência já tem — dezenas de avisos velhos de uma vez, no celular
     * de todo mundo. Ruído na estreia é o que faz a pessoa desligar a
     * permissão e não voltar.
     */
    expect(migracao, 'o backfill que marca o acervo como já empurrado sumiu').toMatch(
      /update public\.notifications[\s\S]*set push_enviado_em = now\(\)[\s\S]*where push_enviado_em is null/
    );
  });
});

describe('o app é instalável', () => {
  const seo = semComentarios(ler('api', 'seo.ts'));
  const html = ler('index.html');

  it('não existe manifest estático em public/', () => {
    /**
     * **Esta é a guarda central desta entrega.** O manifest passou a ser
     * montado por `api/seo.ts`, do que o dono do produto configurou em
     * Admin → Design.
     *
     * Na Vercel o sistema de arquivos é consultado **antes** dos `rewrites`.
     * Um `public/manifest.webmanifest` de volta venceria o desvio, e o app
     * instalado continuaria com o nome e o ícone do repositório — com a tela
     * de Design dizendo que salvou, e sem erro em lugar nenhum.
     *
     * Medido em produção: `/portal-hero.jpg` (que existe em `public/`)
     * responde `image/jpeg`; um caminho que não existe cai no coringa e volta
     * `text/html`.
     */
    expect(
      existsSync(join(RAIZ, 'public', 'manifest.webmanifest')),
      'o manifest estático voltou: ele vence o rewrite e anula a personalização'
    ).toBe(false);
  });

  it('o rewrite do manifest existe e vem antes do coringa', () => {
    /**
     * A Vercel avalia de cima para baixo e para no primeiro que casa. Abaixo
     * do coringa `/((?!api/).*)`, o manifest voltaria como `index.html` — e
     * navegador nenhum instala o app com `text/html` no lugar dele.
     */
    const fontes = JSON.parse(ler('vercel.json')).rewrites.map(
      (r: { source: string }) => r.source
    );
    const manifesto = fontes.indexOf('/manifest.webmanifest');
    const coringa = fontes.findIndex((f: string) => f.includes('(?!api/)'));

    expect(manifesto, 'o rewrite do manifest sumiu do vercel.json').toBeGreaterThan(-1);
    expect(coringa, 'o coringa sumiu do vercel.json — confira esta guarda').toBeGreaterThan(-1);
    expect(manifesto, 'o rewrite do manifest caiu abaixo do coringa').toBeLessThan(coringa);
  });

  it('a rota serve o manifest com os dois tamanhos e o tipo certo', () => {
    expect(seo, 'a rota deixou de servir o manifest').toContain("'/manifest.webmanifest'");
    expect(seo, 'o content-type do manifest mudou').toContain('application/manifest+json');
    for (const exigido of ["'192x192'", "'512x512'"]) {
      expect(seo, `o manifest ficou sem o ícone ${exigido}`).toContain(exigido);
    }
    expect(seo, 'sem display standalone o app abre como aba comum').toContain("'standalone'");
  });

  it('o ícone de reserva existe como arquivo', () => {
    /**
     * Sem ícone configurado valem os arquivos do repositório, e eles precisam
     * estar lá: manifest sem 192 e 512 faz o navegador não oferecer a
     * instalação, e o dono concluiria que o campo quebrou o app.
     */
    for (const arquivo of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      const caminho = join(RAIZ, 'public', arquivo);
      expect(existsSync(caminho), `${arquivo} é a reserva do manifest e não existe`).toBe(true);
      expect(statSync(caminho).size, `${arquivo} está vazio`).toBeGreaterThan(500);
    }
  });

  it('o que o dono configura chega à tela', () => {
    /**
     * `aparencia_do_saas` é **lista fechada**: coluna nova não nasce visível,
     * ao contrário de `portal_dados`. O preço é este — quem acrescenta coluna
     * e esquece da função vê o campo salvar no banco e nunca aparecer, sem
     * erro nenhum.
     */
    const migracoes = readdirSync(join(RAIZ, 'supabase', 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let corpo = '';
    for (const arquivo of migracoes) {
      const sql = semComentariosSql(readFileSync(join(RAIZ, 'supabase', 'migrations', arquivo), 'utf-8'));
      const inicio = sql.indexOf('function public.aparencia_do_saas');
      if (inicio === -1) continue;
      const fim = sql.indexOf('\n$$;', inicio);
      corpo = sql.slice(inicio, fim === -1 ? undefined : fim);
    }

    expect(corpo, 'aparencia_do_saas sumiu das migrações').toContain('jsonb_build_object');

    const mapper = semComentarios(ler('src', 'lib', 'aparencia.ts'));
    for (const coluna of ['pwa_icone_url', 'pwa_nome_curto', 'pwa_cor_fundo']) {
      expect(
        corpo,
        `"${coluna}" não está na lista fechada: o campo salva e nunca aparece`
      ).toContain(coluna);
      // Ida e volta: sem a ida o clique não grava, sem a volta a tela mostra
      // o padrão e o próximo salvar escreve por cima da escolha.
      expect(
        mapper.split(coluna).length - 1,
        `"${coluna}" precisa aparecer na leitura e na escrita da aparência`
      ).toBeGreaterThan(1);
    }
  });

  it('o iPhone tem o ícone dele, e ele é parte do caminho do push', () => {
    /**
     * O iOS ignora os ícones do manifest. E aqui não é aparência: no iPhone o
     * Web Push **só existe** com o app adicionado à tela de início, então o
     * `apple-touch-icon` faz parte do caminho da notificação.
     */
    expect(html, 'o apple-touch-icon saiu do index.html').toContain('apple-touch-icon');
    expect(existsSync(join(RAIZ, 'public', 'apple-touch-icon.png'))).toBe(true);
    expect(html, 'o link do manifest saiu do index.html').toContain('rel="manifest"');
  });

  it('o service worker tem handler de fetch', () => {
    /**
     * O Chrome só oferece a instalação quando há um SW com handler de
     * `fetch`. Sem ele, o manifest está certo, o ícone está certo, e o
     * convite simplesmente nunca aparece — sem erro, sem console, sem nada.
     */
    expect(sw, 'o handler de fetch saiu: o app deixa de ser instalável').toMatch(
      /addEventListener\('fetch'/
    );
  });

  it('o service worker é registrado no carregamento', () => {
    // Registrar só ao ligar notificação faria o convite de instalar aparecer
    // apenas para quem passou por Preferências. Quem quer o ícone na tela de
    // início não passa por lá.
    const main = semComentarios(ler('src', 'main.tsx'));
    expect(main, 'o registro do service worker saiu do carregamento').toContain(
      "serviceWorker.register('/sw.js')"
    );
  });

  it('o service worker não cacheia', () => {
    /**
     * Um SW que guarda o app em cache muda o jogo do deploy: a pessoa passa a
     * rodar a versão guardada, e o `AvisoDeAtualizacao` — que compara a build
     * do servidor com a da aba — passaria a comparar contra o que o próprio
     * SW serve. O sintoma seria botão que sumiu e tela que mudou de lugar,
     * com cara de bug.
     */
    expect(sw, 'entrou cache no service worker').not.toMatch(/caches\.(open|match)/);
    expect(sw, 'o handler de fetch passou a responder: isso é cache').not.toContain('respondWith');
  });
});

describe('a inscrição no navegador', () => {
  it('não passa por rota nova', () => {
    /**
     * `api/` está em 12 de 12 funções do plano Hobby, e a 13ª não dá erro de
     * código: `tsc`, vitest e build ficam verdes e o **deploy inteiro falha**
     * (armadilha 6). A RLS por dono torna a rota desnecessária — ela era
     * exigência do framework do plano original, não do Web Push.
     */
    expect(clientePush, 'a inscrição voltou a passar por uma rota').not.toMatch(
      /fetch\(['"`]\/api\/push/
    );
    expect(clientePush, 'a inscrição deixou de ser gravada no Supabase').toContain(
      "from('push_subscriptions')"
    );

    const rotas = readdirSync(join(RAIZ, 'api')).filter((f) => f.endsWith('.ts'));
    expect(rotas.length, `api/ passou de 12 funções: ${rotas.join(', ')}`).toBeLessThanOrEqual(12);
  });

  it('userVisibleOnly é sempre true', () => {
    // Com `false` o navegador recusa a inscrição inteira — e o erro sai na
    // cara de quem clicou em "Ativar notificações".
    expect(clientePush).toContain('userVisibleOnly: true');
  });

  it('a permissão é pedida a partir de um clique, nunca ao carregar', () => {
    /**
     * A caixa aparecendo sozinha é o caminho mais curto para a pessoa clicar
     * em "bloquear" — e essa decisão é difícil de desfazer: depois dela o
     * site não pode nem perguntar de novo.
     */
    const main = semComentarios(ler('src', 'main.tsx'));
    expect(main, 'a permissão passou a ser pedida no carregamento').not.toContain(
      'requestPermission'
    );

    const tela = semComentarios(
      ler('src', 'components', 'settings', 'tabs', 'SettingsPreferences.tsx')
    );
    expect(tela, 'o botão que liga as notificações sumiu da tela').toContain('ativarNotificacoes');
  });

  it('a tela diz o que fazer no iPhone', () => {
    /**
     * No iPhone o push só existe com o app na tela de início. Sem a frase, o
     * botão não faz nada lá e quem clica conclui que o produto está quebrado.
     */
    expect(clientePush, 'a detecção de iPhone sem instalar sumiu').toContain('ehIosSemInstalar');
    const tela = ler('src', 'components', 'settings', 'tabs', 'SettingsPreferences.tsx');
    expect(tela, 'a instrução do iPhone sumiu da tela').toMatch(/Tela de Início/i);
  });
});

describe('a dependência chega ao CI', () => {
  it('web-push está em dependencies e no lockfile do bun', () => {
    /**
     * O CI instala com `bun install --frozen-lockfile`. Acrescentar a
     * dependência ao `package.json` sem atualizar o `bun.lock` **reprova o
     * CI** — e a máquina de quem escreveu isto não tinha bun, que é
     * exatamente como esse descompasso nasce.
     */
    const pacote = JSON.parse(ler('package.json'));
    expect(pacote.dependencies['web-push'], 'web-push saiu de dependencies').toBeTruthy();
    expect(ler('bun.lock'), 'o bun.lock não conhece web-push: o CI reprova').toContain('web-push');
  });
});
