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
    const url = urlDaPreviaDoPortal('abc-123', 'pulmin');
    expect(agenciaDoCaminho(url.split('?')[1])).toBe('pulmin');
    expect(url).toContain('cliente=abc-123');
  });

  it('a prévia funciona sem agência', () => {
    expect(urlDaPreviaDoPortal('abc-123')).toBe('/portal-do-cliente?cliente=abc-123');
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
