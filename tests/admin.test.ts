import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  CAMINHOS,
  CAMINHO_ADMIN,
  ABA_INICIAL_ADMIN,
  ehAbaDeAdmin,
  abaDoCaminho,
  caminhoDaAba,
} from '../src/lib/rotas';
import { podeAcessarAba } from '../src/lib/permissions';
import type { TabType } from '../src/types';

/**
 * A área do dono do produto.
 *
 * As telas do SaaS eram um submenu dentro da barra lateral da agência, e o
 * que decidia se apareciam era `isSuperAdmin` espalhado no JSX. Agora elas
 * vivem em `/admin`, com casca própria — e a troca de casca é feita por um
 * `startsWith('admin_')`. Um prefixo errado não quebra tipo nem build: só
 * monta a tela do dono do produto dentro do app da agência, ou o contrário.
 */
describe('rotas de /admin', () => {
  const abasDeAdmin = (Object.keys(CAMINHOS) as TabType[]).filter(ehAbaDeAdmin);

  it('são as nove telas pedidas', () => {
    expect(abasDeAdmin.sort()).toEqual([
      'admin_agencias',
      'admin_design',
      'admin_emails',
      'admin_financeiro',
      'admin_integracoes',
      'admin_planos',
      'admin_relatorios',
      'admin_seo',
      'admin_usuarios',
    ]);
  });

  it('toda tela de admin mora sob /admin', () => {
    for (const aba of abasDeAdmin) {
      expect(CAMINHOS[aba], aba).toMatch(/^\/admin\//);
    }
  });

  it('nenhuma tela da agência mora sob /admin', () => {
    // O caminho é o que decide a casca. Uma tela da agência em `/admin/...`
    // abriria dentro da área do produto, sem seletor de agência e sem
    // filtro de clientes.
    const invasoras = (Object.keys(CAMINHOS) as TabType[]).filter(
      (aba) => !ehAbaDeAdmin(aba) && CAMINHOS[aba].startsWith('/admin')
    );
    expect(invasoras).toEqual([]);
  });

  it('/admin sozinho abre a primeira tela', () => {
    // É um endereço que a pessoa digita. Sem isto ele cairia em "caminho
    // desconhecido" e a URL seria trocada pela do Dashboard.
    expect(abaDoCaminho(CAMINHO_ADMIN)).toBe(ABA_INICIAL_ADMIN);
    expect(abaDoCaminho('/admin/')).toBe(ABA_INICIAL_ADMIN);
    expect(ehAbaDeAdmin(ABA_INICIAL_ADMIN)).toBe(true);
  });

  it('ida e volta em toda tela de admin', () => {
    for (const aba of abasDeAdmin) {
      expect(abaDoCaminho(caminhoDaAba(aba)), aba).toBe(aba);
    }
  });

  /**
   * Os endereços antigos continuam abrindo.
   *
   * As telas moraram em `/super-admin/*` por uma versão. São poucos links, de
   * uma pessoa só — e quebrar um favorito para economizar seis linhas é troca
   * ruim.
   */
  it('os endereços antigos de /super-admin ainda resolvem', () => {
    expect(abaDoCaminho('/super-admin/planos')).toBe('admin_planos');
    expect(abaDoCaminho('/super-admin/financeiro')).toBe('admin_financeiro');
    expect(abaDoCaminho('/super-admin/agencias')).toBe('admin_agencias');
    expect(abaDoCaminho('/super-admin/emails')).toBe('admin_emails');
    expect(abaDoCaminho('/super-admin/integracoes')).toBe('admin_integracoes');
    expect(abaDoCaminho('/super-admin/usuarios')).toBe('admin_usuarios');
  });

  it('mas nada gera endereço antigo', () => {
    for (const caminho of Object.values(CAMINHOS)) {
      expect(caminho).not.toMatch(/^\/super-admin/);
    }
  });
});

/**
 * Papel na agência ≠ administrador da plataforma.
 *
 * `gerenciar_saas` já viveu no papel `owner`, que a RPC `criar_agencia` dá a
 * todo mundo que se cadastra: na prática, cada cliente novo enxergava o menu
 * de gestão do produto.
 */
describe('autorização da área /admin', () => {
  it('nenhum papel de agência abre tela de admin', () => {
    const papeis = [
      'owner', 'admin', 'manager', 'social_media',
      'designer', 'copywriter', 'financial', 'client',
    ] as const;

    const abasDeAdmin = (Object.keys(CAMINHOS) as TabType[]).filter(ehAbaDeAdmin);

    for (const papel of papeis) {
      for (const aba of abasDeAdmin) {
        expect(podeAcessarAba(papel, aba), `${papel} não abre ${aba}`).toBe(false);
      }
    }
  });

  it('a casca confere platform_admins, e não o papel', () => {
    const layout = readFileSync('src/components/admin/AdminLayout.tsx', 'utf-8');
    expect(layout).toMatch(/isPlatformAdmin/);
    // Recusa explicada, e não redirecionamento calado: mandar a pessoa para o
    // Dashboard esconderia o link errado e sugeriria que /admin não existe.
    expect(layout).not.toMatch(/setActiveTab\(ABA_INICIAL\);\s*return null/);
    expect(layout).toMatch(/platform_admins/);
  });

  it('a troca de casca acontece antes de montar o app da agência', () => {
    const app = readFileSync('src/App.tsx', 'utf-8');
    // Se a área do produto fosse montada dentro do `main`, viria junto a
    // barra lateral da agência, o seletor de clientes e o "Novo Conteúdo".
    const troca = app.indexOf('ehAbaDeAdmin(activeTab)');
    const barraLateral = app.indexOf('<aside');
    expect(troca).toBeGreaterThan(0);
    expect(troca).toBeLessThan(barraLateral);
  });

  it('o botão de acesso só aparece para o admin da plataforma', () => {
    const app = readFileSync('src/App.tsx', 'utf-8');
    expect(app).toMatch(/\{isPlatformAdmin && \([\s\S]{0,600}admin_agencias/);
  });
});

/**
 * A configuração do produto é uma linha só, e só o dono do SaaS escreve.
 *
 * O que está nela é público por definição — vai impresso na tela de entrada.
 * O que não pode acontecer é a tabela inteira ficar legível por sessão
 * anônima: no dia em que alguém acrescentar uma coluna que não deveria sair,
 * o `select *` já estaria liberado.
 */
describe('aparência do produto', () => {
  const sql = readFileSync(
    'supabase/migrations/20260910120000_aparencia_do_saas.sql',
    'utf-8'
  );

  it('a linha é única no banco, não por convenção', () => {
    expect(sql).toMatch(/unica boolean primary key/);
    expect(sql).toMatch(/constraint saas_settings_linha_unica check \(unica\)/);
  });

  it('cor e endereço são validados pelo banco', () => {
    // Estes valores vão para `style` e para `src` de <img> numa tela pública.
    // A tela também valida, mas a tela é o que se contorna.
    expect(sql).toMatch(/cor_primaria ~ '\^#\[0-9a-fA-F\]\{6\}\$'/);
    expect(sql).toMatch(/banner_login_url\s+~ '\^\(https\?:\/\/\|\/\)'/);
  });

  it('só o admin da plataforma escreve', () => {
    expect(sql).toMatch(/for update[\s\S]{0,120}private\.eh_admin_da_plataforma\(\)/);
    expect(sql).toMatch(/for select[\s\S]{0,80}private\.eh_admin_da_plataforma\(\)/);
  });

  it('a leitura pública passa por função de lista fechada', () => {
    // anon precisa: a tela de entrada é anônima por definição.
    expect(sql).toMatch(/grant execute on function public\.aparencia_do_saas\(\) to anon/);
    expect(sql).toContain("set search_path = ''");
    // `updated_by` é o uuid de uma pessoa e não sai numa resposta pública.
    const funcao = sql.slice(sql.indexOf('create or replace function public.aparencia_do_saas'));
    expect(funcao).not.toMatch(/'updated_by'/);
    expect(funcao).not.toMatch(/select\s+s\.\*/i);
  });

  it('os números do SaaS só devolvem contagem', () => {
    const numeros = readFileSync(
      'supabase/migrations/20260910130000_numeros_do_saas.sql',
      'utf-8'
    );
    expect(numeros).toMatch(/if not private\.eh_admin_da_plataforma\(\)/);
    expect(numeros).toMatch(/revoke all on function public\.admin_numeros_do_saas\(\) from public, anon/);
    // Contagem, e não conteúdo: o dono do SaaS sabe o tamanho da base sem ler
    // o que as agências dos clientes escreveram.
    expect(numeros).not.toMatch(/j\.title|c\.name|u\.email/);
  });
});

/**
 * A tela de SEO não promete o que a SPA não entrega.
 *
 * Meta tag injetada por JavaScript alcança o navegador e o Google. Não
 * alcança o robô do WhatsApp, do Facebook ou do LinkedIn, que baixam o HTML
 * cru e vão embora. Sem a rota que responde a eles, esta tela seria a mesma
 * mentira do Financeiro que somava agências vezes R$ 197.
 */
describe('SEO alcança quem a tela diz que alcança', () => {
  it('existe a rota que responde aos robôs de prévia', () => {
    const rota = readFileSync('api/seo.ts', 'utf-8');
    expect(rota).toMatch(/og:title/);
    expect(rota).toMatch(/og:description/);
    expect(rota).toMatch(/robots\.txt/);
    // O conteúdo vem do banco e é concatenado em HTML: uma aspa numa
    // descrição fecharia o atributo e o resto viraria marcação.
    expect(rota).toMatch(/const escapar/);
    expect(rota).toMatch(/replace\(\/"\/g, '&quot;'\)/);
  });

  it('a tela diz por onde cada caminho chega', () => {
    const seo = readFileSync('src/components/admin/AdminSeoView.tsx', 'utf-8');
    expect(seo).toMatch(/WhatsApp/);
    expect(seo).toMatch(/api\/seo/);
  });

  it('as duas pontas leem os mesmos campos', () => {
    // Uma prévia que diz uma coisa e uma aba que diz outra é pior que
    // nenhuma das duas.
    const rota = readFileSync('api/seo.ts', 'utf-8');
    const componente = readFileSync('src/components/common/SeoDoSaas.tsx', 'utf-8');
    expect(rota).toMatch(/aparencia_do_saas/);
    expect(componente).toMatch(/seoTitulo/);
    expect(componente).toMatch(/seoDescricao/);
    expect(componente).toMatch(/seoImagemUrl/);
  });
});
