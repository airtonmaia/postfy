import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Google GenAI Client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

// ==========================================
// API Routes (mounted BEFORE Vite middleware)
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// 1. Generate Copywriting with Brand Voice
app.post('/api/gemini/generate-copy', async (req, res) => {
  try {
    const { 
      theme, 
      format, 
      platform, 
      brandVoice, 
      targetAudience, 
      painPoints, 
      monthlyGoals,
      additionalNotes 
    } = req.body;

    const ai = getGenAI();
    if (!ai) {
      // Graceful fallback response if key is not yet set in AI Studio
      return res.json({
        caption: `✨ [Mock IA - Configure GEMINI_API_KEY]: ${theme}\n\nVocê sabia que ${targetAudience || 'seu público'} busca soluções práticas para o dia a dia? Na nossa empresa focamos em transformar essa realidade.\n\n👉 Comente QUERO para saber mais detalhes no direct!`,
        hook: `Pare de cometer esse erro com ${theme}!`,
        cta: `Comente "QUERO" para receber o material exclusivo.`,
        hashtags: ['#marketingdigital', '#gestaodeconteudo', '#postfy', '#socialmedia', '#estrategia'],
        reelsScript: `CENA 1 (0-3s): Olhar para a câmera com expressão surpresa. Texto na tela: "Você ainda faz isso?".\nCENA 2 (3-8s): Mostrar o problema e a dor comum.\nCENA 3 (8-15s): Apresentar a solução prática.\nCTA (15-20s): Aponte para a legenda!`
      });
    }

    const prompt = `Você é o copywriter sênior e estrategista de conteúdo da agência Postfy.
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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini Generate Copy Error:', error);
    return res.status(500).json({ error: error.message || 'Falha ao gerar copy com Gemini' });
  }
});

// 2. Convert Client Adjustment Feedback into Actionable Checklist
app.post('/api/gemini/convert-feedback', async (req, res) => {
  try {
    const { clientFeedback, jobTitle, currentCopy } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        summary: `Ajuste solicitado pelo cliente em "${jobTitle}": ${clientFeedback}`,
        checklist: [
          { item: 'Alterar cores de fundo para paleta institucional', role: 'designer' },
          { item: 'Substituir a foto de capa por imagem de equipe real', role: 'designer' },
          { item: 'Ajustar a frase final da legenda reforçando a promoção', role: 'copywriter' }
        ]
      });
    }

    const prompt = `O cliente solicitou o seguinte ajuste no post "${jobTitle}":
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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini Feedback Conversion Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Brainstorm Editorial Ideas
app.post('/api/gemini/editorial-ideas', async (req, res) => {
  try {
    const { clientSegment, clientName, month } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        ideas: [
          { title: 'Carrossel: 5 Mitos sobre o setor', format: 'Carrossel', hook: 'Você ainda acredita nisso?', rationale: 'Educar o público e gerar salvamentos' },
          { title: 'Reels Bastidores: Como entregamos nossos resultados', format: 'Reels', hook: 'O que ninguém te mostra...', rationale: 'Humanização e autoridade' },
          { title: 'Post de Prova Social com Depoimento', format: 'Post Estático', hook: 'O resultado de 30 dias de dedicação', rationale: 'Geração de novos leads e conversão' },
          { title: 'Checklist Prático para o dia a dia', format: 'Carrossel', hook: 'Salve este guia antes que precise!', rationale: 'Alto potencial de compartilhamento' }
        ]
      });
    }

    const prompt = `Gere 4 ideias criativas de conteúdo estratégico para o cliente "${clientName}", que atua no segmento de "${clientSegment || 'Negócios e Serviços'}", para o mês de "${month || 'Março'}".
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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Vite Middleware / Static Servicing
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Postfy Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
