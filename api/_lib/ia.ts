/**
 * Camada de IA independente de fornecedor.
 *
 * Havia acoplamento direto ao SDK do Gemini. Como quase todo fornecedor
 * (Groq, Cerebras, OpenRouter, Together, Mistral, DeepSeek, e modelos locais
 * via Ollama/LM Studio) expõe a mesma API de chat completions da OpenAI,
 * falar esse dialeto cobre todos eles — e o Gemini também, que tem endpoint
 * compatível.
 *
 * Trocar de fornecedor passa a ser mudar duas variáveis de ambiente, sem
 * tocar em código. Isso importa num recurso opcional: se a cota gratuita de
 * um acabar, dá para migrar sem release.
 */

export interface ConfiguracaoIA {
  baseUrl: string;
  apiKey: string;
  modelo: string;
  /** Nem todo fornecedor aceita response_format; alguns quebram se receber. */
  suportaJsonNativo: boolean;
}

/**
 * Presets dos fornecedores com camada gratuita. O usuário escolhe pelo nome
 * em IA_PROVEDOR e informa a chave; o resto é preenchido aqui.
 *
 * As cotas gratuitas mudam com frequência — confirme na página do fornecedor
 * antes de decidir. Aqui só registramos o endereço e o dialeto.
 */
const PRESETS: Record<string, Omit<ConfiguracaoIA, 'apiKey' | 'modelo'> & { modeloPadrao: string }> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modeloPadrao: 'gemini-2.5-flash',
    suportaJsonNativo: true,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    modeloPadrao: 'llama-3.3-70b-versatile',
    suportaJsonNativo: true,
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    modeloPadrao: 'llama-3.3-70b',
    suportaJsonNativo: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    modeloPadrao: 'meta-llama/llama-3.3-70b-instruct:free',
    suportaJsonNativo: true,
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    modeloPadrao: 'mistral-small-latest',
    suportaJsonNativo: true,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    modeloPadrao: 'gpt-4o-mini',
    suportaJsonNativo: true,
  },
};

export const configuracaoDaIA = (): ConfiguracaoIA | null => {
  const provedor = (process.env.IA_PROVEDOR || 'gemini').toLowerCase();

  // Um endpoint totalmente customizado (modelo local, gateway próprio) tem
  // prioridade sobre os presets.
  const baseCustomizada = process.env.IA_BASE_URL;
  const chave =
    process.env.IA_API_KEY ||
    process.env.GEMINI_API_KEY || // compatibilidade com a configuração anterior
    '';

  if (baseCustomizada) {
    if (!chave) return null;
    return {
      baseUrl: baseCustomizada.replace(/\/+$/, ''),
      apiKey: chave,
      modelo: process.env.IA_MODELO || 'gpt-4o-mini',
      suportaJsonNativo: process.env.IA_SEM_JSON_NATIVO !== 'true',
    };
  }

  const preset = PRESETS[provedor];
  if (!preset || !chave) return null;

  return {
    baseUrl: preset.baseUrl,
    apiKey: chave,
    modelo: process.env.IA_MODELO || process.env.GEMINI_MODEL || preset.modeloPadrao,
    suportaJsonNativo: preset.suportaJsonNativo,
  };
};

export class ErroDeIA extends Error {
  status: number;
  constructor(mensagem: string, status = 502) {
    super(mensagem);
    this.name = 'ErroDeIA';
    this.status = status;
  }
}

/**
 * Extrai o JSON da resposta.
 *
 * Mesmo pedindo JSON, vários modelos devolvem o objeto embrulhado em cerca de
 * markdown ou com um parágrafo antes. Tentar o parse direto e, se falhar,
 * recortar do primeiro `{` ao último `}` cobre os dois casos sem depender de
 * o fornecedor respeitar response_format.
 */
export const extrairJson = <T = any>(texto: string): T => {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio >= 0 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch {
        /* cai no erro abaixo */
      }
    }
    throw new ErroDeIA('O modelo devolveu uma resposta fora do formato JSON esperado.');
  }
};

/** Uma geração, pedindo JSON de volta. */
export const gerarJson = async <T = any>(
  prompt: string,
  config: ConfiguracaoIA,
  timeoutMs = 30_000
): Promise<T> => {
  const controlador = new AbortController();
  const prazo = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const corpo: Record<string, unknown> = {
      model: config.modelo,
      messages: [
        {
          role: 'system',
          content:
            'Você é um estrategista de conteúdo de agência brasileira. ' +
            'Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, ' +
            'sem cercas de markdown. Escreva em português do Brasil.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    };

    if (config.suportaJsonNativo) {
      corpo.response_format = { type: 'json_object' };
    }

    const resposta = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(corpo),
      signal: controlador.signal,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      // O detalhe vai para o log, não para o cliente: costuma conter o
      // endpoint e às vezes fragmento da chave.
      console.error('[ia] resposta do fornecedor', resposta.status, detalhe.slice(0, 500));

      if (resposta.status === 401 || resposta.status === 403) {
        throw new ErroDeIA('A chave da IA foi recusada pelo fornecedor.', 502);
      }
      if (resposta.status === 429) {
        throw new ErroDeIA('Cota da IA esgotada no momento. Tente novamente mais tarde.', 429);
      }
      throw new ErroDeIA('O serviço de IA não respondeu como esperado.', 502);
    }

    const dados = await resposta.json();
    const texto = dados?.choices?.[0]?.message?.content;

    if (typeof texto !== 'string' || !texto.trim()) {
      throw new ErroDeIA('O serviço de IA devolveu uma resposta vazia.');
    }

    return extrairJson<T>(texto);
  } catch (erro) {
    if (erro instanceof ErroDeIA) throw erro;
    if ((erro as any)?.name === 'AbortError') {
      throw new ErroDeIA('A geração demorou demais e foi interrompida.', 504);
    }
    throw new ErroDeIA('Não foi possível falar com o serviço de IA.');
  } finally {
    clearTimeout(prazo);
  }
};
