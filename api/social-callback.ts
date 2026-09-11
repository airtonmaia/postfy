import { clienteDeServico } from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { conferirEstado } from './social-connect.js';
import {
  trocarCodigoPorToken,
  contaDoToken,
} from './_lib/instagram.js';


/**
 * Retorno do OAuth do Instagram.
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
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!segredo || !appId || !appSecret) {
    return paginaDeRetorno('Conexão com o Instagram não configurada no servidor.', true);
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
    // A mesma string que `social-connect` mandou para a Meta. Se as duas
    // divergirem em um caractere, a troca do código é recusada aqui.
    const { token, expiraEm } = await trocarCodigoPorToken(
      codigo,
      `${base}/api/social-callback`,
      appId,
      appSecret
    );

    // Uma conta por autorização: no login do Instagram é a conta que entrou,
    // e não uma lista de Páginas como era no fluxo do Facebook.
    const conta = await contaDoToken(token);

    // 60 dias, e renovável — `api/publicar.ts` renova antes de vencer. Fica
    // em `social_connections` porque é o que a tela mostra; o token, esse
    // continua na tabela que sessão nenhuma alcança.
    const expiraEmIso = expiraEm
      ? new Date(Date.now() + expiraEm * 1000).toISOString()
      : null;

    const { data: conexao, error } = await supabase
      .from('social_connections')
      .upsert(
        {
          workspace_id: dados.workspaceId,
          // De quem é esta conta. Sem isto o agendador não sabe em qual
          // perfil publicar o conteúdo de cada cliente — a coluna existia e
          // ninguém escrevia nela.
          client_id: dados.clientId ?? null,
          platform: 'instagram',
          account_id: conta.accountId,
          account_name: conta.accountName,
          expires_at: expiraEmIso,
          created_by: dados.userId,
        },
        { onConflict: 'workspace_id,platform,account_id' }
      )
      .select('id')
      .single();

    if (error || !conexao) {
      console.error('[social/callback] conexão', error?.message);
      return paginaDeRetorno('Não foi possível guardar a conexão.', true);
    }

    const { error: erroToken } = await supabase.from('social_tokens').upsert(
      {
        connection_id: conexao.id,
        access_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'connection_id' }
    );

    if (erroToken) {
      // Conexão sem token publica nada e não diz por quê. Melhor falhar aqui,
      // com a pessoa ainda olhando a tela.
      console.error('[social/callback] token', erroToken.message);
      await supabase.from('social_connections').delete().eq('id', conexao.id);
      return paginaDeRetorno('Não foi possível guardar a credencial da conta.', true);
    }

    return paginaDeRetorno(`Conta conectada: @${conta.accountName}`, false);
  } catch (erro) {
    console.error('[social/callback]', erro instanceof Error ? erro.message : erro);
    return paginaDeRetorno('Não foi possível concluir a conexão.', true);
  }
}

/**
 * Handler no formato Web, exportado para os testes chamarem direto.
 *
 * `GET`, e não `POST`: quem chega aqui é o navegador voltando do site do
 * Instagram, que faz uma navegação. O export nomeado dizia `POST` e
 * contradizia o próprio comentário — nos builders que decidem pelo método
 * nomeado, a navegação não casaria com handler nenhum.
 *
 * O que a Vercel executa é o default abaixo.
 */
export const GET = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
