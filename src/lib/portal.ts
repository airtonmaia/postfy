import { supabase } from './supabase';
import { clientDaLinha, jobDaLinha, clientMaterialDaLinha, workspaceDaLinha } from './mappers';
import type {
  Client, Job, ClientMaterial, Workspace, ClientUserRole,
} from '../types';

/**
 * Dados do Portal do Cliente, para quem não tem sessão de agência.
 *
 * O restante do app lê as tabelas direto, e a RLS recorta por agência a
 * partir do `auth.uid()`. No portal não existe `auth.uid()`: quem está ali é
 * o cliente da agência, que nunca teve conta no sistema. Então tudo passa por
 * RPCs `security definer` que recebem o token do portal e recortam por ele.
 *
 * O token vale como credencial — é ele que o código enviado por e-mail
 * destrava. Fora daqui, nenhuma tabela é alcançável por sessão anônima.
 */

/**
 * Onde o token fica entre um F5 e outro.
 *
 * `sessionStorage`, não `localStorage`: o portal roda na máquina do cliente,
 * que pode ser compartilhada, e a credencial deve morrer junto com a aba.
 * Sem guardar em lugar nenhum, recarregar a página jogava a pessoa de volta
 * para a tela do código a cada vez.
 *
 * Isolado neste módulo para o teste de guarda em `tests/ids.test.ts`
 * continuar valendo sobre o contexto, onde mora o estado da agência.
 */
const CHAVE_TOKEN = 'orquesia:portal';

