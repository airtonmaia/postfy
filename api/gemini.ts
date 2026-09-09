import {
  usuarioDaRequisicao,
  json,
  naoAutenticado,
  textoValido,
  excedeuLimite,
} from './_lib/auth';
import { configuracaoDaIA, gerarJson, ErroDeIA } from './_lib/ia';

export const config = { runtime: 'nodejs' };

/**
 * Rotas de IA.
 *
 * Exigem sessão: sem isso qualquer pessoa na internet queimaria a cota, e a
 * chave fica só aqui no servidor, nunca no bundle.
 *
 * O fornecedor é escolhido por variável de ambiente (ver _lib/ia). O nome do
 * arquivo continua "gemini" para não quebrar a URL que o cliente já chama.
 */

const PROMPTS = {
  'generate-copy': (c: any) => `Crie o conteúdo de alta conversão para uma postagem com os seguintes dados:
- Tema / Assunto: "${c.theme}"
- Formato: "${c.format || 'Carrossel'}"
- Plataforma: "${c.platform || 'Instagram'}"
- Tom de Voz da Marca: "${c.brandVoice || 'Profissional, acessível, persuasivo e empático'}"
- Público-Alvo: "${c.targetAudience || 'Empreendedores e decisores'}"
- Dores do Público: "${c.painPoints || 'Falta de tempo e previsibilidade de resultados'}"
- Objetivo do Mês: "${c.monthlyGoals || 'Engajamento e geração de leads'}"
- Observações adicionais: "${c.additionalNotes || 'Nenhuma'}"

Responda com este JSON:
{
  "caption": "Legenda completa com emojis, quebras de linha e chamada para ação",
  "hook": "Gancho magnético para os primeiros 3 segundos ou primeira linha",
  "cta": "Chamada para ação direta",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "reelsScript": "Se aplicável, roteiro cena a cena de Reels/TikTok"
}`,

  'convert-feedback': (c: any) => `O cliente solicitou o seguinte ajuste no post "${c.jobTitle || 'sem título'}":
Feedback bruto: "${c.clientFeedback}"
Legenda atual: "${c.currentCopy || 'Não informada'}"

Como Diretor de Operações de agência, transforme esse feedback numa lista acionável e técnica de tarefas separadas por responsável.

Responda com este JSON:
{
  "summary": "Resumo objetivo do que precisa ser alterado",
  "checklist": [{ "item": "Tarefa técnica a executar", "role": "designer" }]
}
O campo "role" aceita apenas "designer" ou "copywriter".`,

  'editorial-ideas': (c: any) => `Gere 4 ideias criativas de conteúdo estratégico para o cliente "${c.clientName || 'Cliente'}", do segmento "${c.clientSegment || 'Negócios e Serviços'}", para o mês de "${c.month || 'próximo mês'}".

Responda com este JSON:
{
  "ideas": [{
    "title": "Título sugerido",
    "format": "Carrossel",
    "hook": "Gancho de atração imediata",
    "rationale": "Por que essa pauta funciona"
  }]
}
O campo "format" aceita: "Carrossel", "Reels", "Post Estático" ou "Stories".`,
} as const;

type Acao = keyof typeof PROMPTS;

async function handler(request: Request): Promise<Response> {
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

  const configIA = configuracaoDaIA();
  if (!configIA) {
    // Sem chave respondemos 503 e a interface avisa. Devolver texto de exemplo
    // daria a impressão de que a IA está gerando de verdade.
    return json(
      {
        error:
          'IA não configurada. Defina IA_API_KEY (e opcionalmente IA_PROVEDOR) no ambiente.',
        code: 'AI_NOT_CONFIGURED',
      },
      503
    );
  }

  try {
    return json(await gerarJson(PROMPTS[acao](corpo), configIA));
  } catch (erro) {
    if (erro instanceof ErroDeIA) {
      return json({ error: erro.message }, erro.status);
    }
    console.error(`[gemini/${acao}]`, erro);
    return json({ error: 'Não foi possível gerar o conteúdo.' }, 502);
  }
}

/**
 * Export nomeado, e sem `export default`, de propósito.
 *
 * O builder da Vercel (@vercel/node) decide a assinatura pelo formato do
 * export: só reconhece handler no padrão Web (Request/Response) quando existe
 * um export nomeado de método (POST/GET/fetch). Com `export default` ele
 * assume o handler clássico do Node e entrega (req, res) — aí
 * `request.headers.get(...)` estoura num IncomingMessage e a função morre
 * antes de responder, devolvendo um 500 sem corpo.
 *
 * Era esse o motivo de nenhuma rota /api ter funcionado em produção.
 * Não troque por default sem reler `unwrapDefaults` no builder.
 */
export const POST = handler;
