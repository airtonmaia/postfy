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
      for (const aba of [
        'admin_agencias', 'admin_usuarios', 'admin_planos', 'admin_financeiro',
        'admin_relatorios', 'admin_emails', 'admin_integracoes', 'admin_seo',
        'admin_design',
      ] as const) {
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

  it('o papel de cliente não alcança a gestão da agência', () => {
    /**
     * A lista dele era `['aprovacoes']`, e aquele menu saiu do produto —
     * o ciclo de aprovação mora no quadro e, para o cliente, no portal.
     *
     * O que esta guarda protege não é **qual** tela sobrou, é o recorte: ele
     * não vê clientes, comercial, relatórios nem configurações. Afirmar a
     * lista inteira faria o teste ser editado junto com qualquer mudança de
     * menu, e é assim que uma guarda deixa de guardar.
     */
    for (const proibida of ['clientes', 'comercial', 'relatorios', 'configuracoes'] as const) {
      expect(podeAcessarAba('client', proibida), `cliente alcançou ${proibida}`).toBe(false);
    }
    // E continua com alguma porta: lista vazia monta o app sem menu nenhum.
    expect(abasPermitidas('client').length).toBeGreaterThan(0);
  });

  it('nega tudo quando não há papel', () => {
    expect(pode(undefined, 'criar_conteudo')).toBe(false);
    expect(podeAcessarAba(undefined, 'dashboard')).toBe(false);
    expect(abasPermitidas(undefined)).toEqual([]);
  });
});
