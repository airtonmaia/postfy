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

/**
 * Pasta dos arquivos do próprio produto — marca, banners, imagem de prévia.
 *
 * Não pertencem a agência nenhuma. `api/upload-url.ts` reconhece este valor e
 * exige, no banco, que quem envia esteja em `platform_admins`.
 */
export const PASTA_DA_PLATAFORMA = 'plataforma';

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

export interface RespostaDeEmail {
  enviado: boolean;
  para?: string;
  motivo?: string;
}

/**
 * Disparo de e-mail do sistema.
 *
 * Manda só o evento e o conteúdo: assunto, corpo e destinatário são
 * resolvidos no servidor a partir do banco. Se viessem daqui, qualquer
 * sessão autenticada teria um remetente @orquesia.com.br para escrever o que
 * quisesse.
 */
export const emailApi = {
  disparar: (evento: string, jobId: string) =>
    chamar<RespostaDeEmail>('/api/send-email', { evento, jobId }),
};

export interface StatusDoServidor {
  ia: boolean;
  armazenamento: boolean;
  armazenamentoPublico: boolean;
  email: boolean;
  /** A variável existe. */
  chaveDeServico: boolean;
  /**
   * O banco aceitou a variável.
   *
   * Separado de `chaveDeServico` porque os dois estados se resolvem de
   * formas diferentes, e confundi-los custou caro: uma chave preenchida com
   * valor inválido derrubou o Portal do Cliente e esta tela seguiu verde.
   */
  chaveDeServicoValida: boolean;
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

/**
 * Chamada sem sessão.
 *
 * `chamar` exige o token do Supabase e é isso que queremos em toda rota da
 * agência. O portal é o oposto: quem bate nele ainda não provou ser ninguém —
 * é justamente o que a rota vai decidir.
 */
const chamarAnonimo = async <T>(caminho: string, corpo: unknown): Promise<T> => {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique sua conexão.', 0);
  }

  const ehJson = resposta.headers.get('content-type')?.includes('application/json');
  const payload = ehJson ? await resposta.json().catch(() => ({})) : {};

  if (!resposta.ok) {
    throw new ApiError(
      (payload as any)?.error || `Falha na requisição (${resposta.status}).`,
      resposta.status
    );
  }

  return payload as T;
};

/** Entrada do Portal do Cliente: e-mail, código, token. */
export const portalApi = {
  enviarCodigo: (email: string) =>
    chamarAnonimo<{ enviado: boolean }>('/api/portal-login', { acao: 'enviar', email }),

  conferirCodigo: (email: string, codigo: string) =>
    chamarAnonimo<{ token: string }>('/api/portal-login', { acao: 'conferir', email, codigo }),
};
