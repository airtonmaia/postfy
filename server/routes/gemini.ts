import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../lib/auth';
import { createRateLimiter, failSafely, isNonEmptyString } from '../lib/http';

/**
 * Rotas de IA. Todas exigem sessão: sem isso qualquer pessoa na internet
 * poderia queimar a cota da chave do Gemini.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let client: GoogleGenAI | null = null;
const getClient = (): GoogleGenAI | null => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

export const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  keyFn: (req) => req.user?.id || req.ip || 'anon',
  message: 'Limite de geração por minuto atingido. Aguarde um pouco.',
});

const parseJsonResponse = (raw: string | undefined, scope: string) => {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw new Error(`${scope}: o modelo devolveu uma resposta fora do formato JSON esperado.`);
  }
};

export const geminiRouter = Router();

geminiRouter.use(requireAuth, aiLimiter);

/**
 * Sem chave configurada respondemos 503 e o frontend mostra o aviso.
 * Antes devolvíamos um texto de exemplo, o que dava a impressão de que a IA
 * estava funcionando.
 */
const requireKey = (res: any) =>
  res.status(503).json({
    error: 'IA não configurada. Defina GEMINI_API_KEY no ambiente para habilitar a geração.',
    code: 'AI_NOT_CONFIGURED',
  });

geminiRouter.post('/generate-copy', async (req, res) => {
  try {
    const {
      theme,
      format,
      platform,
      brandVoice,
      targetAudience,
      painPoints,
      monthlyGoals,
      additionalNotes,
    } = req.body || {};

    if (!isNonEmptyString(theme, 500)) {
      return res.status(400).json({ error: 'Informe o tema do conteúdo.' });
    }

    const ai = getClient();
    if (!ai) return requireKey(res);

    const prompt = `Você é o copywriter sênior e estrategista de conteúdo de uma agência.
Crie o conteúdo de alta conversão para uma postagem com os seguintes dados:
- Tema / Assunto: "${theme}"
- Formato: "${format || 'Carrossel'}"
- Plataforma: "${platform || 'Instagram'}"
- Tom de Voz da Marca: "${brandVoice || 'Profissional, acessível, persuasivo e empático'}"
- Público-Alvo: "${targetAudience || 'Empreendedores e decisores'}"
- Dores do Público: "${painPoints || 'Falta de tempo e previsibilidade de resultados'}"
- Objetivo do Mês: "${monthlyGoals || 'Engajamento e geração de leads'}"
- Observações adicionais: "${additionalNotes || 'Nenhuma'}"

Retorne uma resposta estritamente no formato JSON válido com as seguintes chaves:
{
  "caption": "Texto completo da legenda incluindo emojis adequados, quebras de linha e chamada para ação",
  "hook": "Gancho magnético para os primeiros 3 segundos ou primeira linha/capa",
  "cta": "Chamada para ação direta",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "reelsScript": "Se aplicável, roteiro resumido cena a cena de Reels/TikTok (Cena 1, Cena 2, CTA final)"
}`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return res.json(parseJsonResponse(response.text, 'generate-copy'));
  } catch (error) {
    return failSafely(res, 'gemini/generate-copy', error, 502);
  }
});

geminiRouter.post('/convert-feedback', async (req, res) => {
  try {
    const { clientFeedback, jobTitle, currentCopy } = req.body || {};

    if (!isNonEmptyString(clientFeedback, 5000)) {
      return res.status(400).json({ error: 'Informe o feedback do cliente.' });
    }

    const ai = getClient();
    if (!ai) return requireKey(res);

    const prompt = `O cliente solicitou o seguinte ajuste no post "${jobTitle || 'sem título'}":
Feedback bruto do cliente: "${clientFeedback}"
Legenda atual do post: "${currentCopy || 'Não informada'}"

Como Diretor de Operações de agência, transforme esse feedback do cliente em uma lista acionável e técnica de tarefas separadas por responsável (designer ou copywriter).
Retorne estritamente em JSON:
{
  "summary": "Resumo objetivo e educado do que precisa ser alterado",
  "checklist": [
    { "item": "Descrição clara da tarefa técnica a executar", "role": "designer" | "copywriter" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return res.json(parseJsonResponse(response.text, 'convert-feedback'));
  } catch (error) {
    return failSafely(res, 'gemini/convert-feedback', error, 502);
  }
});

geminiRouter.post('/editorial-ideas', async (req, res) => {
  try {
    const { clientSegment, clientName, month } = req.body || {};

    const ai = getClient();
    if (!ai) return requireKey(res);

    const prompt = `Gere 4 ideias criativas de conteúdo estratégico para o cliente "${clientName || 'Cliente'}", que atua no segmento de "${clientSegment || 'Negócios e Serviços'}", para o mês de "${month || 'próximo mês'}".
Retorne estritamente em JSON:
{
  "ideas": [
    {
      "title": "Título sugerido do conteúdo",
      "format": "Carrossel" | "Reels" | "Post Estático" | "Stories",
      "hook": "Gancho de atração imediata",
      "rationale": "Por que essa pauta vai funcionar e gerar engajamento"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return res.json(parseJsonResponse(response.text, 'editorial-ideas'));
  } catch (error) {
    return failSafely(res, 'gemini/editorial-ideas', error, 502);
  }
});
