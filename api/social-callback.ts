import { clienteDeServico } from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { conferirEstado } from './social-connect.js';
import { trocarCodigoPorToken, contasDoUsuario } from './_lib/meta.js';


/**
 * Retorno do OAuth da Meta.
 *
 * Quem chega aqui é o navegador, vindo do site da Meta — sem token do
 * Supabase no header, porque é uma navegação e não um fetch. Por isso a
 * identidade vem do `state` assinado, e não da sessão.
 *
 * Grava o token com a chave de serviço, porque `social_tokens` é inalcançável
 * para qualquer sessão autenticada de propósito. É o único lugar do projeto
 * que precisa disso, e só depois de a assinatura do estado conferir.
 */

const paginaDeRetorno = (mensagem: string, erro: boolean): Response =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
     <title>${erro ? 'Falha ao conectar' : 'Conta conectada'}</title></head>
     <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                  display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
                  background:#f8fafc;color:#0f172a">
       <div style="text-align:center;max-width:420px;padding:32px">
         <p style="font-size:15px;font-weight:600">${mensagem}</p>
         <p style="font-size:13px;color:#64748b;margin-top:12px">
           Você já pode fechar esta janela.
         </p>
       </div>
       <script>
         // Avisa a aba que abriu esta janela, para ela recarregar a lista.
         try { window.opener && window.opener.postMessage(
           { origem: 'orquesia-social', ok: ${!erro} }, '*'); } catch (e) {}
       </script>
     </body></html>`,
    { status: erro ? 400 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const codigo = url.searchParams.get('code');
  const estado = url.searchParams.get('state');
  const recusado = url.searchParams.get('error');

  if (recusado) {
    return paginaDeRetorno('Você cancelou a autorização.', true);
  }
  if (!codigo || !estado) {
    return paginaDeRetorno('Retorno incompleto da rede social.', true);
  }

  const segredo = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!segredo || !appId || !appSecret) {
    return paginaDeRetorno('Conexão com redes sociais não configurada no servidor.', true);
  }

  const dados = conferirEstado(estado, segredo);
  if (!dados) {
    // Assinatura inválida ou vencida. Não dizemos qual das duas.
    return paginaDeRetorno('Autorização inválida ou expirada. Tente novamente.', true);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return paginaDeRetorno('Armazenamento de credenciais não configurado.', true);
  }

  try {
    const base = process.env.APP_URL || 'https://app.orquesia.com.br';
    const { token } = await trocarCodigoPorToken(
      codigo,
      `${base}/api/social-callback`,
      appId,
      appSecret
    );

    const contas = await contasDoUsuario(token);
    if (contas.length === 0) {
      return paginaDeRetorno(
        'Nenhuma conta profissional do Instagram encontrada. ' +
          'A conta precisa ser Profissional e estar ligada a uma página do Facebook.',
        true
      );
    }

    for (const conta of contas) {
      const { data: conexao, error } = await supabase
        .from('social_connections')
        .upsert(
          {
            workspace_id: dados.workspaceId,
            platform: 'instagram',
            account_id: conta.accountId,
            account_name: conta.accountName,
            created_by: dados.userId,
          },
          { onConflict: 'workspace_id,platform,account_id' }
        )
        .select('id')
        .single();

      if (error || !conexao) {
        console.error('[social/callback] conexão', error?.message);
        continue;
      }

      await supabase.from('social_tokens').upsert(
        {
          connection_id: conexao.id,
          access_token: conta.accessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'connection_id' }
      );
    }

    const nomes = contas.map((c) => c.accountName).join(', ');
    return paginaDeRetorno(`Conta conectada: ${nomes}`, false);
  } catch (erro) {
    console.error('[social/callback]', erro instanceof Error ? erro.message : erro);
    return paginaDeRetorno('Não foi possível concluir a conexão.', true);
  }
}

/**
 * GET porque quem chama é o navegador voltando do site da Meta.
 *
 * Export nomeado, sem default: ver o comentário longo em api/upload-url.ts.
 */

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
