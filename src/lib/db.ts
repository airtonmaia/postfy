import { supabase } from './supabase';
import {
  clientDaLinha, clientParaLinha,
  jobDaLinha, jobParaLinha,
  leadDaLinha, leadParaLinha,
  proposalDaLinha, proposalParaLinha,
  contractDaLinha, contractParaLinha,
  automationDaLinha, automationParaLinha,
  notificationDaLinha, notificationParaLinha,
  activityLogDaLinha, activityLogParaLinha,
  clientMaterialDaLinha, clientMaterialParaLinha,
  timesheetLogDaLinha, timesheetLogParaLinha,
  workspaceDaLinha, workspaceParaLinha,
  clientUserDaLinha, clientUserParaLinha,
} from './mappers';
import type {
  Client, Job, Lead, Proposal, Contract, Automation,
  Notification, ActivityLog, ClientMaterial, TimesheetLog, Workspace,
  ClientUser,
} from '../types';

/**
 * Acesso ao banco.
 *
 * As consultas saem do navegador direto para o Supabase; quem garante o
 * isolamento é a RLS, não este código. Por isso não há filtro por
 * workspace_id nas leituras: o banco só devolve as linhas das agências das
 * quais o usuário é membro. Filtrar aqui também seria defesa em profundidade
 * inútil e enganosa — daria a impressão de que a segurança mora no cliente.
 *
 * Escritas passam workspace_id porque a coluna é obrigatória, mas a política
 * de INSERT recusa qualquer valor fora das agências do usuário.
 */

export class DbError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DbError';
    this.code = code;
  }
}

/** Traduz o erro do Postgres para algo que faça sentido na tela. */
const traduzirErro = (erro: any): DbError => {
  const codigo = erro?.code;

  if (codigo === '42501' || erro?.message?.includes('row-level security')) {
    return new DbError(
      'Seu perfil não tem permissão para esta ação.',
      codigo
    );
  }
  if (codigo === '23505') {
    return new DbError('Já existe um registro com esses dados.', codigo);
  }
  if (codigo === '23503') {
    return new DbError('Registro relacionado não encontrado.', codigo);
  }
  if (codigo === '23514') {
    return new DbError('Algum campo está com valor fora do permitido.', codigo);
  }
  return new DbError(erro?.message || 'Falha ao acessar o banco de dados.', codigo);
};

/**
 * Repositório por entidade. Cada um sabe sua tabela e seus dois mapeadores,
 * e nada mais.
 */
const criarRepositorio = <T extends { id: string }>(
  tabela: string,
  daLinha: (l: any) => T,
  paraLinha: (e: Partial<T>) => Record<string, any>,
  ordem: { coluna: string; crescente: boolean } = { coluna: 'created_at', crescente: false }
) => ({
  listar: async (): Promise<T[]> => {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order(ordem.coluna, { ascending: ordem.crescente });
    if (error) throw traduzirErro(error);
    return (data || []).map(daLinha);
  },

  criar: async (entidade: Partial<T>): Promise<T> => {
    // O id vai junto de propósito. Os mapeadores só traduzem campos de
    // negócio — mandar o id num update sobrescreveria a chave —, então ele é
    // acrescentado só aqui, na inserção.
    //
    // Sem isso o Postgres gera um id próprio e o estado da tela fica com
    // outro: a linha existe nos dois lados com chaves diferentes, e a
    // primeira edição tenta atualizar um id que não existe no banco.
    const linha = paraLinha(entidade);
    if (entidade.id) linha.id = entidade.id;

    const { data, error } = await supabase
      .from(tabela)
      .insert(linha)
      .select()
      .single();
    if (error) throw traduzirErro(error);
    return daLinha(data);
  },

  atualizar: async (id: string, mudancas: Partial<T>): Promise<T> => {
    const { data, error } = await supabase
      .from(tabela)
      .update(paraLinha(mudancas))
      .eq('id', id)
      .select()
      .single();
    if (error) throw traduzirErro(error);
    return daLinha(data);
  },

  remover: async (id: string): Promise<void> => {
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) throw traduzirErro(error);
  },
});

export const db = {
  clients: criarRepositorio<Client>('clients', clientDaLinha, clientParaLinha),
  jobs: criarRepositorio<Job>('jobs', jobDaLinha, jobParaLinha),
  leads: criarRepositorio<Lead>('leads', leadDaLinha, leadParaLinha),
  proposals: criarRepositorio<Proposal>('proposals', proposalDaLinha, proposalParaLinha),
  contracts: criarRepositorio<Contract>('contracts', contractDaLinha, contractParaLinha),
  automations: criarRepositorio<Automation>('automations', automationDaLinha, automationParaLinha),
  notifications: criarRepositorio<Notification>('notifications', notificationDaLinha, notificationParaLinha),
  activityLogs: criarRepositorio<ActivityLog>('activity_logs', activityLogDaLinha, activityLogParaLinha),
  clientMaterials: criarRepositorio<ClientMaterial>('client_materials', clientMaterialDaLinha, clientMaterialParaLinha),
  timesheetLogs: criarRepositorio<TimesheetLog>('timesheet_logs', timesheetLogDaLinha, timesheetLogParaLinha),
};

