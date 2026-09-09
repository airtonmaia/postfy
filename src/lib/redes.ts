import { supabase } from './supabase';
import { ApiError } from './api';

/**
 * Contas de rede social conectadas e fila de publicação.
 *
 * Os metadados da conexão vêm direto do Supabase, com RLS. O token não: ele
 * mora numa tabela sem política nenhuma, inalcançável pelo navegador, e só a
 * função serverless o lê. Não existe caminho daqui até ele — de propósito.
 */

export interface ContaConectada {
  id: string;
  workspaceId: string;
  platform: 'instagram' | 'facebook';
  accountId: string;
  accountName: string;
  createdAt: string;
}

export interface ItemDaFila {
  id: string;
  jobId: string;
  connectionId: string;
  scheduledFor: string;
  status: 'pendente' | 'publicando' | 'publicado' | 'falhou' | 'cancelado';
  attempts: number;
  lastError?: string;
  publishedAt?: string;
}

export const listarContas = async (): Promise<ContaConectada[]> => {
  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    id: l.id,
    workspaceId: l.workspace_id,
    platform: l.platform,
    accountId: l.account_id,
    accountName: l.account_name,
    createdAt: l.created_at,
  }));
};

export const desconectarConta = async (id: string): Promise<void> => {
  // O token some junto, pelo `on delete cascade`.
  const { error } = await supabase.from('social_connections').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

/**
 * Abre a janela do OAuth.
 *
 * A URL é montada no servidor porque leva o `state` assinado. Montá-la aqui
 * significaria mandar o segredo da assinatura para o navegador.
 */
export const conectarConta = async (workspaceId: string): Promise<void> => {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new ApiError('Faça login para conectar uma conta.', 401);

  const resposta = await fetch('/api/social-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId }),
  });

  const ehJson = resposta.headers.get('content-type')?.includes('application/json');
  const payload = ehJson ? await resposta.json().catch(() => ({})) : {};

  if (!resposta.ok) {
    throw new ApiError(
      payload?.error || `Falha na requisição (${resposta.status}).`,
      resposta.status,
      payload?.code
    );
  }

  // Janela separada em vez de redirecionar: assim o trabalho em andamento na
  // aba não se perde se a pessoa desistir no meio da autorização.
  window.open(payload.url, 'orquesia-social', 'width=600,height=780');
};

export const listarFila = async (): Promise<ItemDaFila[]> => {
  const { data, error } = await supabase
    .from('publish_queue')
    .select('*')
    .order('scheduled_for');

  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    id: l.id,
    jobId: l.job_id,
    connectionId: l.connection_id,
    scheduledFor: l.scheduled_for,
    status: l.status,
    attempts: l.attempts,
    lastError: l.last_error ?? undefined,
    publishedAt: l.published_at ?? undefined,
  }));
};

/**
 * Põe um conteúdo na fila.
 *
 * A restrição de unicidade no banco recusa o mesmo par conteúdo/conta duas
 * vezes: sem ela, um clique duplicado publicaria duas vezes no perfil do
 * cliente. Aqui a violação vira uma mensagem, não um erro cru.
 */
export const agendarPublicacao = async (
  workspaceId: string,
  jobId: string,
  connectionId: string,
  quando: string
): Promise<void> => {
  const { error } = await supabase.from('publish_queue').insert({
    workspace_id: workspaceId,
    job_id: jobId,
    connection_id: connectionId,
    scheduled_for: quando,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este conteúdo já está na fila para esta conta.');
    }
    if (error.code === '42501') {
      throw new Error('Seu perfil não pode agendar publicações.');
    }
    throw new Error(error.message);
  }
};

export const cancelarPublicacao = async (id: string): Promise<void> => {
  const { error } = await supabase.from('publish_queue').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
