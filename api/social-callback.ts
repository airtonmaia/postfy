import { randomUUID } from 'node:crypto';
import { clienteDeServico } from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { conferirEstado } from './social-connect.js';
import {
  trocarCodigoPorToken,
  contaDoToken,
} from './_lib/instagram.js';
import {
  trocarCodigoPorToken as trocarCodigoDoFacebook,
  paginasDoUsuario,
  type PaginaDoFacebook,
} from './_lib/facebook.js';


/**
 * Retorno do OAuth do Instagram e do Facebook.
 *
 * Quem chega aqui é o navegador, vindo do site da Meta — sem token do
 * Supabase no header, porque é uma navegação e não um fetch. Por isso a
 * identidade vem do `state` assinado, e não da sessão.
 *
 * Grava o token com a chave de serviço, porque `social_tokens` é inalcançável
 * para qualquer sessão autenticada de propósito. É o único lugar do projeto
 * que precisa disso, e só depois de a assinatura do estado conferir.
 *
 * ### No Facebook são dois passos, e o segundo é da pessoa
 *
 * O Instagram conecta a conta que entrou: não há o que escolher. No Facebook
 * o login devolve **as Páginas que a pessoa administra**, e o código aqui
 * ficava com `paginas[0]` — quem administra duas conectava uma em silêncio,
 * possivelmente a errada, com a tela dizendo "Conta conectada". É a mesma
 * família do `find` que enfileirava uma rede de duas: o servidor decide
 * sozinho o que era para a pessoa decidir, e nada acusa.
 *
 * Com uma Página só, a escolha não é feita — perguntar o óbvio é ruído, e a
 * lista continua tendo sido buscada, que é o que `pages_show_list` justifica.
 */

/** Texto de terceiro nunca entra cru no HTML: nome de Página é escolhido por quem o cadastrou. */
const escapar = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ESTILO_DA_PAGINA =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
  'margin:0;background:#f8fafc;color:#0f172a';

/**
 * `detalhe` é o que a pessoa precisa saber **depois** de dar certo.
 *
 * Nasceu de um caso real: quem administra várias Páginas conectou uma e
 * concluiu que o Orquesia não tinha achado as outras. Não tinha mesmo — a
 * Meta só liberou aquela —, e a tela não dizia isso nem onde mexer. Sucesso
 * que esconde uma escolha pela metade é a armadilha 9 na hora mais barata de
 * evitá-la: a pessoa ainda está com a janela aberta.
 */
const paginaDeRetorno = (mensagem: string, erro: boolean, detalhe?: string): Response =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>${erro ? 'Falha ao conectar' : 'Conta conectada'}</title></head>
     <body style="${ESTILO_DA_PAGINA};
                  display:flex;align-items:center;justify-content:center;height:100vh">
       <div style="text-align:center;max-width:420px;padding:32px">
         <p style="font-size:15px;font-weight:600">${escapar(mensagem)}</p>
         ${
           detalhe
             ? `<p style="font-size:12px;color:#64748b;margin-top:12px;line-height:1.6;
                          text-align:left;background:#f1f5f9;padding:12px 14px;
                          border-radius:12px">${escapar(detalhe)}</p>`
             : ''
         }
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

/**
 * A lista das Páginas que a pessoa administra, para ela escolher uma.
 *
 * **Nenhum token vai para esta tela.** Cada linha carrega só o id da Página,
 * o `state` assinado e o id da autorização pendente — o token da Página é
 * buscado de novo no passo dois, no servidor. Um campo escondido com o token
 * o colocaria no DOM e em qualquer captura de tela, e captura de tela é
 * exatamente o que se faz de uma tela como esta ao gravar o vídeo da revisão
 * da Meta.
 *
 * A janela é a mesma do popup do OAuth, então a tela é estreita de propósito.
 */
const paginaDeEscolha = (
  paginas: PaginaDoFacebook[],
  estado: string,
  pendente: string
): Response => {
  const linhas = paginas
    .map((p) => {
      const destino =
        `/api/social-callback?state=${encodeURIComponent(estado)}` +
        `&pendente=${encodeURIComponent(pendente)}` +
        `&pagina=${encodeURIComponent(p.accountId)}`;

      const foto = p.fotoUrl
        ? `<img src="${escapar(p.fotoUrl)}" alt="" width="40" height="40"
             style="border-radius:9999px;flex:0 0 auto;object-fit:cover">`
        : `<span style="width:40px;height:40px;border-radius:9999px;flex:0 0 auto;
             background:#e2e8f0"></span>`;

      return `<a href="${escapar(destino)}"
         style="display:flex;align-items:center;gap:12px;padding:12px 14px;
                border:1px solid #e2e8f0;border-radius:16px;background:#fff;
                text-decoration:none;color:inherit">
        ${foto}
        <span style="min-width:0">
          <span style="display:block;font-size:14px;font-weight:700">${escapar(p.accountName)}</span>
          <span style="display:block;font-size:12px;color:#64748b">Página do Facebook</span>
        </span>
      </a>`;
    })
    .join('');

  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>Escolha a Página</title></head>
     <body style="${ESTILO_DA_PAGINA};padding:32px 20px">
       <div style="max-width:420px;margin:0 auto">
         <h1 style="font-size:17px;font-weight:800;margin:0 0 6px">
           Escolha a Página
         </h1>
         <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.5">
           Você administra ${paginas.length} Páginas. O Orquesia vai publicar
           na que você escolher aqui.
         </p>
         <div style="display:flex;flex-direction:column;gap:10px">${linhas}</div>
         <p style="font-size:12px;color:#94a3b8;margin-top:20px;line-height:1.5">
           Não está vendo todas as suas Páginas? Feche esta janela, clique em
           Conectar de novo e marque todas na tela da Meta — é ela que decide
           quais o Orquesia enxerga.
           <br><br>
           A autorização vale por 15 minutos. Passando disso, é só conectar de novo.
         </p>
       </div>
     </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
};

