import { supabase } from './supabase';
import { ApiError } from './api';

/**
 * As contas do Google Drive da agência: conectadas uma vez, usadas sempre.
 *
 * A primeira versão pedia autorização **a cada peça**, no navegador. Quem
 * monta dez posts numa tarde autorizava dez vezes, e o token morria em uma
 * hora.
 *
 * **E era uma conta só.** Uma agência costuma ter o Drive dela e o do
 * cliente, e quem monta a peça precisa escolher de onde buscar antes de
 * abrir o seletor — com uma conta só, buscar no Drive do cliente exigia
 * desconectar e reconectar.
 *
 * O `refresh_token` de cada conta fica no servidor, numa tabela sem política
 * nenhuma; a aba pede um token de uma hora quando precisa, dizendo de qual
 * conta.
 */

export interface ContaDoDrive {
  id: string;
  workspaceId: string;
  /** De quem é a conta. Nulo é "o Google não devolveu", não "ninguém". */
  email?: string;
  conectadaEm: string;
}

/**
 * As contas desta agência, da mais antiga para a mais nova.
 *
 * A ordem não é estética: quando uma arte foi escolhida antes de existir
 * mais de uma conta, a referência dela não diz de qual veio — e o servidor
 * cai na **mais antiga**, que é a única que existia naquele momento. A tela
 * mostra na mesma ordem para que as duas coisas contem a mesma história.
 */
export const contasDoDrive = async (workspaceId: string): Promise<ContaDoDrive[]> => {
  const { data, error } = await supabase
    .from('drive_contas')
    .select('id, workspace_id, email, conectado_em')
    .eq('workspace_id', workspaceId)
    .order('conectado_em');

  if (error || !data) return [];
  return data.map((l: any) => ({
    id: l.id,
    workspaceId: l.workspace_id,
    email: l.email ?? undefined,
    conectadaEm: l.conectado_em,
  }));
};

/**
 * Abre a janela de autorização do Google.
 *
 * A URL é montada no servidor porque leva o `state` assinado — montá-la aqui
 * significaria mandar o segredo da assinatura para o navegador. Mesma razão
 * e mesma rota do Instagram.
 *
 * Conectar de novo a **mesma** conta atualiza a que já existe; conectar
 * outra acrescenta.
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
    throw new ApiError(
      payload?.error || `Falha na requisição (${resposta.status}).`,
      resposta.status,
      payload?.code
    );
  }

  // Janela separada em vez de redirecionar: assim o trabalho em andamento na
  // aba não se perde se a pessoa desistir no meio da autorização.
  window.open(payload.url, 'orquesia-drive', 'width=600,height=780');
};

/**
 * Desconecta uma conta.
 *
 * A credencial some junto, pelo `on delete cascade` — e some do servidor,
 * não da conta do Google. Quem quiser retirar o acesso lá também faz isso em
 * myaccount.google.com; a tela diz isso.
 */
export const desconectarDrive = async (contaId: string): Promise<void> => {
  const { error } = await supabase.from('drive_contas').delete().eq('id', contaId);
  if (error) throw new Error(error.message);
};

/**
 * Um token de acesso de uma hora, pedido ao servidor.
 *
 * **O refresh token nunca chega aqui.** Ele é o que dá acesso continuado à
 * conta do Google; no navegador, viraria acesso permanente para quem abrisse
 * o console. O servidor guarda o token curto enquanto ele vale, então esta
 * chamada quase sempre não fala com o Google.
 *
 * `contaId` ausente cai na conta mais antiga da agência — o caminho das
 * referências gravadas antes de existir mais de uma.
 */
export const tokenDoDrive = async (
  workspaceId: string,
  contaId?: string
): Promise<{ token: string; appId: string }> => {
  const { data: sessao } = await supabase.auth.getSession();
  const sessaoToken = sessao.session?.access_token;
  if (!sessaoToken) throw new ApiError('Faça login para usar o Drive.', 401);

  const resposta = await fetch('/api/social-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessaoToken}` },
    body: JSON.stringify({ acao: 'token-do-drive', workspaceId, contaId }),
  });

  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ApiError(
      payload?.error || `Falha na requisição (${resposta.status}).`,
      resposta.status,
      payload?.code
    );
  }

  /*
    O id do projeto vem junto porque o seletor precisa dele para o
    `drive.file` valer — sem ele a escolha acontece e toda leitura depois
    volta 404. Ver `abrirSeletorDoDrive`.
  */
  return { token: payload.token as string, appId: payload.appId as string };
};
