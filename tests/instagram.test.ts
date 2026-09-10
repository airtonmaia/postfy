import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { urlDeAutorizacao, ESCOPOS_INSTAGRAM } from '../api/_lib/instagram.js';

/**
 * O projeto implementava o fluxo errado.
 *
 * Existem dois caminhos para publicar no Instagram:
 *
 *   - *login do Facebook*: a conta do Instagram precisa estar ligada a uma
 *     Página, o token que publica é o **da Página**, obtido em
 *     `/me/accounts`, e tudo passa por `graph.facebook.com`;
 *   - *login do Instagram*: a pessoa entra com a própria conta, sem Página no
 *     caminho, e as chamadas vão para `api.instagram.com` e
 *     `graph.instagram.com`.
 *
 * O app "Orquesia" está configurado no segundo, e o código estava escrito
 * para o primeiro. A prova é o teste manual que passou: `/me` devolveu
 * `28732739896414585` e esse mesmo id publicou em `/media`. No fluxo do
 * Facebook, `/me` devolve o usuário do **Facebook**, e um POST em
 * `/{id-do-facebook}/media` é recusado.
 *
 * Nada disso quebra tipo, teste de tela ou build: são strings de URL. O
 * sintoma aparece na frente de quem está conectando, depois de já ter
 * digitado a senha.
 */
/**
 * Comentário não é código.
 *
 * O projeto registra nos comentários o que deu errado antes — aqui, os hosts
 * do fluxo do Facebook e o porquê de eles terem saído. Sem esta limpeza a
 * guarda acusaria justamente a explicação do bug que ela existe para
 * impedir, e a saída seria apagar a memória do bug. Mesma razão do
 * `semComentarios` em tests/telas-honestas.test.ts.
 */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('fluxo do Instagram, não o do Facebook', () => {
  const instagram = semComentarios(readFileSync('api/_lib/instagram.ts', 'utf-8'));
  const conectar = semComentarios(readFileSync('api/social-connect.ts', 'utf-8'));
  const retorno = semComentarios(readFileSync('api/social-callback.ts', 'utf-8'));

  it('a autorização vai para o instagram.com', () => {
    const url = urlDeAutorizacao('123', 'https://app.orquesia.com.br/api/social-callback', 'xyz');
    expect(url).toMatch(/^https:\/\/www\.instagram\.com\/oauth\/authorize\?/);
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=xyz');
    expect(url).toContain(
      'redirect_uri=https%3A%2F%2Fapp.orquesia.com.br%2Fapi%2Fsocial-callback'
    );
  });

  it('nenhum host do Facebook sobrou no caminho do OAuth', () => {
    for (const [nome, fonte] of [
      ['instagram.ts', instagram],
      ['social-connect.ts', conectar],
      ['social-callback.ts', retorno],
    ] as const) {
      expect(fonte, nome).not.toMatch(/graph\.facebook\.com/);
      expect(fonte, nome).not.toMatch(/www\.facebook\.com\/v\d+\.\d+\/dialog\/oauth/);
      expect(fonte, nome).not.toMatch(/fb_exchange_token/);
      // `/me/accounts` só existe no fluxo da Página.
      expect(fonte, nome).not.toMatch(/me\/accounts/);
    }
  });

  /**
   * `pages_show_list` e `pages_read_engagement` são escopos do fluxo do
   * Facebook. Na tela de autorização do Instagram eles fazem a autorização
   * ser recusada — depois do login, com um erro que não nomeia o escopo.
   */
  it('os escopos são só os dois do Instagram', () => {
    expect(ESCOPOS_INSTAGRAM.split(',')).toEqual([
      'instagram_business_basic',
      'instagram_business_content_publish',
    ]);
    expect(ESCOPOS_INSTAGRAM).not.toMatch(/pages_/);
  });

  it('a troca do código é POST form-encoded no api.instagram.com', () => {
    // Este endpoint não aceita os parâmetros na query.
    const trecho = instagram.slice(instagram.indexOf('export const trocarCodigoPorToken'));
    expect(trecho).toMatch(/URLSearchParams/);
    expect(trecho).toMatch(/method: 'POST'/);
    expect(trecho).toMatch(/application\/x-www-form-urlencoded/);
    expect(instagram).toMatch(/https:\/\/api\.instagram\.com\/oauth\/access_token/);
  });

  it('o token curto vira token de 60 dias', () => {
    // O primeiro token vale uma hora: sem esta troca a conexão morre no mesmo
    // dia, e o cliente descobre quando a publicação agendada falha.
    expect(instagram).toMatch(/ig_exchange_token/);
  });

  it('e o de 60 dias é renovável', () => {
    // Sem renovar, a conexão de quem ficou dois meses sem publicar
    // simplesmente para de funcionar.
    expect(instagram).toMatch(/ig_refresh_token/);
    const publicar = semComentarios(readFileSync('api/publicar.ts', 'utf-8'));
    expect(publicar).toMatch(/renovarTokensQuePodemVencer/);
    // Renovar vem antes de publicar: token vencido gasta tentativa da fila.
    expect(publicar.indexOf('renovarTokensQuePodemVencer(supabase)')).toBeLessThan(
      publicar.indexOf("from('publish_queue')")
    );
  });

  it('publicação e leitura vão para o graph.instagram.com', () => {
    expect(instagram).toMatch(/https:\/\/graph\.instagram\.com/);
  });
});