/**
 * Quanto passado entra na carga inicial.
 *
 * `carregarTudo` puxava a agência **inteira**, sem limite e sem paginação:
 * todos os jobs, todos os logs, todas as notificações. Com 100 jobs é
 * instantâneo; com 5.000 o login demora segundos e cada edição passa pelo
 * `diferenciar()`, que faz um `JSON.stringify` por linha.
 *
 * E o problema não depende de a agência crescer — depende só de ela
 * continuar usando. Nada era arquivado, então toda agência caminhava para
 * esse ponto pelo tempo.
 *
 * A regra que substitui isso: **trabalho aberto sempre vem; trabalho
 * concluído só o recente.** Uma agência com três anos de histórico tem
 * dezenas de jobs abertos e milhares de publicados — e são os abertos que a
 * tela precisa para funcionar.
 *
 * O que fica de fora não some: `buscarJobsDoPeriodo` traz sob demanda quando
 * o calendário navega para trás ou o relatório pede um período maior.
 */
export const DIAS_DE_HISTORICO = 90;

/** Limite das coleções que só crescem e que ninguém lê inteiras. */
const LIMITE_DE_HISTORICO = 200;

const desdeISO = (dias: number): string =>
  new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

/**
 * Jobs da carga inicial: os abertos, mais os concluídos da janela.
 *
 * Duas consultas e não um `or` só porque o PostgREST monta `or` com sintaxe
 * própria e frágil; duas chamadas claras custam um ida-e-volta a mais e não
 * têm como sair erradas em silêncio.
 */
const listarJobsDaJanela = async (): Promise<Job[]> => {
  const [abertos, recentes] = await Promise.all([
    supabase
      .from('jobs')
      .select('*')
      .neq('status', 'published')
      .order('created_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('*')
      .eq('status', 'published')
      .gte('created_at', desdeISO(DIAS_DE_HISTORICO))
      .order('created_at', { ascending: false }),
  ]);

  if (abertos.error) throw traduzirErro(abertos.error);
  if (recentes.error) throw traduzirErro(recentes.error);

  return [...(abertos.data || []), ...(recentes.data || [])].map(jobDaLinha);
};

/**
 * Jobs de um período que a carga inicial não trouxe.
 *
 * Quem chama é o calendário (ao navegar para um mês antigo) e o relatório
 * (ao escolher um período maior que a janela). A tela junta ao que já tem —
 * e precisa fazer isso com a bandeira de carga ligada, senão o diff trata o
 * que veio do banco como linha nova e tenta inserir tudo de novo.
 */
export const buscarJobsDoPeriodo = async (
  inicio: string,
  fim: string
): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .gte('scheduled_date', inicio)
    .lte('scheduled_date', fim)
    .order('scheduled_date', { ascending: false });
  if (error) throw traduzirErro(error);
  return (data || []).map(jobDaLinha);
};

/** Agências das quais o usuário é membro. */
export const listarWorkspaces = async (): Promise<Workspace[]> => {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw traduzirErro(error);
  return (data || []).map(workspaceDaLinha);
};

export const atualizarWorkspace = async (
  id: string,
  mudancas: Partial<Workspace>
): Promise<Workspace> => {
  const { data, error } = await supabase
    .from('workspaces')
    .update(workspaceParaLinha(mudancas))
    .eq('id', id)
    .select()
    .single();
  if (error) throw traduzirErro(error);
  return workspaceDaLinha(data);
};

/**
 * Move a agência para a lixeira. Devolve quando ela entrou lá.
 *
 * Não apaga nada agora: a linha continua no banco por 7 dias, e
 * `api/expurgar-lixeira.ts` é quem apaga de vez depois disso.
 *
 * Por RPC, e não por `update` direto: o admin da plataforma precisa poder
 * fazer isso em agência da qual **não é membro**, e a política de update em
 * `workspaces` exige ser owner/admin dela. Foi esse descasamento que deixou
 * o botão antigo de "Excluir Agência" mudo — ele removia o vínculo de quem
 * clicava, e o admin não tinha vínculo nenhum ali.
 */
export const moverAgenciaParaLixeira = async (workspaceId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('mover_agencia_para_lixeira', {
    p_workspace_id: workspaceId,
  });
  if (error) throw traduzirErro(error);
  return (data as { deleted_at: string } | null)?.deleted_at ?? new Date().toISOString();
};

