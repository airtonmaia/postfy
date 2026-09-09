import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { urlDoPortalDaAgencia, urlDaPreviaDoPortal, agenciaDoCaminho } from '../src/lib/rotas';

/**
 * O link do portal já saiu errado duas vezes, das duas em produção:
 *
 *   - `?portal=<id do cliente>` em JobDetailModal e ApprovalsView. O portal
 *     resolve `clients.portal_token`, que é hex de 24 bytes — o id nunca
 *     casa, e `portal_dados` devolve null. O cliente abria numa tela vazia.
 *   - `/#portal-<id>` no WhatsAppShareModal, formato que nada no app lê, com
 *     um `'c-1'` sobrando dos dados de exemplo.
 *
 * Nenhum dos dois quebra tipo, teste de tela ou build: são strings montadas
 * à mão que só falham na frente do cliente. Por isso a guarda é sobre o
 * código-fonte.
 */
const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx?$/.test(caminho) ? [caminho] : [];
  });

describe('link do portal', () => {
  it('leva a agência, não o cliente', () => {
    // O que decide o que a pessoa vê é o código que ela recebe por e-mail.
    // Cliente no link seria credencial em texto puro num WhatsApp.
    const link = urlDoPortalDaAgencia('pulmin', 'https://app.orquesia.com.br');
    expect(link).toBe('https://app.orquesia.com.br/portal-do-cliente?agencia=pulmin');
    expect(link).not.toMatch(/cliente=/);
  });

  it('escapa o slug', () => {
    expect(urlDoPortalDaAgencia('a b&c')).toBe('/portal-do-cliente?agencia=a%20b%26c');
  });

  it('a prévia interna leva cliente e agência', () => {
    const url = urlDaPreviaDoPortal('airton-maia', 'pulmin');
    expect(agenciaDoCaminho(url.split('?')[1])).toBe('pulmin');
    expect(url).toContain('cliente=airton-maia');
  });

  it('a prévia funciona sem agência', () => {
    expect(urlDaPreviaDoPortal('airton-maia')).toBe('/portal-do-cliente?cliente=airton-maia');
  });

  /**
   * O uuid tem que continuar abrindo: links da prévia foram compartilhados e
   * favoritados antes de o slug existir, e quebrá-los seria trocar um
   * incômodo (URL feia) por uma regressão.
   */
  it('o contexto resolve slug e uuid', () => {
    const ctx = readFileSync('src/context/PostfyContext.tsx', 'utf-8');
    const trecho = ctx.slice(ctx.indexOf('const portalClientId'));
    expect(trecho).toMatch(/c\.slug === portalPreviewClientId/);
    expect(trecho).toMatch(/c\.id === portalPreviewClientId/);
  });

  it('o slug do cliente é gerado e mantido pelo banco', () => {
    const sql = readFileSync(
      'supabase/migrations/20260909200000_slug_do_cliente.sql',
      'utf-8'
    );
    // Em trigger, e não no app: o cliente é criado pela camada de diff, que
    // não conhece regra de negócio. No app seria preciso lembrar de gerar o
    // slug em cada lugar que cria ou renomeia.
    expect(sql).toMatch(/create trigger cliente_slug/);
    expect(sql).toMatch(/before insert or update on public\.clients/);
    // Único por agência, não global: duas agências podem ter o mesmo cliente,
    // e uma não deveria descobrir a outra por um sufixo no endereço.
    expect(sql).toMatch(/unique index[\s\S]*clients \(workspace_id, slug\)/);
  });

  it('a tela não manda o slug de volta para o banco', () => {
    // Quem gera é o trigger. Mandá-lo daqui deixaria a tela sobrescrever o
    // valor gerado com o que ela tinha em memória.
    const mappers = readFileSync('src/lib/mappers.ts', 'utf-8');
    const escrita = mappers.slice(
      mappers.indexOf('export const clientParaLinha'),
      mappers.indexOf('// ------', mappers.indexOf('export const clientParaLinha'))
    );
    expect(escrita).not.toMatch(/^\s*slug:/m);
  });

  it('agenciaDoCaminho não estoura com lixo', () => {
    expect(agenciaDoCaminho('')).toBeNull();
    expect(agenciaDoCaminho('?outra=coisa')).toBeNull();
  });

  /**
   * A guarda que pega o erro de verdade: ninguém monta o link do portal à
   * mão de novo.
   */
  it('nenhum componente monta o link do portal na unha', () => {
    const culpados = varrer('src')
      .map((arquivo) => ({ arquivo, texto: readFileSync(arquivo, 'utf-8') }))
      .filter(({ arquivo, texto }) => {
        // rotas.ts é quem tem o direito de montar.
        if (arquivo.endsWith('lib/rotas.ts')) return false;
        return /[?#]portal[=-]\$\{/.test(texto) || /portal=\$\{[^}]*\.id\}/.test(texto);
      })
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  /**
   * Os dois botões aparecem sempre.
   *
   * Uma tentativa de impedir que a prévia abrisse um cliente arbitrário
   * escondeu o botão quando nenhum estava escolhido — e o filtro em "todos" é
   * o padrão, então na prática o botão sumiu da barra lateral para a maioria
   * das pessoas. O problema nunca foi abrir o primeiro cliente: era não dizer
   * qual. Isso vive no `title` agora.
   */
  it('o botão de abrir não some quando nenhum cliente está escolhido', () => {
    const comp = readFileSync('src/components/common/BotaoDoPortal.tsx', 'utf-8');
    // Nada de renderização condicionada ao clientId.
    expect(comp).not.toMatch(/\{clientId && \(/);
    // Sem cliente escolhido, cai no primeiro.
    expect(comp).toMatch(/clients\[0\]/);
    // E o title diz de quem é a prévia.
    expect(comp).toMatch(/prévia do portal de \$\{alvo\.name\}/);
  });

  it('a marca da agência sai de uma função que não expõe a tabela', () => {
    const sql = readFileSync(
      'supabase/migrations/20260909190000_marca_publica_da_agencia.sql',
      'utf-8'
    );
    // anon precisa chamar: quem abre o portal não tem conta no sistema.
    expect(sql).toMatch(/grant execute on function public\.marca_da_agencia\(text\) to anon/);
    expect(sql).toContain("set search_path = ''");
    // Lista fechada: um `select *` entregaria plano e situação de teste para
    // qualquer um, sem sessão.
    expect(sql).not.toMatch(/select\s+w\.\*/i);
    expect(sql).not.toMatch(/is_trial|trial_ends_at|custom_domain/);
  });
});
