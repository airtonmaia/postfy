import { supabase } from './supabase';
import { ApiError } from './api';

/**
 * O Google Drive da agência: conectado uma vez, usado sempre.
 *
 * A primeira versão pedia autorização **a cada peça**, no navegador. Quem
 * monta dez posts numa tarde autorizava dez vezes, com a janela do Google
 * abrindo no meio do trabalho — e o token morria em uma hora.
 *
 * Agora é o mesmo modelo da conta de Instagram: a agência conecta, e todo
 * mundo dela escolhe arquivos por aquela conta. O `refresh_token` fica no
 * servidor, numa tabela sem política nenhuma; a aba pede um token de uma
 * hora quando precisa.
 */

export interface DriveConectado {
  workspaceId: string;
  /** De quem é a conta. Nulo é "o Google não devolveu", não "ninguém". */
  email?: string;
  conectadoEm: string;
}

/** A conexão desta agência, ou nulo se não houver. */
export const driveDaAgencia = async (workspaceId: string): Promise<DriveConectado | null> => {
  const { data, error } = await supabase
    .from('drive_da_agencia')
    .select('workspace_id, email, conectado_em')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    workspaceId: data.workspace_id,
    email: data.email ?? undefined,
    conectadoEm: data.conectado_em,
  };
};

/**
 * Abre a janela de autorização do Google.
 *
 * A URL é montada no servidor porque leva o `state` assinado — montá-la aqui
 * significaria mandar o segredo da assinatura para o navegador. Mesma razão
 * e mesma rota do Instagram.
 */
export const conectarDrive = async (workspaceId: string): Promise<void> => {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new ApiError('Faça login para conectar o Drive.', 401);

  const resposta = await fetch('/api/social-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId, rede: 'google_drive' }),
  });

  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ApiError(payload?.error || `Falha na requisição (${resposta.status}).`, resposta.status, payload?.code);
  }

  // Janela separada em vez de redirecionar: assim o trabalho em andamento na
  // aba não se perde se a pessoa desistir no meio da autorização.
  window.open(payload.url, 'orquesia-drive', 'width=600,height=780');
};

/**
 * Desconecta.
 *
 * A credencial some junto, pelo `on delete cascade` — e some do servidor, não
 * da conta do Google. Quem quiser retirar o acesso lá também faz isso em
 * myaccount.google.com; a tela diz isso.
 */
export const desconectarDrive = async (workspaceId: string): Promise<void> => {
  const { error } = await supabase.from('drive_da_agencia').delete().eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);
};

/**
 * Um token de acesso de uma hora, pedido ao servidor.
 *
 * **O refresh token nunca chega aqui.** Ele é o que dá acesso continuado à
 * conta do Google; no navegador, viraria acesso permanente para quem abrisse
 * o console. O servidor guarda o token curto enquanto ele vale, então esta
 * chamada quase sempre não fala com o Google.
 */
export const tokenDoDrive = async (
  workspaceId: string
): Promise<{ token: string; appId: string }> => {
  const { data: sessao } = await supabase.auth.getSession();
  const sessaoToken = sessao.session?.access_token;
  if (!sessaoToken) throw new ApiError('Faça login para usar o Drive.', 401);

  const resposta = await fetch('/api/social-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessaoToken}` },
    body: JSON.stringify({ acao: 'token-do-drive', workspaceId }),
  });

  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ApiError(payload?.error || `Falha na requisição (${resposta.status}).`, resposta.status, payload?.code);
  }

  /*
    O id do projeto vem junto porque o seletor precisa dele para o
    `drive.file` valer — sem ele a escolha acontece e toda leitura depois
    volta 404. Ver `abrirSeletorDoDrive`.
  */
  return { token: payload.token as string, appId: payload.appId as string };
};
