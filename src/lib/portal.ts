import { supabase } from './supabase';
import { clientDaLinha, jobDaLinha, clientMaterialDaLinha, workspaceDaLinha } from './mappers';
import type { Client, Job, ClientMaterial, Workspace } from '../types';

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

export interface DadosDoPortal {
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

  return {
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