/**
 * Grava a conexão e o token — o fim dos dois caminhos.
 *
 * Mora numa função porque o Facebook agora chega aqui de dois lugares (a
 * Página única e a Página escolhida) e o Instagram de um. Três cópias do
 * upsert divergiriam na primeira pressa, e divergir aqui deixa uma conexão
 * sem token: ela publica nada e não diz por quê.
 */
const guardarConexao = async (
  supabase: any,
  dados: { workspaceId: string; userId: string; clientId?: string },
  rede: 'instagram' | 'facebook',
  conta: { accountId: string; accountName: string },
  token: string,
  expiraEm: number | null,
  /** O que a pessoa precisa saber depois de dar certo. Ver `paginaDeRetorno`. */
  detalhe?: string
): Promise<Response> => {
  // 60 dias, e renovável — `api/publicar.ts` renova antes de vencer. Fica
  // em `social_connections` porque é o que a tela mostra; o token, esse
  // continua na tabela que sessão nenhuma alcança.
  const expiraEmIso = expiraEm ? new Date(Date.now() + expiraEm * 1000).toISOString() : null;

  const { data: conexao, error } = await supabase
    .from('social_connections')
    .upsert(
      {
        workspace_id: dados.workspaceId,
        // De quem é esta conta. Sem isto o agendador não sabe em qual
        // perfil publicar o conteúdo de cada cliente — a coluna existia e
        // ninguém escrevia nela.
        client_id: dados.clientId ?? null,
        platform: rede,
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

  return paginaDeRetorno(`Conta conectada: @${conta.accountName}`, false, detalhe);
};

/** Quanto tempo uma autorização pode ficar esperando a escolha. */
const VALIDADE_DA_PENDENTE_MS = 15 * 60_000;

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const codigo = url.searchParams.get('code');
  const estado = url.searchParams.get('state');
  const recusado = url.searchParams.get('error');
  // O passo dois: a Página que a pessoa escolheu, e a autorização que espera.
  const pendente = url.searchParams.get('pendente');
  const paginaEscolhida = url.searchParams.get('pagina');

  if (recusado) {
    return paginaDeRetorno('Você cancelou a autorização.', true);
  }
  if (!estado || (!codigo && !(pendente && paginaEscolhida))) {
    return paginaDeRetorno('Retorno incompleto da rede social.', true);
  }

  const segredo = process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';
  if (!segredo) {
    return paginaDeRetorno('Conexão social não configurada no servidor.', true);
  }

  const dados = conferirEstado(estado, segredo);
  if (!dados) {
    // Assinatura inválida ou vencida. Não dizemos qual das duas.
    return paginaDeRetorno('Autorização inválida ou expirada. Tente novamente.', true);
  }

  /**
   * A rede vem do **estado assinado**, nunca da query — e por isso ela só
   * pode ser lida depois de a assinatura conferir.
   *
   * Quem chega aqui veio da Meta, sem sessão: uma `rede` na URL faria o
   * retorno do Instagram ser processado pelo fluxo do Facebook, que bate em
   * outro endpoint com outro segredo — e o erro sairia como "código
   * inválido", que não aponta para nada.
   */
  const rede = dados.rede;
  const appId =
    rede === 'facebook' ? process.env.FACEBOOK_APP_ID : process.env.INSTAGRAM_APP_ID;
  const appSecret =
    rede === 'facebook'
      ? process.env.FACEBOOK_APP_SECRET
      : process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    return paginaDeRetorno(
      `Conexão com o ${rede === 'facebook' ? 'Facebook' : 'Instagram'} não configurada no servidor.`,
      true
    );
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return paginaDeRetorno('Armazenamento de credenciais não configurado.', true);
  }

  try {
    /**
     * **Passo dois: a Página escolhida.**
     *
     * A agência e o cliente saem do `state` assinado, como no passo um — o id
     * da pendente diz só *qual autorização* é esta, e sozinho não conecta
     * nada. O token da Página é buscado agora, no servidor, e a busca
     * revalida de graça que a Página ainda é administrada por quem autorizou.
     */
    if (pendente && paginaEscolhida) {
      if (rede !== 'facebook') {
        return paginaDeRetorno('Retorno incompleto da rede social.', true);
      }

      const { data: guardada } = await supabase
        .from('social_autorizacoes_pendentes')
        .select('id, access_token, expira_em, criado_em')
        .eq('id', pendente)
        .maybeSingle();

      if (
        !guardada ||
        Date.now() - new Date(guardada.criado_em).getTime() > VALIDADE_DA_PENDENTE_MS
      ) {
        return paginaDeRetorno('Autorização inválida ou expirada. Tente novamente.', true);
      }

      const paginas = await paginasDoUsuario(guardada.access_token);
      const escolhida = paginas.find((p) => p.accountId === paginaEscolhida);

      if (!escolhida) {
        return paginaDeRetorno(
          'Essa Página não está mais entre as que você administra. Tente conectar de novo.',
          true
        );
      }

      // A linha some assim que cumpre o papel. Ela guarda um token de
      // usuário, e token esquecido numa tabela é sobra que ninguém vê
      // envelhecer.
      await supabase.from('social_autorizacoes_pendentes').delete().eq('id', guardada.id);

      return await guardarConexao(
        supabase,
        dados,
        'facebook',
        { accountId: escolhida.accountId, accountName: escolhida.accountName },
        escolhida.tokenDaPagina,
        guardada.expira_em ?? null
      );
    }

    const base = process.env.APP_URL || 'https://app.orquesia.com.br';
    // A mesma string que `social-connect` mandou para a Meta. Se as duas
    // divergirem em um caractere, a troca do código é recusada aqui.

    if (rede === 'facebook') {
      const trocado = await trocarCodigoDoFacebook(
        codigo as string,
        `${base}/api/social-callback`,
        appId,
        appSecret
      );

      /**
       * **O token guardado é o da Página, não o do usuário.**
       *
       * O login devolve o token do usuário, que só serve para listar as
       * Páginas. Guardar ele faria a publicação falhar com "permissão
       * insuficiente" depois de a conexão já parecer pronta — o pior momento
       * para descobrir.
       */
      const paginas = await paginasDoUsuario(trocado.token);
      if (!paginas.length) {
        return paginaDeRetorno(
          'Nenhuma Página encontrada nesta conta do Facebook. Publicar exige ' +
            'ser administrador de uma Página.',
          true
        );
      }

      /*
        Uma Página só não é escolha: perguntar o óbvio é ruído, e o passo a
        mais custa um clique em toda conexão do caso mais comum.

        **Mas "uma" pode ser o resultado de uma liberação curta**, não do
        tamanho da conta. Na autorização da Meta existe um passo em que se
        marca quais Páginas o app enxerga, e quem passa rápido por ele libera
        uma. Do lado de cá, uma Página liberada e uma Página existente são
        indistinguíveis — então a tela diz o que houve, em vez de deixar a
        pessoa concluir que o Orquesia não achou as outras. Foi exatamente
        essa a conclusão de quem usou primeiro.
      */
      if (paginas.length === 1) {
        return await guardarConexao(
          supabase,
          dados,
          'facebook',
          { accountId: paginas[0].accountId, accountName: paginas[0].accountName },
          paginas[0].tokenDaPagina,
          trocado.expiraEm,
          'Foi a única Página que o Facebook liberou para o Orquesia. Se você ' +
            'administra outras, clique em Conectar de novo e, na tela da Meta, ' +
            'marque todas as Páginas antes de continuar.'
        );
      }

      // As vencidas saem na carona de quem chega: não há cron para isto, e
      // uma varredura aqui é o suficiente para a tabela não acumular token.
      await supabase
        .from('social_autorizacoes_pendentes')
        .delete()
        .lt('criado_em', new Date(Date.now() - VALIDADE_DA_PENDENTE_MS).toISOString());

      const id = randomUUID();
      const { error: erroPendente } = await supabase
        .from('social_autorizacoes_pendentes')
        .insert({ id, access_token: trocado.token, expira_em: trocado.expiraEm });

      if (erroPendente) {
        console.error('[social/callback] pendente', erroPendente.message);
        return paginaDeRetorno('Não foi possível guardar a autorização.', true);
      }

      return paginaDeEscolha(paginas, estado, id);
    }

    const trocado = await trocarCodigoPorToken(
      codigo as string,
      `${base}/api/social-callback`,
      appId,
      appSecret
    );

    // Uma conta por autorização: no login do Instagram é a conta que entrou.
    const conta = await contaDoToken(trocado.token);

    return await guardarConexao(supabase, dados, 'instagram', conta, trocado.token, trocado.expiraEm);
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
 * O passo dois da escolha da Página também é `GET`, pela mesma razão: ele é
 * um link que a pessoa clica na janela do OAuth. Ele não é alcançável sem o
 * `state` assinado, que vale 15 minutos e nomeia a agência.
 *
 * O que a Vercel executa é o default abaixo.
 */
export const GET = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