export const tokenGuardado = (): string | null => {
  try {
    return window.sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
};

export const guardarToken = (token: string): void => {
  try {
    window.sessionStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    /* Sem sessionStorage a sessão dura até o F5, e só. */
  }
};

export const esquecerToken = (): void => {
  try {
    window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* idem */
  }
};

/**
 * Marca da agência na porta do portal, antes de haver sessão.
 *
 * O portal é whitelabel: quem chega foi convidado pela agência, não pelo
 * Orquesia. Sem isto a tela abre com a nossa marca, e o cliente conclui que
 * errou o endereço.
 *
 * Devolve `null` quando o slug não existe ou a rede falha — a tela cai na
 * marca padrão em vez de não abrir. Ninguém deixa de aprovar conteúdo porque
 * o logo não carregou.
 */
export const carregarMarcaDaAgencia = async (
  slug: string
): Promise<Pick<Workspace, 'name' | 'slug' | 'logo' | 'favicon' | 'primaryColor' | 'secondaryColor'> | null> => {
  try {
    const { data, error } = await supabase.rpc('marca_da_agencia', { p_slug: slug });
    if (error || !data) return null;

    const b = data as any;
    return {
      name: b.name,
      slug: b.slug,
      logo: b.logo ?? '',
      favicon: b.favicon ?? null,
      primaryColor: b.primary_color ?? '#6366f1',
      secondaryColor: b.secondary_color ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * Quem está do outro lado da sessão, e até onde ela vai.
 *
 * O papel chega do banco junto com os dados porque é ele que decide o que
 * veio — não é a tela que escolhe esconder. Para o aprovador, `cliente` chega
 * sem `passwords`, `invoices`, `briefing` e `files`: os campos não saem do
 * Postgres.
 */
export interface UsuarioDoPortal {
  id: string;
  nome: string;
  email: string;
  papel: ClientUserRole;
}

export interface DadosDoPortal {
  usuario: UsuarioDoPortal;
  cliente: Client;
  workspace: Workspace;
  jobs: Job[];
  materiais: ClientMaterial[];
}

export const carregarPortal = async (token: string): Promise<DadosDoPortal | null> => {
  const { data, error } = await supabase.rpc('portal_dados', { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const bruto = data as any;
  const u = bruto.usuario || {};

  return {
    usuario: {
      id: u.id,
      // O nome é opcional no cadastro: cai no e-mail em vez de virar "null"
      // no cabeçalho da tela.
      nome: u.nome || u.email || 'Cliente',
      email: u.email || '',
      papel: u.papel === 'editor' ? 'editor' : 'aprovador',
    },
    cliente: clientDaLinha(bruto.cliente),
    workspace: workspaceDaLinha(bruto.workspace),
    jobs: (bruto.jobs || []).map(jobDaLinha),
    materiais: (bruto.materiais || []).map(clientMaterialDaLinha),
  };
};

/**
 * Aprovar e pedir ajuste passam por RPC pelo mesmo motivo da leitura: um
 * `update` direto na tabela `jobs` seria recusado pela RLS, e a tela mostraria
 * a aprovação que o banco nunca gravou.
 */
export const aprovarPeloPortal = async (
  token: string,
  jobId: string,
  quem: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_aprovar', {
    p_token: token,
    p_job_id: jobId,
    p_quem: quem,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};

export const pedirAjustePeloPortal = async (
  token: string,
  jobId: string,
  feedback: string,
  quem: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_pedir_ajuste', {
    p_token: token,
    p_job_id: jobId,
    p_feedback: feedback,
    p_quem: quem,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};

/**
 * Escrita do editor pelo portal: arquivos, senhas e briefing.
 *
 * Um `update` direto em `clients` seria recusado pela RLS — quem está no
 * portal não tem sessão do Supabase. A RPC confere o papel e tem a lista
 * fechada de campos: `invoices` fica de fora porque quem emite nota é a
 * agência, e um campo não previsto levanta erro em vez de ser ignorado.
 */
export const salvarDadosPeloPortal = async (
  token: string,
  campos: Partial<Pick<Client, 'files' | 'passwords' | 'briefing'>>
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_salvar_dados', {
    p_token: token,
    p_campos: campos,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};

/**
 * Material enviado pelo cliente.
 *
 * Antes isto passava pelo estado do app e pela persistência derivada de
 * diff, que insere em `client_materials` com a sessão do navegador — e no
 * portal não há sessão. A RLS recusava a linha, a tela já tinha mostrado o
 * material na galeria, e ninguém via o erro. Agora é a RPC que grava, e o
 * material que volta é o que o banco aceitou.
 */
export const enviarMaterialPeloPortal = async (
  token: string,
  material: { titulo: string; categoria: string; url: string; notas?: string }
): Promise<ClientMaterial | null> => {
  const { data, error } = await supabase.rpc('portal_enviar_material', {
    p_token: token,
    p_titulo: material.titulo,
    p_categoria: material.categoria,
    p_url: material.url,
    p_notas: material.notas ?? null,
  });
  if (error) throw new Error(error.message);
  return data ? clientMaterialDaLinha(data) : null;
};

/**
 * Usuários do mesmo cliente, como o portal os vê.
 *
 * Tipo próprio, e não `ClientUser`: a RPC não devolve `workspace_id` nem
 * `client_id` — quem está no portal não escolhe cliente, o dele vem da
 * sessão. Preencher esses dois campos com string vazia só para caber no tipo
 * da agência seria inventar dado.
 */
export interface UsuarioListadoNoPortal {
  id: string;
  nome?: string;
  email: string;
  papel: ClientUserRole;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso?: string;
}

/** Só o editor enxerga — para o aprovador a RPC devolve `null`. */
export const listarUsuariosDoPortal = async (
  token: string
): Promise<UsuarioListadoNoPortal[]> => {
  const { data, error } = await supabase.rpc('portal_usuarios', { p_token: token });
  if (error) throw new Error(error.message);
  return ((data as any[]) || []).map((u) => ({
    id: u.id,
    nome: u.nome ?? undefined,
    email: u.email,
    papel: u.papel === 'editor' ? 'editor' : 'aprovador',
    ativo: Boolean(u.ativo),
    criadoEm: u.created_at,
    ultimoAcesso: u.ultimo_acesso ?? undefined,
  }));
};

export const criarUsuarioPeloPortal = async (
  token: string,
  usuario: { email: string; nome?: string; papel: ClientUserRole }
): Promise<void> => {
  const { error } = await supabase.rpc('portal_criar_usuario', {
    p_token: token,
    p_email: usuario.email,
    p_nome: usuario.nome ?? null,
    p_papel: usuario.papel,
  });
  if (error) throw new Error(error.message);
};

export const removerUsuarioPeloPortal = async (token: string, id: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_remover_usuario', {
    p_token: token,
    p_id: id,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};
