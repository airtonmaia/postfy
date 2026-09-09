import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  clienteDeServico,
  json,
  naoAutenticado,
} from './_lib/auth.js';
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

/**
 * A chave de serviço é a única que precisa ser **usada** para se saber que
 * está boa.
 *
 * Todo o resto aqui responde "a variável existe", e para o resto isso basta.
 * Para esta não bastou: uma SUPABASE_SECRET_KEY preenchida com valor inválido
 * derrubou o Portal do Cliente inteiro em produção, e a tela de Integrações
 * seguiu verde o tempo todo — porque a variável estava lá. O Supabase
 * respondia 401 e o cliente lia "Tente novamente em instantes".
 *
 * Custa uma consulta que não devolve linha nenhuma; `head` nem traz corpo.
 * Repare que é a chave que autentica, não a consulta que importa: qualquer
 * tabela serviria, e portal_codigos é inalcançável por qualquer outra
 * credencial — o que a torna a prova exata de que esta é de serviço.
 */
const chaveDeServicoFunciona = async (): Promise<boolean> => {
  const supabase = clienteDeServico();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('portal_codigos')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    return !error;
  } catch {
    return false;
  }
};

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
    // Duas respostas, porque os dois problemas se resolvem de formas
    // diferentes: faltando, é preencher a variável; presente e recusada, é
    // conferir o valor e **redeployar** — a Vercel congela o ambiente no
    // deploy, então salvar a variável não alcança o que já está no ar.
    chaveDeServico: temTodas('SUPABASE_SECRET_KEY'),
    chaveDeServicoValida: await chaveDeServicoFunciona(),
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
