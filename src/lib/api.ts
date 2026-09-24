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

export const chamar = async <T>(caminho: string, corpo: unknown): Promise<T> => {
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
  /**
   * Envia e devolve a URL pública **e a chave no balde**.
   *
   * A chave existe por causa da cópia temporária da mídia do Drive: ela é
   * apagada depois de a peça ir ao ar, e apagar pede a chave. Derivá-la do
   * endereço público seria adivinhar o caminho — e um engano ali apaga arte
   * da agência, não a cópia.
   */
  enviarComChave: async (
    arquivo: File,
    workspaceId: string,
    onProgress?: (porcentagem: number) => void
  ): Promise<{ url: string; chave: string }> => {
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
    return { url: publicUrl, chave: key };
  },

  /**
   * A miniatura de um arquivo do Drive, já guardada no balde.
   *
   * **Quem busca é o servidor, e isso não é preferência.** O endereço de
   * miniatura do Google aponta para `lh3.googleusercontent.com`, que não
   * manda cabeçalho de origem cruzada: o `fetch` daqui falha antes de ler o
   * primeiro byte. A primeira versão tentou no navegador e a miniatura vinha
   * sempre vazia — o cartão mostrava o nome do arquivo, e a prévia e o portal
   * ficavam em branco.
   *
   * Devolve `null` quando não há miniatura. A peça continua válida: o cartão
   * mostra o nome do arquivo em vez de um quadro vazio.
   */
  miniaturaDoDrive: async (
    workspaceId: string,
    fileId: string
  ): Promise<{ url: string | null; motivo?: string }> => {
    try {
      return await chamar<{ url: string | null; motivo?: string }>('/api/upload-url', {
        acao: 'miniatura-do-drive',
        workspaceId,
        fileId,
      });
    } catch (erro) {
      /*
        Sem miniatura a peça continua válida — mas o **motivo** volta junto.
        Duas versões desta entrega falharam em silêncio: a falha era
        capturada, virava "sem miniatura", e o quadro vazio não dizia se o
        problema era o Google, o balde ou a autorização.
      */
      return { url: null, motivo: erro instanceof Error ? erro.message : 'falha desconhecida' };
    }
  },

  /**
   * Traz um arquivo do Drive para o balde — **pelo servidor**.
   *
   * O download do Drive redireciona para `googleusercontent.com`, e o destino
   * do redirecionamento não manda cabeçalho de origem cruzada: no navegador
   * ele morre antes do primeiro byte, com o erro capturado e a peça ficando
   * sem cópia calada. Dois vídeos seguidos falharam assim enquanto a
   * miniatura — que já era buscada no servidor — passava nos dois.
   *
   * Devolve o motivo quando não dá, porque "sem cópia" é um desfecho válido e
   * silencioso ele é indistinguível de defeito.
   */
  copiarDoDrive: async (
    workspaceId: string,
    fileId: string
  ): Promise<{ url: string | null; chave?: string; motivo?: string }> => {
    try {
      return await chamar<{ url: string | null; chave?: string; motivo?: string }>(
        '/api/upload-url',
        { acao: 'copiar-do-drive', workspaceId, fileId }
      );
    } catch (erro) {
      return { url: null, motivo: erro instanceof Error ? erro.message : 'falha desconhecida' };
    }
  },

  /**
   * Libera (ou tranca) por link os arquivos do Drive de uma peça.
   *
   * É o que faz o **player do Google** tocar no portal do cliente — ele
   * transcodifica e escolhe a resolução pela conexão, enquanto um `<video>`
   * apontando para o nosso balde entrega o original inteiro.
   *
   * O preço é explícito e temporário: enquanto a liberação existe, quem tem
   * o endereço do arquivo assiste. Ela é retirada quando a peça sai de
   * aprovação.
   */
  acessoNoDrive: async (
    workspaceId: string,
    fileIds: string[],
    liberar: boolean
  ): Promise<void> => {
    if (!fileIds.length) return;
    try {
      await chamar<{ ok: boolean }>('/api/upload-url', {
        acao: liberar ? 'liberar-no-drive' : 'trancar-no-drive',
        workspaceId,
        fileIds,
      });
    } catch {
      /*
        Sem a liberação o portal cai na capa parada, que é o que ele mostrava
        antes. Derrubar a criação da peça por causa disso seria trocar o
        essencial pelo acessório.
      */
    }
  },

  /** O caminho de sempre, para quem só precisa do endereço. */
  enviar: async (
    arquivo: File,
    workspaceId: string,
    onProgress?: (porcentagem: number) => void
  ): Promise<string> => (await arquivosApi.enviarComChave(arquivo, workspaceId, onProgress)).url,
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

  /** INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET — não são os do app da Meta. */
  instagram: boolean;
  /**
   * FACEBOOK_APP_ID e FACEBOOK_APP_SECRET.
   *
   * **Outro app na Meta, outro par de credenciais.** `/api/status` respondia
   * isto desde que o Facebook passou a publicar, e este tipo não tinha o
   * campo — então a tela de Integrações não tinha como mostrar o estado, e
   * quem fosse configurar o Facebook não descobria o que faltava por aqui.
   */
  facebook: boolean;
  /**
   * Os escopos que o servidor pede em cada rede, como ele os pede.
   *
   * Vêm do servidor porque a tela precisa dizer o que cadastrar na Meta, e
   * uma lista escrita à mão aqui divergiria de `ESCOPOS_*` sem quebrar nada
   * — o erro só apareceria depois de alguém digitar a senha.
   */
  escopos: { instagram: string[]; facebook: string[] };
  /** Assina o `state` do OAuth. Sem ele a conexão nem começa. */
  estadoDoOauth: boolean;
  /** CRON_SECRET. Sem ele o agendador leva 401 em toda passada. */
  agendador: boolean;
  /** R2_PUBLIC_BASE_URL. A Meta baixa a mídia da URL, então precisa ser pública. */
  midiaPublica: boolean;
  /** A URL de retorno que precisa estar cadastrada na Meta, igual. */
  urlDeRetorno: string;

  /** STRIPE_SECRET_KEY — abre a API do Stripe. */
  cobranca: boolean;
  /** STRIPE_PRICE_ID — o preço que o checkout cobra. */
  cobrancaPreco: boolean;
  /**
   * STRIPE_WEBHOOK_SECRET. É o único que não nasce na Vercel: o Stripe o
   * gera quando o endpoint é cadastrado no painel dele.
   */
  cobrancaWebhook: boolean;
  /** A URL para colar em Stripe → Developers → Webhooks. */
  urlDoWebhook: string;
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

  /**
   * Entrar com a senha que a agência definiu.
   *
   * Passa pela rota, e não direto pelo `supabase.rpc`, pelo mesmo motivo do
   * código: `portal_entrar_com_senha` tem EXECUTE só para `service_role`,
   * porque sem o limite de taxa da rota na frente ela seria um oráculo de
   * senha chamável do navegador de qualquer um.
   */
  entrarComSenha: (email: string, senha: string) =>
    chamarAnonimo<{ token: string }>('/api/portal-login', { acao: 'senha', email, senha }),
};
