import { supabase } from './supabase';
import { ApiError } from './api';
import type { JobPlatform } from '../types';

/**
 * Contas de rede social conectadas e fila de publicação.
 *
 * Os metadados da conexão vêm direto do Supabase, com RLS. O token não: ele
 * mora numa tabela sem política nenhuma, inalcançável pelo navegador, e só a
 * função serverless o lê. Não existe caminho daqui até ele — de propósito.
 */

/**
 * Quais redes o servidor publica sozinho — a lista é esta, e só esta.
 *
 * `JobPlatform` tem seis redes, e a tela deixava marcar todas. Mas
 * `api/publicar.ts` só fala com o Instagram: para as outras cinco o conteúdo
 * ficava "Agendado" no quadro e **não publicava nunca**, sem erro em lugar
 * nenhum. Com o multicanal isso piorou — dá para marcar três redes num
 * conteúdo e duas ficarem mudas.
 *
 * Prometer agendamento que não acontece é a armadilha 9 no pior lugar: o
 * cliente aprovou, a agência confiou na data, e a peça não foi ao ar.
 *
 * Esta constante é a fonte única. A tela deriva dela o que dizer, e
 * `tests/publicacao.test.ts` confere que ela não afirma mais do que o
 * servidor implementa — acrescentar uma rede aqui sem escrever o publicador
 * faz o teste falhar.
 */
export const REDES_QUE_PUBLICAM: readonly JobPlatform[] = ['instagram'] as const;

export const publicaSozinho = (rede: JobPlatform): boolean =>
  REDES_QUE_PUBLICAM.includes(rede);

/**
 * O que dizer sobre uma rede que não publica sozinha.
 *
 * Não é "em breve": não há data, e prometer prazo que ninguém assumiu é a
 * mesma mentira com outra roupa. O conteúdo continua sendo planejado,
 * aprovado e agendado aqui — só a postagem é manual.
 */
export const COMO_PUBLICA: Record<JobPlatform, string> = {
  instagram: 'Publica sozinho na data, se a conta estiver conectada.',
  facebook: 'Postagem manual: o Orquesia organiza e aprova, você publica.',
  linkedin: 'Postagem manual: o Orquesia organiza e aprova, você publica.',
  tiktok: 'Postagem manual: o Orquesia organiza e aprova, você publica.',
  youtube: 'Postagem manual: o Orquesia organiza e aprova, você publica.',
  twitter: 'Postagem manual: o Orquesia organiza e aprova, você publica.',
};

/**
 * As redes da Meta, e o que dá para fazer com cada uma **hoje**.
 *
 * A aba "Conexões do perfil" lista as quatro. Só o Instagram conecta: é o
 * único com o fluxo de OAuth escrito (`api/_lib/instagram.ts`), e cada uma
 * das outras precisa de coisa diferente, não de mais um botão.
 *
 * `pendencia` diz **o que falta, com nome**, e não "em breve": não há data, e
 * prometer prazo que ninguém assumiu é a mesma mentira com outra roupa. É a
 * mesma regra do `COMO_PUBLICA` acima e da aba Integrações.
 *
 * Botão que abre e falha depois do login é pior que botão ausente — foi
 * exatamente assim que a escolha errada de fluxo do Instagram custou quatro
 * rodadas de diagnóstico.
 */
export interface RedeDaMeta {
  id: 'instagram' | 'facebook' | 'threads' | 'whatsapp';
  rotulo: string;
  /** Dá para conectar agora. */
  disponivel: boolean;
  /** O que falta para a rede sair de `disponivel: false`. */
  pendencia?: string;
}

export const REDES_DA_META: readonly RedeDaMeta[] = [
  {
    id: 'instagram',
    rotulo: 'Instagram',
    disponivel: true,
  },
  {
    id: 'facebook',
    rotulo: 'Facebook',
    disponivel: false,
    // É outro fluxo, não o mesmo com outro nome: publicar numa Página usa o
    // login do Facebook e o token **da Página**, via `/me/accounts` — o
    // caminho que este projeto deliberadamente não seguiu para o Instagram.
    pendencia:
      'Exige o login do Facebook e o token da Página, que é um fluxo diferente do que está escrito, mais a revisão de pages_manage_posts.',
  },
  {
    id: 'threads',
    rotulo: 'Threads',
    disponivel: false,
    pendencia:
      'Tem API própria, com app e revisão separados (threads_basic e threads_content_publish).',
  },
  {
    id: 'whatsapp',
    rotulo: 'WhatsApp Business',
    disponivel: false,
    // Fica na lista porque é da Meta e a pergunta aparece. Mas o produto é
    // outro: mensagem para contato, não publicação em feed.
    pendencia:
      'É mensageria, não publicação em feed: serviria para falar com o cliente, e isso é outra funcionalidade.',
  },
] as const;

export interface ContaConectada {
  id: string;
  workspaceId: string;
  /** A qual cliente esta conta pertence. Nulo = conta da própria agência. */
  clientId?: string;
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
    clientId: l.client_id ?? undefined,
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
 *
 * `clientId` é obrigatório e diz de quem é a conta. É o que permite ao
 * agendador escolher o perfil certo na hora de publicar: todo conteúdo tem
 * cliente, então uma conexão sem cliente nunca publica coisa alguma — foi
 * assim que `social_connections.client_id` ficou vazia desde o começo.
 */
export const conectarConta = async (
  workspaceId: string,
  clientId: string
): Promise<void> => {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new ApiError('Faça login para conectar uma conta.', 401);

  const resposta = await fetch('/api/social-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId, clientId }),
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

/**
 * Espera o conteúdo existir no banco.
 *
 * A persistência é derivada de diff e roda em segundo plano: `createJob`
 * devolve o job e a tela já o mostra **antes** de o insert acontecer. Quem
 * pedir a publicação no instante seguinte encontra 404, e o erro não diz
 * nada sobre a integração — diz só que o clique foi rápido demais.
 */
const esperarOConteudoExistir = async (jobId: string, limiteMs = 10_000): Promise<boolean> => {
  const ateQuando = Date.now() + limiteMs;
  while (Date.now() < ateQuando) {
    const { data } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle();
    if (data) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};

export interface ResultadoDaPublicacao {
  externalId: string;
  conta: string;
}

/**
 * Publica um conteúdo agora, e espera a resposta da Meta.
 *
 * Diferente de `agendarPublicacao`, que só enfileira: aqui a publicação
 * acontece na mesma requisição, e o erro da Meta volta com o texto que ela
 * mandou. É a diferença entre descobrir que a integração falhou em segundos
 * e descobrir em cinco minutos, garimpando `last_error`.
 */
export const publicarAgora = async (jobId: string): Promise<ResultadoDaPublicacao> => {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new ApiError('Faça login para publicar.', 401);

  if (!(await esperarOConteudoExistir(jobId))) {
    throw new ApiError(
      'O conteúdo ainda não terminou de salvar. Espere um instante e tente de novo.',
      409
    );
  }

  const resposta = await fetch('/api/publicar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jobId }),
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

  return { externalId: payload.externalId, conta: payload.conta };
};