/** Tira da lixeira. `false` quando ela já não estava lá. */
export const restaurarAgencia = async (workspaceId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('restaurar_agencia', {
    p_workspace_id: workspaceId,
  });
  if (error) throw traduzirErro(error);
  return Boolean(data);
};

/**
 * Usuários do Portal do Cliente, do lado da agência.
 *
 * Fora do `carregarTudo` e fora do diff de propósito. A tela de um cliente é
 * o único lugar que precisa desta lista, e a persistência derivada de diff
 * grava em segundo plano — aqui a gravação é a resposta ao clique, e a tela
 * precisa saber se o banco recusou (e-mail repetido, papel sem permissão)
 * antes de dizer que criou.
 *
 * Quem recorta continua sendo a RLS: `select` para membro da agência,
 * escrita só para owner/admin/manager.
 */
export const listarUsuariosDoCliente = async (clientId: string): Promise<ClientUser[]> => {
  const { data, error } = await supabase
    .from('client_users')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw traduzirErro(error);
  return (data || []).map(clientUserDaLinha);
};

export const criarUsuarioDoCliente = async (
  usuario: Pick<ClientUser, 'workspaceId' | 'clientId' | 'email' | 'role'> & { name?: string }
): Promise<ClientUser> => {
  const { data, error } = await supabase
    .from('client_users')
    .insert(clientUserParaLinha(usuario))
    .select()
    .single();
  if (error) throw traduzirErro(error);
  return clientUserDaLinha(data);
};

export const atualizarUsuarioDoCliente = async (
  id: string,
  mudancas: Partial<ClientUser>
): Promise<ClientUser> => {
  const { data, error } = await supabase
    .from('client_users')
    .update(clientUserParaLinha(mudancas))
    .eq('id', id)
    .select()
    .single();
  if (error) throw traduzirErro(error);
  return clientUserDaLinha(data);
};

export const removerUsuarioDoCliente = async (id: string): Promise<void> => {
  const { error } = await supabase.from('client_users').delete().eq('id', id);
  if (error) throw traduzirErro(error);
};

export interface MembroDaAgencia {
  userId: string;
  workspaceId: string;
  role: string;
  name?: string;
  avatar?: string;
}

export const listarMembros = async (): Promise<MembroDaAgencia[]> => {
  const { data, error } = await supabase.from('workspace_members').select('*');
  if (error) throw traduzirErro(error);
  return (data || []).map((l: any) => ({
    userId: l.user_id,
    workspaceId: l.workspace_id,
    role: l.role,
    name: l.name ?? undefined,
    avatar: l.avatar ?? undefined,
  }));
};

/**
 * As primeiras N linhas de uma coleção, da mais nova para a mais velha.
 *
 * Para o que só cresce e ninguém lê inteiro: histórico de atividade,
 * notificações, apontamentos de hora. Antes vinham completos — e são
 * justamente as tabelas com mais linhas por agência.
 */
const listarRecentes = async <T extends { id: string }>(
  tabela: string,
  daLinha: (l: any) => T,
  limite = LIMITE_DE_HISTORICO
): Promise<T[]> => {
  const { data, error } = await supabase
    .from(tabela)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw traduzirErro(error);
  return (data || []).map(daLinha);
};

/**
 * Carrega o que a sessão precisa, em paralelo.
 *
 * A RLS já recorta por agência, então não passamos workspace_id.
 *
 * **Nem tudo vem.** Jobs seguem a regra da janela (abertos sempre, concluídos
 * só os recentes) e as três coleções de histórico vêm limitadas. As demais —
 * clientes, leads, propostas, contratos, automações — não têm janela de
 * propósito: elas são limitadas pelo tamanho do negócio, não pelo tempo, e
 * uma agência com 300 clientes é um problema de outra natureza.
 */
export const carregarTudo = async () => {
  const [
    workspaces, membros, clients, jobs, leads, proposals, contracts,
    automations, notifications, activityLogs, clientMaterials, timesheetLogs,
  ] = await Promise.all([
    listarWorkspaces(),
    listarMembros(),
    db.clients.listar(),
    listarJobsDaJanela(),
    db.leads.listar(),
    db.proposals.listar(),
    db.contracts.listar(),
    db.automations.listar(),
    listarRecentes('notifications', notificationDaLinha, 100),
    listarRecentes('activity_logs', activityLogDaLinha),
    listarRecentes('client_materials', clientMaterialDaLinha),
    listarRecentes('timesheet_logs', timesheetLogDaLinha),
  ]);

  return {
    workspaces, membros, clients, jobs, leads, proposals, contracts,
    automations, notifications, activityLogs, clientMaterials, timesheetLogs,
  };
};
