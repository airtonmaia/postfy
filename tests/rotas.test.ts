import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

import {
  CAMINHOS,
  ABA_INICIAL,
  ABAS_DE_CONFIGURACOES,
  abaDoCaminho,
  caminhoDaAba,
  subAbaDeConfiguracoes,
  urlDaAba,
} from '../src/lib/rotas';
import type { TabType } from '../src/types';

/**
 * A navegação era só estado em memória: a URL nunca mudava, o F5 devolvia a
 * pessoa para o Dashboard e não havia como mandar link de tela.
 *
 * O que quebra aqui não aparece na tela: um caminho duplicado manda duas abas
 * para o mesmo lugar, e uma aba sem caminho vira uma URL que não volta.
 */
describe('mapa de rotas', () => {
  const abas = Object.keys(CAMINHOS) as TabType[];

  it('ida e volta em toda aba', () => {
    for (const aba of abas) {
      expect(abaDoCaminho(caminhoDaAba(aba)), aba).toBe(aba);
    }
  });

  it('nenhum caminho repetido', () => {
    const caminhos = Object.values(CAMINHOS);
    expect(new Set(caminhos).size).toBe(caminhos.length);
  });

  it('todo caminho começa com barra e é minúsculo', () => {
    for (const [aba, caminho] of Object.entries(CAMINHOS)) {
      expect(caminho, aba).toMatch(/^\/[a-z0-9/-]+$/);
    }
  });

  /**
   * O tipo garante a exaustividade em tempo de compilação, mas só se alguém
   * mexer no arquivo certo. Este teste pega a aba nova que foi adicionada ao
   * tipo e esquecida aqui — que geraria uma URL inexistente.
   */
  it('toda aba do tipo TabType tem caminho', () => {
    const fonte = readFileSync('src/types/index.ts', 'utf-8');
    const bloco = fonte.slice(fonte.indexOf('export type TabType'));
    const doTipo = (bloco.slice(0, bloco.indexOf(';')).match(/'([a-z_]+)'/g) || []).map((s) =>
      s.replace(/'/g, '')
    );

    expect(doTipo.length).toBeGreaterThan(0);
    expect(doTipo.filter((aba) => !(aba in CAMINHOS))).toEqual([]);
  });

  it('a raiz abre a tela inicial', () => {
    expect(abaDoCaminho('/')).toBe(ABA_INICIAL);
    expect(abaDoCaminho('')).toBe(ABA_INICIAL);
  });

  it('caminho desconhecido não vira aba', () => {
    // Vira null para o app decidir; cair calado no dashboard esconderia o
    // link errado em vez de corrigi-lo.
    expect(abaDoCaminho('/nao-existe')).toBeNull();
    expect(abaDoCaminho('/super-admin')).toBeNull();
  });

  it('tolera barra no fim, query, hash e maiúscula', () => {
    expect(abaDoCaminho('/kanban/')).toBe('producao');
    expect(abaDoCaminho('/kanban?x=1')).toBe('producao');
    expect(abaDoCaminho('/kanban#topo')).toBe('producao');
    expect(abaDoCaminho('/Kanban')).toBe('producao');
  });
});

describe('sub-abas de configurações', () => {
  it('ida e volta em toda sub-aba', () => {
    for (const sub of ABAS_DE_CONFIGURACOES) {
      const caminho = caminhoDaAba('configuracoes', sub);
      expect(abaDoCaminho(caminho), sub).toBe('configuracoes');
      expect(subAbaDeConfiguracoes(caminho), sub).toBe(sub);
    }
  });

  it('configuracoes sem sub-aba abre a primeira', () => {
    expect(subAbaDeConfiguracoes('/configuracoes')).toBe('overview');
  });

  it('sub-aba desconhecida não gera URL quebrada', () => {
    expect(caminhoDaAba('configuracoes', 'inventada')).toBe('/configuracoes');
    expect(subAbaDeConfiguracoes('/configuracoes/inventada')).toBe('overview');
  });

  it('as sub-abas do mapa são as que a tela mostra', () => {
    const fonte = readFileSync('src/components/settings/SettingsView.tsx', 'utf-8');
    for (const sub of ABAS_DE_CONFIGURACOES) {
      expect(fonte, sub).toContain(`id: '${sub}'`);
    }
  });
});

/**
 * A query sobrevive à navegação.
 *
 * `?portal=` decide se o portal do cliente está aberto e `?invite=` carrega o
 * token do convite. Trocar de tela apagando a query fecharia o portal sozinho
 * no primeiro clique do menu.
 */
describe('a query sobrevive à troca de tela', () => {
  it('mantém o que já estava na URL', () => {
    expect(urlDaAba('clientes', undefined, '?portal=abc')).toBe('/clientes?portal=abc');
    expect(urlDaAba('configuracoes', 'users', '?invite=xyz')).toBe(
      '/configuracoes/usuarios?invite=xyz'
    );
  });

  it('sem query, só o caminho', () => {
    expect(urlDaAba('dashboard')).toBe('/dashboard');
    expect(urlDaAba('dashboard', undefined, '')).toBe('/dashboard');
  });
});

/**
 * O rewrite da Vercel é o que faz o F5 funcionar.
 *
 * Sem ele, recarregar em `/calendario` devolve 404 da própria Vercel — o app
 * nem chega a rodar. E `vercel.json` não é validado pelo CI (armadilha 6):
 * `tsc`, vitest e `vite build` não olham para esse arquivo, então esta é a
 * única guarda que existe.
 */
describe('a Vercel serve o app em qualquer caminho', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf-8'));

  it('tem rewrite para o index.html', () => {
    const regra = (config.rewrites || []).find((r: any) => r.destination === '/index.html');
    expect(regra, 'sem rewrite, F5 fora da raiz é 404').toBeTruthy();
  });

  it('o rewrite não engole /api', () => {
    // Se engolisse, toda rota serverless passaria a devolver HTML.
    const regra = config.rewrites.find((r: any) => r.destination === '/index.html');
    // A Vercel casa o `source` contra o caminho inteiro, não como busca.
    // Sem as âncoras, `/api/status` casaria a partir do segundo caractere e o
    // teste diria que a rota serverless está protegida quando não está.
    const padrao = new RegExp(`^${regra.source}$`);
    expect(padrao.test('/api/status')).toBe(false);
    expect(padrao.test('/calendario')).toBe(true);
    expect(padrao.test('/super-admin/planos')).toBe(true);
  });

  /**
   * A ordem das regras é a regra.
   *
   * A Vercel avalia os rewrites de cima para baixo e para no primeiro que
   * casa. O `/((?!api/).*)` casa com **tudo** que não é `/api`, inclusive
   * `/robots.txt` e a requisição do robô do WhatsApp: se ele vier antes, os
   * outros dois nunca são alcançados — e nada nisso aparece no CI, porque
   * `vercel.json` não é validado por `tsc`, vitest nem `vite build`
   * (armadilha 6).
   */
  it('as regras específicas vêm antes do coringa', () => {
    const posicao = (destino: string, temHas: boolean) =>
      config.rewrites.findIndex(
        (r: any) => r.destination === destino && Boolean(r.has) === temHas
      );

    const coringa = posicao('/index.html', false);
    const robots = config.rewrites.findIndex((r: any) => r.source === '/robots.txt');
    const robos = posicao('/api/seo', true);

    expect(robots, 'sem regra para /robots.txt').toBeGreaterThanOrEqual(0);
    expect(robos, 'sem regra para os robôs de prévia').toBeGreaterThanOrEqual(0);
    expect(robots).toBeLessThan(coringa);
    expect(robos).toBeLessThan(coringa);
  });

  /**
   * O desvio é por user-agent, e só para robô.
   *
   * A rota `/api/seo` devolve um HTML mínimo com as meta tags — bom para o
   * robô de prévia, péssimo para uma pessoa, que perderia o app inteiro. Um
   * padrão frouxo demais mandaria navegador de verdade para lá.
   */
  it('o desvio dos robôs não pega navegador de gente', () => {
    const regra = config.rewrites.find(
      (r: any) => r.destination === '/api/seo' && r.has
    );
    const condicao = regra.has.find(
      (h: any) => h.type === 'header' && h.key === 'user-agent'
    );
    expect(condicao, 'o desvio tem que ser por user-agent').toBeTruthy();

    const padrao = new RegExp(`^${condicao.value}$`);

    for (const robo of [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0 A',
      'Twitterbot/1.0',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
      'Slackbot-LinkExpanding 1.0',
      'TelegramBot (like TwitterBot)',
      'Mozilla/5.0 (compatible; Discordbot/2.0)',
    ]) {
      expect(padrao.test(robo), robo).toBe(true);
    }

    for (const gente of [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    ]) {
      expect(padrao.test(gente), gente).toBe(false);
    }
  });

  it('todo caminho de aba passa pelo rewrite', () => {
    const regra = config.rewrites.find((r: any) => r.destination === '/index.html');
    // A Vercel casa o `source` contra o caminho inteiro, não como busca.
    // Sem as âncoras, `/api/status` casaria a partir do segundo caractere e o
    // teste diria que a rota serverless está protegida quando não está.
    const padrao = new RegExp(`^${regra.source}$`);
    for (const caminho of Object.values(CAMINHOS)) {
      expect(padrao.test(caminho), caminho).toBe(true);
    }
  });

  /**
   * O plano Hobby aceita 12 funções serverless por deploy.
   *
   * Passar disso não dá erro de código: `tsc`, vitest e `vite build` ficam
   * verdes — nenhum deles olha para `api/` contando arquivos —, e **o deploy
   * inteiro falha**, com a produção presa na versão anterior. Foi assim que
   * a branch da lixeira ficou quatro deploys sem subir: duas rotas novas
   * levaram o total a 14.
   *
   * É a mesma família da armadilha do cron de 5 minutos: limite de plano que
   * só aparece no deploy de verdade. Rota nova aqui significa juntar duas
   * que já existem — foi o que aconteceu com a exclusão de agência, que
   * virou modo da própria rota de expurgo.
   */
  it('não passa do limite de funções serverless do plano', () => {
    const LIMITE_DO_PLANO_HOBBY = 12;

    const funcoes = readdirSync('api').filter((f) => f.endsWith('.ts'));

    expect(
      funcoes.length,
      `${funcoes.length} funções em api/ (limite ${LIMITE_DO_PLANO_HOBBY}): ${funcoes.join(', ')}`
    ).toBeLessThanOrEqual(LIMITE_DO_PLANO_HOBBY);
  });
});
