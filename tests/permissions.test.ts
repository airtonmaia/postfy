import { describe, it, expect } from 'vitest';
import { pode, podeAcessarAba, abasPermitidas } from '../src/lib/permissions';

describe('permissões por papel', () => {
  it('dá acesso amplo ao proprietário', () => {
    expect(pode('owner', 'gerenciar_saas')).toBe(true);
    expect(pode('owner', 'gerenciar_usuarios')).toBe(true);
    expect(podeAcessarAba('owner', 'configuracoes')).toBe(true);
  });

  it('não deixa o admin da agência chegar à administração do SaaS', () => {
    expect(pode('admin', 'gerenciar_saas')).toBe(false);
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
