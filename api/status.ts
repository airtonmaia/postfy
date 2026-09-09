import { usuarioDaRequisicao, clienteDoUsuario, json, naoAutenticado } from './_lib/auth.js';
import { rota } from './_lib/rota.js';


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

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  // Só o dono do SaaS. A infraestrutura é do produto, não da agência: um
  // membro ver "Resend requer configuração" gera dúvida sobre algo que ele
  // não controla e não deveria enxergar.
  //
  // A RLS de platform_admins só deixa um admin enxergar a tabela, então para
  // qualquer outro a consulta volta vazia — que é exatamente a resposta.
  const supabase = clienteDoUsuario(request);
  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', usuario.id)
    .maybeSingle();

  if (!admin) return json({ error: 'Disponível apenas para o administrador da plataforma.' }, 403);

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
 * Handler no formato Web, exportado para os testes chamarem direto.
 * O que a Vercel executa é o default abaixo.
 */
export const POST = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
