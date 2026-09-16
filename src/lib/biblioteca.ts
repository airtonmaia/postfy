import { supabase } from './supabase';
import { ApiError } from './api';

/**
 * A Biblioteca: todo arquivo que a agência tem no R2.
 *
 * ### Por que ela lê o balde, e não uma tabela
 *
 * Um índice em tabela seria mais simples de consultar e só conheceria o que
 * foi enviado **depois de ele existir**. O acervo de uma agência em uso já
 * está no R2 — começar do zero esconderia meses de arquivo e faria a tela
 * mentir por omissão logo no primeiro dia.
 *
 * ### E por que a pasta do cliente é derivada
 *
 * A chave no R2 é `workspaceId/timestamp-uuid-nome`: plana, sem cliente. Pôr
 * o cliente na chave resolveria os arquivos novos e deixaria os antigos
 * órfãos para sempre — e o mesmo arquivo pode ser usado por dois clientes,
 * que uma pasta física não representa.
 *
 * Então a pasta sai do **uso**: quem aponta para aquela URL. Isso dá de
 * graça a resposta da outra pergunta que importa na hora de excluir — *em
 * quantos conteúdos esta mídia está?* — e é a mesma consulta.
 */

export interface ArquivoDaBiblioteca {
  key: string;
  url: string | null;
  tamanho: number;
  modificadoEm: string | null;
}

/** Onde uma URL é usada. Vazio = ninguém aponta para ela. */
export interface UsoDoArquivo {
  clientIds: string[];
  /** Conteúdos que usam esta mídia, pelo título. */
  jobs: { id: string; title: string; status: string }[];
  /** Material enviado pelo cliente, ou arquivo anexado à ficha dele. */
  outros: number;
}

const semSessao = () => new ApiError('Faça login para acessar a biblioteca.', 401);

const chamar = async (caminho: string, init?: RequestInit): Promise<any> => {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw semSessao();

  const resposta = await fetch(caminho, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
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
  return payload;
};

export const listarArquivos = async (workspaceId: string): Promise<ArquivoDaBiblioteca[]> => {
  const { arquivos } = await chamar(
    `/api/upload-url?workspaceId=${encodeURIComponent(workspaceId)}`
  );
  return arquivos || [];
};

export const excluirArquivo = async (workspaceId: string, key: string): Promise<void> => {
  await chamar(
    `/api/upload-url?workspaceId=${encodeURIComponent(workspaceId)}&key=${encodeURIComponent(key)}`,
    { method: 'DELETE' }
  );
};

/**
 * De quem é cada arquivo, e onde ele está sendo usado.
 *
 * As três consultas vão ao banco em vez de usar o estado já carregado, e isso
 * é de propósito: `carregarTudo` traz só 90 dias de conteúdo publicado (ver
 * **Performance** no CLAUDE.md). Uma mídia usada por um post mais antigo
 * apareceria como "sem cliente" — errado, e exatamente no caso em que a
 * pessoa mais confia na tela para decidir se pode apagar.
 *
 * Passam pela RLS como qualquer outra consulta, então já vêm recortadas pela
 * agência.
 */
export const levantarUsos = async (): Promise<Map<string, UsoDoArquivo>> => {
  const usos = new Map<string, UsoDoArquivo>();

  const registrar = (
    url: string | null | undefined,
    clientId: string | null | undefined,
    job?: { id: string; title: string; status: string }
  ) => {
    if (!url) return;
    const atual = usos.get(url) || { clientIds: [], jobs: [], outros: 0 };
    if (clientId && !atual.clientIds.includes(clientId)) atual.clientIds.push(clientId);
    if (job) atual.jobs.push(job);
    else atual.outros += 1;
    usos.set(url, atual);
  };

  const [conteudos, materiais, fichas] = await Promise.all([
    supabase.from('jobs').select('id, title, status, client_id, media_urls'),
    supabase.from('client_materials').select('client_id, url'),
    supabase.from('clients').select('id, files'),
  ]);

  for (const j of conteudos.data || []) {
    for (const url of (j.media_urls as string[] | null) || []) {
      registrar(url, j.client_id, { id: j.id, title: j.title, status: j.status });
    }
  }

  for (const m of materiais.data || []) registrar(m.url, m.client_id);

  for (const c of fichas.data || []) {
    for (const f of (c.files as { url?: string }[] | null) || []) {
      registrar(f?.url, c.id);
    }
  }

  return usos;
};

/**
 * O nome que a pessoa reconhece, tirado da chave.
 *
 * A chave carrega `timestamp-uuid-` na frente para não colidir, e isso não
 * diz nada a quem está procurando uma arte. Mostrar a chave crua faria a
 * lista virar uma parede de hexadecimal.
 */
export const nomeDoArquivo = (key: string): string => {
  const ultimo = key.split('/').pop() || key;
  return ultimo.replace(/^\d+-[0-9a-f]{8}-/i, '') || ultimo;
};

/** `image`, `video` ou `documento`, pelo que a extensão diz. */
export const tipoDoArquivo = (key: string): 'image' | 'video' | 'documento' => {
  if (/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(key)) return 'image';
  if (/\.(mp4|mov|webm)$/i.test(key)) return 'video';
  return 'documento';
};

/** "1,4 MB". Bytes crus numa lista de arte não dizem nada. */
export const tamanhoLegivel = (bytes: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};
