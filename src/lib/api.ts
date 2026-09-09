import { supabase } from './supabase';

/**
 * Cliente das funções serverless (/api/*).
 *
 * Só sobrou aqui o que precisa mesmo de servidor: a chave do Gemini, as
 * credenciais do R2 e a do Resend — segredos que não podem ir para o bundle.
 * Autenticação e dados vão direto do navegador para o Supabase, protegidos
 * pela RLS.
 *
 * O token da sessão vai no header Authorization e a função o valida contra o
 * próprio Supabase, então ela nunca confia no que o navegador afirma.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** Recurso existe, mas o ambiente não foi configurado. */
  get naoConfigurado(): boolean {
    return this.status === 503;
  }
}

const chamar = async <T>(caminho: string, corpo: unknown): Promise<T> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new ApiError('Faça login para usar este recurso.', 401);
  }

  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique sua conexão.', 0);
  }

  const ehJson = resposta.headers.get('content-type')?.includes('application/json');
  const payload = ehJson ? await resposta.json().catch(() => ({})) : {};

  if (!resposta.ok) {
    throw new ApiError(
      payload?.error || `Falha na requisição (${resposta.status}).`,
      resposta.status,
      payload?.code
    );
  }

  return payload as T;
};

export const aiApi = {
  generateCopy: (params: Record<string, unknown>) =>
    chamar<any>('/api/gemini', { action: 'generate-copy', ...params }),

  convertFeedback: (params: Record<string, unknown>) =>
    chamar<any>('/api/gemini', { action: 'convert-feedback', ...params }),

  editorialIdeas: (params: Record<string, unknown>) =>
    chamar<any>('/api/gemini', { action: 'editorial-ideas', ...params }),
};

export interface UrlDeUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string | null;
}

export const arquivosApi = {
  /** Pede a URL pré-assinada; o binário vai do navegador direto para o R2. */
  pedirUrl: (input: {
    fileName: string;
    contentType: string;
    size: number;
    workspaceId: string;
  }) => chamar<UrlDeUpload>('/api/upload-url', input),

  /**
   * Envia o arquivo e devolve a URL pública.
   * onProgress usa XMLHttpRequest porque fetch não reporta progresso de envio.
   */
  enviar: async (
    arquivo: File,
    workspaceId: string,
    onProgress?: (porcentagem: number) => void
  ): Promise<string> => {
    const { uploadUrl, publicUrl, key } = await arquivosApi.pedirUrl({
      fileName: arquivo.name,
      contentType: arquivo.type || 'application/octet-stream',
      size: arquivo.size,
      workspaceId,
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream');

      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable && onProgress) {
          onProgress(Math.round((evento.loaded / evento.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new ApiError('Falha ao enviar o arquivo.', xhr.status));
      xhr.onerror = () => reject(new ApiError('Falha de rede ao enviar o arquivo.', 0));
      xhr.send(arquivo);
    });

    if (!publicUrl) {
      throw new ApiError(
        'Arquivo enviado, mas o bucket não tem domínio público configurado (R2_PUBLIC_BASE_URL). ' +
          `Chave: ${key}`,
        500
      );
    }
    return publicUrl;
  },
};

export interface StatusDoServidor {
  ia: boolean;
  armazenamento: boolean;
  armazenamentoPublico: boolean;
  email: boolean;
}

/**
 * Estado real das integrações do servidor.
 *
 * A tela lia de uma lista fixa no código, que envelheceu sem ninguém notar.
 * Agora pergunta.
 */
export const statusApi = {
  consultar: () => chamar<StatusDoServidor>('/api/status', {}),
};

export const conviteApi = {
  enviarPorEmail: (input: {
    email: string;
    link: string;
    workspaceId: string;
    agencyName?: string;
    inviterName?: string;
  }) => chamar<{ ok: boolean }>('/api/send-invite', input),
};

export const webhookApi = {
  test: (url: string, event?: string) =>
    chamar<{ ok: boolean; status?: number; statusText?: string }>('/api/webhook-test', {
      url,
      event,
    }),
};