/**
 * A URL de retorno é a peça que mais quebra esta integração.
 *
 * Ela precisa ser idêntica em três lugares: no que mandamos para a Meta ao
 * abrir a autorização, no que mandamos ao trocar o código, e no que está
 * cadastrado no painel. Divergir num caractere faz a Meta recusar — e só
 * depois de a pessoa já ter digitado a senha.
 */
describe('URL de retorno', () => {
  const conectar = semComentarios(readFileSync('api/social-connect.ts', 'utf-8'));
  const retorno = semComentarios(readFileSync('api/social-callback.ts', 'utf-8'));

  it('é montada igual nos dois lados', () => {
    const padrao = /\$\{base\}\/api\/social-callback/;
    expect(conectar).toMatch(padrao);
    expect(retorno).toMatch(padrao);
    // E as duas partem da mesma variável, com o mesmo padrão embutido.
    for (const fonte of [conectar, retorno]) {
      expect(fonte).toMatch(/process\.env\.APP_URL \|\| 'https:\/\/app\.orquesia\.com\.br'/);
    }
  });

  it('a tela de Integrações mostra qual é, vinda do servidor', () => {
    // Escrita à mão na tela, ela envelheceria sem ninguém notar — e o valor
    // certo depende de APP_URL, que só o servidor conhece.
    const status = readFileSync('api/status.ts', 'utf-8');
    expect(status).toMatch(/urlDeRetorno/);
    const tela = readFileSync('src/components/admin/AdminIntegracoesView.tsx', 'utf-8');
    expect(tela).toMatch(/status\?\.urlDeRetorno/);
    expect(tela).toMatch(/clipboard\.writeText/);
  });

  it('o retorno é GET, porque quem chega é uma navegação', () => {
    // O export nomeado dizia POST e contradizia o próprio comentário. Nos
    // builders que decidem pelo método nomeado, a navegação do navegador não
    // casaria com handler nenhum.
    expect(retorno).toMatch(/export const GET = handler;/);
    expect(retorno).not.toMatch(/export const POST = handler;/);
  });
});

/**
 * As credenciais do Instagram não são as do app da Meta.
 *
 * É o segundo erro mais comum desta integração, e o sintoma é o mesmo do
 * primeiro: a autorização abre e falha depois do login.
 */
describe('credenciais', () => {
  it('o servidor pede INSTAGRAM_APP_ID, e não META_APP_ID', () => {
    for (const arquivo of ['api/social-connect.ts', 'api/social-callback.ts']) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf-8'));
      expect(fonte, arquivo).toMatch(/INSTAGRAM_APP_ID/);
      expect(fonte, arquivo).toMatch(/INSTAGRAM_APP_SECRET/);
      // Cair no app da Meta por engano é pior que faltar: falha só no fim.
      expect(fonte, arquivo).not.toMatch(/META_APP_ID/);
      expect(fonte, arquivo).not.toMatch(/META_APP_SECRET/);
    }
  });

  it('o .env.example diz que não são as mesmas', () => {
    const env = readFileSync('.env.example', 'utf-8');
    expect(env).toMatch(/INSTAGRAM_APP_ID=/);
    expect(env).toMatch(/NÃO são as credenciais do app da Meta/i);
    expect(env).not.toMatch(/^META_APP_ID=/m);
  });
});
