import { GoogleGenAI } from '@google/genai';
import {
  usuarioDaRequisicao,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth';

export const config = { runtime: 'nodejs' };

/**
 * Rotas de IA. Exigem sessão: sem isso, qualquer pessoa na internet queimaria
 * a cota da chave do Gemini, que fica só aqui no servidor e nunca no bundle.
 */

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let cliente: GoogleGenAI | null = null;
const obterCliente = (): GoogleGenAI | null => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!cliente) cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return cliente;
};

const PROMPTS = {
  'generate-copy': (c: any) => `Você é o copywriter sênior e estrategista de conteúdo de uma agência.
Crie o conteúdo de alta conversão para uma postagem com os seguintes dados:
- Tema / Assunto: "${c.theme}"
- Formato: "${c.format || 'Carrossel'}"
- Plataforma: "${c.platform || 'Instagram'}"
- Tom de Voz da Marca: "${c.brandVoice || 'Profissional, acessível, persuasivo e empático'}"
- Público-Alvo: "${c.targetAudience || 'Empreendedores e decisores'}"
- Dores do Público: "${c.painPoints || 'Falta de tempo e previsibilidade de resultados'}"
- Objetivo do Mês: "${c.monthlyGoals || 'Engajamento e geração de leads'}"
- Observações adicionais: "${c.additionalNotes || 'Nenhuma'}"

Retorne estritamente em JSON:
{
  "caption": "Texto completo da legenda com emojis, quebras de linha e chamada para ação",
  "hook": "Gancho magnético para os primeiros 3 segundos ou primeira linha",
  "cta": "Chamada para ação direta",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "reelsScript": "Se aplicável, roteiro cena a cena de Reels/TikTok"
}`,

  'convert-feedback': (c: any) => `O cliente solicitou o seguinte ajuste no post "${c.jobTitle || 'sem título'}":
Feedback bruto: "${c.clientFeedback}"
Legenda atual: "${c.currentCopy || 'Não informada'}"

Como Diretor de Operações de agência, transforme esse feedback numa lista acionável e técnica de tarefas separadas por responsável.
Retorne estritamente em JSON:
{
  "summary": "Resumo objetivo do que precisa ser alterado",
  "checklist": [{ "item": "Tarefa técnica a executar", "role": "designer" | "copywriter" }]
}`,

  'editorial-ideas': (c: any) => `Gere 4 ideias criativas de conteúdo estratégico para o cliente "${c.clientName || 'Cliente'}", do segmento "${c.clientSegment || 'Negócios e Serviços'}", para o mês de "${c.month || 'próximo mês'}".
Retorne estritamente em JSON:
{
  "ideas": [{
    "title": "Título sugerido",
    "format": "Carrossel" | "Reels" | "Post Estático" | "Stories",
    "hook": "Gancho de atração imediata",
    "rationale": "Por que essa pauta funciona"
  }]
}`,
} as const;

type Acao = keyof typeof PROMPTS;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (excedeuLimite(`ia:${usuario.id}`, 15, 60_000)) {
    return json({ error: 'Limite de geração por minuto atingido. Aguarde um pouco.' }, 429);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const acao = corpo?.action as Acao;
  if (!acao || !(acao in PROMPTS)) {
    return json({ error: 'Ação desconhecida.' }, 400);
  }

  if (acao === 'generate-copy' && !textoValido(corpo?.theme, 500)) {
    return json({ error: 'Informe o tema do conteúdo.' }, 400);
  }
  if (acao === 'convert-feedback' && !textoValido(corpo?.clientFeedback, 5000)) {
    return json({ error: 'Informe o feedback do cliente.' }, 400);
  }

  const ai = obterCliente();
  if (!ai) {
    // Sem chave respondemos 503 e a interface avisa. Devolver texto de exemplo
    // daria a impressão de que a IA está gerando de verdade.
    return json(
      {
        error: 'IA não configurada. Defina GEMINI_API_KEY no ambiente para habilitar a geração.',
        code: 'AI_NOT_CONFIGURED',
      },
      503
    );
  }

  try {
    const resposta = await ai.models.generateContent({
      model: MODELO,
      contents: PROMPTS[acao](corpo),
      config: { responseMimeType: 'application/json' },
    });

    try {
      return json(JSON.parse(resposta.text || '{}'));
    } catch {
      return json({ error: 'O modelo devolveu uma resposta fora do formato esperado.' }, 502);
    }
  } catch (erro) {
    return falharComSeguranca(`gemini/${acao}`, erro, 502);
  }
}
