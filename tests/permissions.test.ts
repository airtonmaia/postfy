import { describe, it, expect } from 'vitest';
import { pode, podeAcessarAba, abasPermitidas } from '../src/lib/permissions';

describe('permissões por papel', () => {
  it('dá acesso amplo ao proprietário da agência', () => {
    expect(pode('owner', 'gerenciar_usuarios')).toBe(true);
    expect(pode('owner', 'gerenciar_workspace')).toBe(true);
    expect(podeAcessarAba('owner', 'configuracoes')).toBe(true);
  });

  /**
   * Administrar o produto não é um papel dentro da agência.
   *
   * 'gerenciar_saas' vivia na lista do `owner`, e a RPC criar_agencia dá esse
   * papel a todo mundo que se cadastra: na prática, cada cliente novo
   * enxergava o menu de gestão do SaaS. Quem administra a plataforma está na
   * tabela platform_admins, e a RLS consulta a mesma tabela.
   */
  it('nenhum papel de agência concede administração da plataforma', () => {
    const papeis = [
      'owner', 'admin', 'manager', 'social_media',
      'designer', 'copywriter', 'financial', 'client',
    ] as const;

    for (const papel of papeis) {
      for (const aba of ['saas_planos', 'saas_financeiro', 'saas_agencias', 'saas_emails'] as const) {
        expect(podeAcessarAba(papel, aba), `${papel} não pode abrir ${aba}`).toBe(false);
      }
    }
  });

  it('mantém designer e copywriter fora do comercial e do financeiro', () => {
    for (const papel of ['designer', 'copywriter'] as const) {
      expect(podeAcessarAba(papel, 'comercial')).toBe(false);
      expect(podeAcessarAba(papel, 'configuracoes')).toBe(false);
      expect(pode(papel, 'ver_financeiro')).toBe(false);
      expect(pode(papel, 'gerenciar_usuarios')).toBe(false);
    }
  });

  it('deixa a produção acessível a quem cria conteúdo', () => {
    expect(podeAcessarAba('designer', 'producao')).toBe(true);
    expect(podeAcessarAba('copywriter', 'producao')).toBe(true);
    expect(pode('social_media', 'criar_conteudo')).toBe(true);
  });

  it('restringe o papel de cliente às aprovações', () => {
    expect(abasPermitidas('client')).toEqual(['aprovacoes']);
    expect(podeAcessarAba('client', 'clientes')).toBe(false);
    expect(podeAcessarAba('client', 'relatorios')).toBe(false);
  });

  it('nega tudo quando não há papel', () => {
    expect(pode(undefined, 'criar_conteudo')).toBe(false);
    expect(podeAcessarAba(undefined, 'dashboard')).toBe(false);
    expect(abasPermitidas(undefined)).toEqual([]);
  });
});
