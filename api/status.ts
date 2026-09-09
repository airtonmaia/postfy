import { usuarioDaRequisicao, json, naoAutenticado } from './_lib/auth';

export const config = { runtime: 'nodejs' };

/**
 * O que está de fato configurado no servidor.
 *
 * A tela de integrações mantinha uma lista escrita à mão do que funcionava.
 * Lista assim envelhece: ela seguiu anunciando "Supabase requer configuração"
 * e "os arquivos ficam no navegador" muito depois de as duas coisas terem
 * deixado de ser verdade, e ninguém percebe porque não quebra nada.
 *
 * Aqui o estado é lido do próprio ambiente. Se a variável não existe, a tela
 * diz que não existe — sem alguém precisar lembrar de atualizar o texto.
 *
 * Responde só booleanos. Nem valor, nem prefixo, nem tamanho de chave: saber
 * que a chave existe é o suficiente para a tela, e qualquer detalhe além
 * disso é material para quem estiver tentando adivinhá-la.
 */

const temTodas = (...nomes: string[]): boolean =>
  nomes.every((nome) => Boolean(process.env[nome]?.trim()));

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  // Exige sessão: a configuração do servidor não é informação pública.
  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  const armazenamento = temTodas(
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET'
  );

  return json({
    ia: temTodas('IA_API_KEY') || temTodas('GEMINI_API_KEY'),
    // O upload assina com estas quatro; a URL pública é o que falta para o
    // arquivo abrir depois de enviado, e vale distinguir os dois casos.
    armazenamento,
    armazenamentoPublico: armazenamento && temTodas('R2_PUBLIC_BASE_URL'),
    email: temTodas('RESEND_API_KEY'),
  });
}

/**
 * Export nomeado, sem default: é assim que o builder da Vercel reconhece a
 * assinatura Web. Ver o comentário longo em api/upload-url.ts.
 */
export const POST = handler;
