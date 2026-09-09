import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Convite não cria agência.
 *
 * Bug real, encontrado em produção: o convidado se cadastrava pelo link do
 * convite, o app criava "Agência de Fulano" para ele, e só depois o vínculo
 * com a agência de quem convidou era criado. A pessoa terminava em duas
 * agências e entrava na própria — vazia. Do lado de quem convidou parecia
 * que o convite tinha falhado; do lado do convidado, que o sistema estava
 * vazio.
 *
 * No banco a diferença entre as duas linhas foi de 129 milissegundos.
 *
 * Nada disso quebra teste de tela nem de tipo: as duas chamadas funcionam,
 * só estão na ordem errada. Por isso a guarda é sobre o código.
 */
describe('cadastro por convite não cria agência própria', () => {
  const tela = readFileSync('src/components/auth/AcceptInviteView.tsx', 'utf-8');
  const auth = readFileSync('src/lib/authSupabase.ts', 'utf-8');

  it('a tela de aceite pede cadastro sem agência', () => {
    expect(tela).toMatch(/criarAgenciaPropria:\s*false/);
  });

  it('cadastrar respeita o pedido', () => {
    expect(auth).toMatch(/criarAgenciaPropria === false/);
  });

  /**
   * O segundo caminho para o mesmo estado: com confirmação de e-mail ligada,
   * o cadastro não abre sessão. A pessoa confirma o e-mail, entra pela tela
   * de login normal — e é ali que a criação automática dispara, antes de o
   * convite ser aceito. Só a correção na tela de aceite não cobre isso.
   */
  it('a criação automática consulta convite pendente antes de criar', () => {
    const trecho = auth.slice(
      auth.indexOf('export const garantirAgencia'),
      auth.indexOf('export const criarAgencia')
    );
    expect(trecho).toContain('tenho_convite_pendente');
    expect(trecho.indexOf('tenho_convite_pendente')).toBeLessThan(
      trecho.indexOf("rpc('criar_agencia'")
    );
  });

  it('a função existe no schema versionado', () => {
    const sql = readFileSync(
      'supabase/migrations/20260909110000_convite_antes_de_agencia.sql',
      'utf-8'
    );
    expect(sql).toContain('create or replace function public.tenho_convite_pendente');
    // security definer porque a RLS de invites só deixa owner/admin ler, e o
    // convidado ainda não é nenhum dos dois.
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/grant execute on function public\.tenho_convite_pendente\(\) to authenticated/);
  });

  it('o aceite manda o app para a agência do convite', () => {
    // Sem isso, quem já participava de outra agência aceitava o convite e
    // continuava caindo na de sempre.
    expect(auth).toMatch(/workspaceId\?: string/);
    expect(tela).toMatch(/salvarPreferencias\(\{ lastWorkspaceId: res\.workspaceId \}\)/);
  });

  it('a agência inicial tem ordem definida', () => {
    // O fallback é membros[0]. Sem `order`, o Postgres não promete ordem, e
    // a agência inicial podia trocar entre recargas.
    const trecho = auth.slice(auth.indexOf('export const carregarSessao'));
    expect(trecho).toMatch(/\.order\('created_at'/);
  });
});
