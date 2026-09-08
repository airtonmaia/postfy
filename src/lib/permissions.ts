import { Role, TabType } from '../types';

/**
 * Permissões por papel.
 *
 * Antes o acesso administrativo era decidido por uma comparação de e-mail no
 * cliente (`currentUser.email === 'algum@email'`) e qualquer pessoa podia
 * trocar o próprio papel pela interface. Aqui a regra fica num só lugar e o
 * papel vem da sessão do servidor.
 *
 * Isto governa o que a interface mostra. Continua valendo a regra geral:
 * verificação de permissão que protege dados precisa existir também no
 * servidor — a interface apenas evita oferecer o que a pessoa não pode fazer.
 */

/** Telas visíveis para cada papel. */
const ABAS_POR_PAPEL: Record<Role, TabType[]> = {
  owner: [
    'dashboard', 'calendario', 'producao', 'aprovacoes', 'clientes',
    'comercial', 'publicacoes', 'relatorios', 'automacoes', 'configuracoes',
  ],
  admin: [
    'dashboard', 'calendario', 'producao', 'aprovacoes', 'clientes',
    'comercial', 'publicacoes', 'relatorios', 'automacoes', 'configuracoes',
  ],
  manager: [
    'dashboard', 'calendario', 'producao', 'aprovacoes', 'clientes',
    'comercial', 'publicacoes', 'relatorios', 'automacoes',
  ],
  social_media: [
    'dashboard', 'calendario', 'producao', 'aprovacoes', 'clientes',
    'publicacoes', 'relatorios',
  ],
  designer: ['dashboard', 'calendario', 'producao', 'aprovacoes'],
  copywriter: ['dashboard', 'calendario', 'producao', 'aprovacoes'],
  financial: ['dashboard', 'clientes', 'comercial', 'relatorios'],
  client: ['aprovacoes'],
};

export type Permissao =
  | 'gerenciar_saas'
  | 'gerenciar_workspace'
  | 'gerenciar_usuarios'
  | 'gerenciar_clientes'
  | 'gerenciar_comercial'
  | 'ver_financeiro'
  | 'criar_conteudo'
  | 'excluir_conteudo'
  | 'aprovar_conteudo'
  | 'publicar';

const PERMISSOES_POR_PAPEL: Record<Role, Permissao[]> = {
  owner: [
    'gerenciar_saas', 'gerenciar_workspace', 'gerenciar_usuarios', 'gerenciar_clientes',
    'gerenciar_comercial', 'ver_financeiro', 'criar_conteudo', 'excluir_conteudo',
    'aprovar_conteudo', 'publicar',
  ],
  admin: [
    'gerenciar_workspace', 'gerenciar_usuarios', 'gerenciar_clientes',
    'gerenciar_comercial', 'ver_financeiro', 'criar_conteudo', 'excluir_conteudo',
    'aprovar_conteudo', 'publicar',
  ],
  manager: [
    'gerenciar_clientes', 'gerenciar_comercial', 'criar_conteudo',
    'excluir_conteudo', 'aprovar_conteudo', 'publicar',
  ],
  social_media: ['criar_conteudo', 'publicar'],
  designer: ['criar_conteudo'],
  copywriter: ['criar_conteudo'],
  financial: ['ver_financeiro', 'gerenciar_comercial'],
  client: ['aprovar_conteudo'],
};

export const podeAcessarAba = (papel: Role | undefined, aba: TabType): boolean => {
  if (!papel) return false;
  return (ABAS_POR_PAPEL[papel] || []).includes(aba);
};

export const abasPermitidas = (papel: Role | undefined): TabType[] =>
  papel ? ABAS_POR_PAPEL[papel] || [] : [];

export const pode = (papel: Role | undefined, permissao: Permissao): boolean => {
  if (!papel) return false;
  return (PERMISSOES_POR_PAPEL[papel] || []).includes(permissao);
};
