import {
  clienteDeServico,
  clienteDoUsuario,
  usuarioDaRequisicao,
  json,
  naoAutenticado,
  autorizadoPeloCron,
  textoValido,
} from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { publicarNoInstagram, renovarToken, buscarMetricas, ErroDaMeta } from './_lib/instagram.js';
import { publicarNoFacebook, publicarStoryNoFacebook, dadosDaPagina } from './_lib/facebook.js';
import { esvaziarFilaDeEmail } from './_lib/emails.js';
import { empurrarNotificacoes } from './_lib/push.js';


/**
 * Publicador da fila. Roda por cron, não por clique.
 *
 * Percorre o que está vencido e pendente, publica e registra o resultado.
 * A fila existe justamente para isto ser observável: dá para ver o que
 * falhou e por quê, sem depender de alguém estar com a aba aberta.
 *
 * A rota é protegida por segredo compartilhado no header, não por sessão:
 * quem chama é o agendador da Vercel, que não tem usuário. Sem o segredo
 * configurado a rota se recusa a rodar — aberta, ela publicaria no perfil
 * dos clientes a pedido de qualquer um.
 */

/**
 * Quantos itens a consulta busca por passada.
 *
 * Teto de segurança, não meta: quem decide de verdade quantos são
 * publicados é o `ORCAMENTO_MS` abaixo. Buscar mais do que dá tempo custa
 * uma consulta um pouco maior e nada mais.
 */
const LOTE = 40;

/**
 * Orçamento de tempo da passada.
 *
 * Cada publicação são duas ou três chamadas à API do Instagram, e o tempo
 * delas não é nosso — varia com o tamanho da mídia e com o dia da Meta. Um
 * `LOTE` fixo só funciona se a estimativa estiver certa: alto demais estoura
 * o tempo da função e **perde o registro do que já foi publicado** (pior
 * desfecho possível: a peça vai ao ar e a fila não sabe), baixo demais
 * segura a fila na hora do pico — e todo mundo agenda para 9h e 18h.
 *
 * Com orçamento, a passada publica o que couber e para. O que sobrou é o
 * primeiro da próxima, cinco minutos depois. Cresce com o produto sem
 * ninguém mexer no número.
 *
 * 45s numa função de 60s: sobra folga para o item em andamento terminar e
 * para a resposta ser escrita.
 */
const ORCAMENTO_MS = 45_000;

const MAX_TENTATIVAS = 3;

/**
 * O nome da rede como a agência a chama.
 *
 * Um mapa em vez de capitalizar a string: `'tiktok'` capitalizado vira
 * "Tiktok", e a peça sai do produto para a tela de quem paga por ele.
 */
const NOME_DA_REDE: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
};

/**
 * As redes que **esta rota** publica sozinha.
 *
 * Espelha `REDES_QUE_PUBLICAM` de `src/lib/redes.ts`: a lista de lá é o que a
 * tela promete, e esta é o que o servidor honra. Divergir não quebra nada até
 * alguém marcar o canal novo — é a mesma classe do `check` de `jobs.format`.
 *
 * Ela existe porque o literal `'instagram'` estava escrito à mão na escolha
 * da conta do "publicar agora", e isso fazia a publicação imediata **só
 * existir para o Instagram** — com o Facebook já publicando pelo cron, pela
 * mesma `publicarItem`.
 */
const REDES_QUE_PUBLICAM = ['instagram', 'facebook'] as const;

const publicaSozinho = (rede: string): boolean =>
  (REDES_QUE_PUBLICAM as readonly string[]).includes(rede);

type DesfechoDaPublicacao =
  | { tipo: 'publicado' }
  | { tipo: 'parcial'; motivo: string }
  | { tipo: 'falhou'; motivo: string };

/**
 * O aviso de que a peça foi ao ar — ou de que não foi.
 *
 * **`type: 'publication'` existia desde a primeira migração e não tinha um
 * único produtor.** O cron publicava no perfil do cliente, ou falhava, e não
 * havia nada no sino, nada por e-mail e nada no celular: o único lugar em que
 * a falha aparecia era a tela de Publicações, que alguém precisava abrir. Um
 * post marcado para as 9h que falhou de madrugada só era descoberto quando o
 * cliente perguntava.
 *
 * É a família do `trial_ends_at`: um valor declarado que parece uma regra e
 * não é. Quem lê o schema conclui que o aviso existe.
 *
 * Quatro decisões:
 *
 * - **A falha só avisa quando esgota as tentativas.** Entre elas o item volta
 *   para `pendente` e a passada seguinte tenta de novo — avisar ali daria três
 *   avisos para uma falha que talvez se resolvesse sozinha, e ensinaria a
 *   ignorar o sino justamente no aviso que importa.
 * - **O feed que saiu sem o story tem aviso próprio.** É o desfecho que mais
 *   passa despercebido: a fila diz `publicado`, `last_error` guarda o motivo, e
 *   nada disso chega a ninguém. "Publicado" e "publicado pela metade" não podem
 *   ler igual.
 * - **Ela nunca lança.** Roda dentro do laço que publica; derrubar a passada
 *   porque um insert de aviso falhou trocaria o compromisso da rota pelo
 *   acessório dela. Mesma regra de `empurrarNotificacoes`.
 * - **Só o cron avisa.** O caminho de "Publicar agora" tem alguém olhando a
 *   tela, que já mostra o desfecho na hora — é a mesma razão de o webhook não
 *   ter ido para a fila de e-mail: um aviso para o que já está à vista é ruído.
 *
 * O push sai na **passada seguinte**, porque `empurrarNotificacoes` roda antes
 * de a fila ser lida (e isso é deliberado — ver o comentário lá em cima). Cinco
 * minutos de atraso cabem folgados na janela de 30 do push.
 */
const avisarNoPainel = async (
  supabase: any,
  item: { job_id: string; workspace_id: string; connection_id: string },
  desfecho: DesfechoDaPublicacao
): Promise<void> => {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('title, client_id')
      .eq('id', item.job_id)
      .maybeSingle();

    const { data: conexao } = await supabase
      .from('social_connections')
      .select('platform')
      .eq('id', item.connection_id)
      .maybeSingle();

    // O conteúdo pode ter sido apagado entre a publicação e o aviso, e a
    // conexão pode ter sido removida. Nenhum dos dois é motivo para o aviso
    // não sair: o que aconteceu no perfil do cliente aconteceu.
    const titulo = (job?.title || '').trim() || 'O conteúdo';
    const rede = NOME_DA_REDE[conexao?.platform] || '';
    const onde = rede ? ` no ${rede}` : '';

    const aviso =
      desfecho.tipo === 'publicado'
        ? { title: 'Publicado ✅', message: `"${titulo}" foi ao ar${onde}.` }
        : desfecho.tipo === 'parcial'
          ? {
              title: 'Publicado pela metade ⚠️',
              message: `"${titulo}"${onde}: ${desfecho.motivo}`,
            }
          : {
              title: 'Falha ao publicar ⚠️',
              message: `"${titulo}" não foi ao ar${onde}: ${desfecho.motivo}`,
            };

    await supabase.from('notifications').insert({
      workspace_id: item.workspace_id,
      title: aviso.title,
      message: aviso.message,
      type: 'publication',
      read: false,
      link_context: {
        tab: 'publicacoes',
        jobId: item.job_id,
        clientId: job?.client_id ?? null,
      },
    });
  } catch (erro) {
    console.error(
      '[publicar] aviso no painel',
      erro instanceof Error ? erro.message : erro
    );
  }
};

async function handler(request: Request): Promise<Response> {
  if (!autorizadoPeloCron(request)) {
    // Sem o segredo do cron, o único outro caminho é uma sessão pedindo a
    // publicação de **um** conteúdo agora. Ele existe porque esperar até
    // cinco minutos e depois garimpar `last_error` no banco é um jeito
    // péssimo de descobrir que a integração não funciona: aqui o erro da
    // Meta volta na resposta, com o texto que ela mandou.
    //
    // Não é uma porta mais fraca que a do cron: a rota reconfere o papel da
    // pessoa no banco, e publica só no perfil que já está ligado àquele
    // cliente. O que ela não faz é aceitar conteúdo do navegador — o que vai
    // para a Meta sai das linhas de `jobs`, como na passada do cron.
    //
    // Mesma resposta para segredo errado e para segredo ausente: dizer qual
    // dos dois é ajuda quem está tentando adivinhar.
    return publicarUmAgora(request);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return json(
      { error: 'Publicação não configurada. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
      503
    );
  }

  const agora = new Date().toISOString();

  // Renovar vem antes de publicar, e não depois: um token vencido faz a
  // publicação falhar, gastar tentativa e só então alguém descobrir.
  const renovadas = await renovarTokensQuePodemVencer(supabase);

  // A fila de e-mail pega carona nesta passada, e não numa rota própria: o
  // plano Hobby da Vercel aceita 12 funções e já estamos em 12 (armadilha
  // 6). As duas filas são a mesma ideia — o navegador enfileira, o cron
  // esvazia —, e de cinco em cinco minutos é tempo de sobra para um e-mail
  // de aviso.
  //
  // Antes do resto de propósito: é a parte barata, e se a publicação
  // estourar no meio o e-mail já saiu.
  const email = await esvaziarFilaDeEmail(supabase);

  /**
   * O push vem **antes de ler a fila de publicação**, e o lugar é a entrega.
   *
   * Logo abaixo há um `return` antecipado para quando não há nada agendado —
   * que é o estado normal desta rota na imensa maioria das passadas. Empurrar
   * depois dele faria a notificação sair só nos cinco minutos em que por
   * acaso houvesse um post para publicar: funcionaria no teste, com um item
   * na fila, e não funcionaria no uso. Sem erro em lugar nenhum.
   */
  const push = await empurrarNotificacoes(supabase);

  const { data: itens, error } = await supabase
    .from('publish_queue')
    .select('id, job_id, connection_id, attempts, workspace_id')
    .eq('status', 'pendente')
    .lte('scheduled_for', agora)
    .order('scheduled_for')
    .limit(LOTE);

  if (error) {
    console.error('[publicar] fila', error.message);
    return json({ error: 'Não foi possível ler a fila.' }, 500);
  }

  /**
   * **A fila vazia é o estado normal desta rota, e ela tinha um `return`
   * aqui.**
   *
   * Tudo o que vinha depois — a medição de `post_metrics` — só acontecia nos
   * cinco minutos em que por acaso houvesse um post agendado para sair. Numa
   * agência que publica duas vezes por semana, isso é medir duas vezes por
   * semana: funciona no teste, com um item na fila, e não funciona no uso.
   *
   * É exatamente a armadilha que este arquivo já registra para o Web Push —
   * `empurrarNotificacoes` vem antes do `return` por esta razão, com guarda
   * escrita. A medição tinha a mesma forma e nenhuma guarda.
   *
   * Agora há uma saída só: sem item, o laço não roda, e o resto da passada
   * acontece do mesmo jeito.
   */
  const resultados: { id: string; ok: boolean; detalhe: string }[] = [];
  const comecou = Date.now();
  let adiados = 0;

  for (const item of itens || []) {
    // Fim do orçamento: o resto fica pendente e é o primeiro da próxima
    // passada. Parar aqui é de propósito — estourar o tempo da função no meio
    // de uma publicação deixa a peça no ar sem a fila saber.
    if (Date.now() - comecou > ORCAMENTO_MS) {
      adiados = (itens as any[]).length - resultados.length;
      break;
    }

    // Marca antes de tentar: se a função for reiniciada no meio, o item não
    // volta para a fila e publica duas vezes no perfil do cliente. Publicar
    // duplicado é pior que não publicar.
    const { error: erroTrava } = await supabase
      .from('publish_queue')
      .update({ status: 'publicando', attempts: item.attempts + 1 })
      .eq('id', item.id)
      .eq('status', 'pendente');

    if (erroTrava) continue;

    try {
      const publicado = await publicarItem(supabase, item);
      await supabase
        .from('publish_queue')
        .update({
          status: 'publicado',
          external_id: publicado.id,
          story_external_id: publicado.idDoStory ?? null,
          published_at: new Date().toISOString(),
          // O aviso do story fica **em publicado**: o feed saiu, e marcar
          // falhou faria a passada seguinte republicá-lo.
          last_error: publicado.avisoDoStory ?? null,
        })
        .eq('id', item.id);

      await supabase
        .from('jobs')
        .update({ status: 'published', published_date: new Date().toISOString() })
        .eq('id', item.job_id);

      await avisarNoPainel(
        supabase,
        item,
        publicado.avisoDoStory
          ? { tipo: 'parcial', motivo: publicado.avisoDoStory }
          : { tipo: 'publicado' }
      );

      resultados.push({
        id: item.id,
        ok: true,
        detalhe: publicado.avisoDoStory ?? publicado.id,
      });
    } catch (erro) {
      const motivo =
        erro instanceof ErroDaMeta || erro instanceof Error
          ? erro.message
          : 'Falha desconhecida.';

      // Volta para pendente enquanto houver tentativa sobrando. Depois disso
      // fica em falhou, com o motivo à vista, em vez de repetir para sempre.
      const esgotou = item.attempts + 1 >= MAX_TENTATIVAS;
      await supabase
        .from('publish_queue')
        .update({ status: esgotou ? 'falhou' : 'pendente', last_error: motivo })
        .eq('id', item.id);

      // Só quando acabaram as tentativas. Enquanto o item volta para
      // `pendente`, a passada seguinte tenta de novo — e uma falha de rede que
      // se resolve sozinha não merece tirar ninguém do que está fazendo.
      if (esgotou) await avisarNoPainel(supabase, item, { tipo: 'falhou', motivo });

      resultados.push({ id: item.id, ok: false, detalhe: motivo });
    }
  }

  /**
   * As métricas vêm por último de propósito: publicar é o compromisso desta
   * rota, medir é o que pode esperar cinco minutos. Com o orçamento já gasto
   * pela fila, `atualizarMetricas` não faz nada e a próxima passada pega.
   */
  const metricas = await atualizarMetricas(supabase, comecou);

  // Depois das métricas, que já são a parte que pode esperar: seguidor é
  // enfeite perto de publicar, e uma vez por dia por conexão.
  const seguidores = await atualizarSeguidoresDasPaginas(supabase);

  return json({
    processados: resultados.length,
    publicados: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    // Quantos ficaram para a próxima passada. Diferente de zero de forma
    // seguida significa que cinco minutos já não bastam — é o sinal de que
    // chegou a hora de encurtar o cron ou dividir a fila.
    adiados,
    renovadas,
    email,
    push,
    metricas,
    seguidores,
  });
}

/**
 * Publica um conteúdo agora, a pedido de quem está com a sessão aberta.
 *
 * Os papéis são os mesmos que a policy de INSERT da `publish_queue` aceita —
 * e a conferência é feita no banco, não no que o navegador diz. Um membro
 * sem papel de gestão recebe 403 aqui pelo mesmo motivo que receberia 42501
 * lá.
 *
 * O item entra na fila antes de a publicação começar, e não depois: é a fila
 * que impede o mesmo conteúdo de sair duas vezes no perfil do cliente, e um
 * clique duplo no botão é exatamente o caso que ela existe para barrar.
 */
const PAPEIS_QUE_PUBLICAM = ['owner', 'admin', 'manager', 'social_media'];

const publicarUmAgora = async (request: Request): Promise<Response> => {
  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { jobId } = corpo || {};
  if (!textoValido(jobId, 64)) {
    return json({ error: 'Conteúdo não informado.' }, 400);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return json(
      { error: 'Publicação não configurada. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
      503
    );
  }

  // Pela RLS: se o conteúdo não é de uma agência desta pessoa, ele não volta.
  const doUsuario = clienteDoUsuario(request);
  const { data: job } = await doUsuario
    .from('jobs')
    .select('id, workspace_id, client_id, canais, platform')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) {
    return json(
      { error: 'Conteúdo não encontrado. Se você acabou de criá-lo, espere o salvamento terminar.' },
      404
    );
  }

  const { data: membro } = await doUsuario
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', job.workspace_id)
    .eq('user_id', usuario.id)
    .maybeSingle();

  if (!membro || !PAPEIS_QUE_PUBLICAM.includes(membro.role)) {
    return json({ error: 'Seu perfil não pode publicar.' }, 403);
  }

  /**
   * **Os canais da peça decidem onde ela sai. Isto era um bug, e ele
   * publicava no perfil errado.**
   *
   * A consulta aqui era `.eq('platform', 'instagram').maybeSingle()`: a rota
   * ignorava `job.canais` por inteiro e pegava a conta de Instagram do
   * cliente, qualquer que fosse a rede marcada no conteúdo. Uma peça marcada
   * **só como Facebook** saía no **Instagram**, e a tela respondia
   * "Publicado em @conta" — verdadeira sobre a conta, muda sobre a rede.
   * Aconteceu em produção, com uma peça de teste.
   *
   * E post no perfil do cliente não volta. É a família que este projeto já
   * registra três vezes — o `find` que enfileirava uma rede de duas, o
   * `|| midia` que trocava a arte do story, a fila sem produtor —, agora no
   * caminho com menos margem: o cron erra por cinco minutos, este erra na
   * frente de quem clicou, no perfil que o cliente abre.
   *
   * O recuo para `platform` é o mesmo de `agendarPublicacao`: peça gravada
   * antes do multicanal não tem `canais`.
   */
  const marcados: string[] = (job.canais || []).filter(Boolean);
  const canais: string[] = marcados.length ? marcados : [job.platform];

  const automaticos = canais.filter(publicaSozinho);
  const manuais = canais.filter((rede) => !publicaSozinho(rede));

  const { data: conexoes } = await supabase
    .from('social_connections')
    .select('id, account_name, platform')
    .eq('workspace_id', job.workspace_id)
    .eq('client_id', job.client_id)
    .in('platform', automaticos.length ? automaticos : ['-']);

  /*
    Uma conta por rede, a mais antiga — `listarContas` do navegador ordena
    assim, e duas conexões da mesma rede para o mesmo cliente publicariam a
    peça duas vezes no que, para quem lê, é o mesmo lugar.
  */
  const porRede = new Map<string, any>();
  for (const conexao of conexoes || []) {
    if (!porRede.has(conexao.platform)) porRede.set(conexao.platform, conexao);
  }

  const semConta = automaticos.filter((rede) => !porRede.has(rede));

  if (porRede.size === 0) {
    /*
      A mensagem nomeia a rede. "Este cliente não tem conta conectada" sem
      dizer qual manda a pessoa procurar no lugar errado — e foi justamente
      uma frase que citava o Instagram que escondeu este bug.
    */
    const faltando = [...semConta, ...manuais].map((r) => NOME_DA_REDE[r] || r).join(' e ');
    return json(
      {
        error:
          manuais.length && !semConta.length
            ? `${faltando}: a postagem é manual, o Orquesia não publica sozinho nesta rede.`
            : `Este cliente não tem conta conectada em ${faltando || 'nenhuma rede automática'}.`,
        code: 'SEM_CONEXAO',
      },
      409
    );
  }

  const publicadas: any[] = [];
  const falhas: any[] = [];

  for (const [rede, conexao] of porRede) {
    // Já publicado é parada, não retentativa. A restrição de unicidade da fila
    // existe porque **publicar duplicado é pior que não publicar**, e um
    // `upsert` cego por cima de uma linha `publicado` colocaria o mesmo post
    // no perfil do cliente outra vez.
    const { data: jaNaFila } = await supabase
      .from('publish_queue')
      .select('id, status, external_id')
      .eq('job_id', job.id)
      .eq('connection_id', conexao.id)
      .maybeSingle();

    if (jaNaFila?.status === 'publicado') {
      /*
        Com uma rede só isto continua sendo o JA_PUBLICADO de antes; com duas,
        ele não pode derrubar a que ainda não saiu — é a mesma razão de
        `jaEstava` ter deixado de ser exceção em `agendarPublicacao`.
      */
      falhas.push({
        rede,
        conta: conexao.account_name,
        motivo: `Este conteúdo já foi publicado em @${conexao.account_name}.`,
        code: 'JA_PUBLICADO',
        externalId: jaNaFila.external_id,
      });
      continue;
    }

    // `upsert` e não `insert`: repetir o teste depois de uma falha não pode
    // estourar por causa da restrição de unicidade (job_id, connection_id).
    const { data: item, error: erroFila } = await supabase
      .from('publish_queue')
      .upsert(
        {
          workspace_id: job.workspace_id,
          job_id: job.id,
          connection_id: conexao.id,
          scheduled_for: new Date().toISOString(),
          status: 'publicando',
        },
        { onConflict: 'job_id,connection_id' }
      )
      .select('id, attempts, status')
      .single();

    if (erroFila || !item) {
      console.error('[publicar] fila (agora)', erroFila?.message);
      falhas.push({
        rede,
        conta: conexao.account_name,
        motivo: 'Não foi possível colocar na fila.',
      });
      continue;
    }

    try {
      const publicado = await publicarItem(supabase, {
        job_id: job.id,
        connection_id: conexao.id,
      });

      await supabase
        .from('publish_queue')
        .update({
          status: 'publicado',
          external_id: publicado.id,
          story_external_id: publicado.idDoStory ?? null,
          published_at: new Date().toISOString(),
          // Mesma regra do cron: o feed já saiu, então o item fecha como
          // publicado e o aviso do story fica à vista.
          last_error: publicado.avisoDoStory ?? null,
          attempts: (item.attempts ?? 0) + 1,
        })
        .eq('id', item.id);

      publicadas.push({
        rede,
        conta: conexao.account_name,
        externalId: publicado.id,
        storyExternalId: publicado.idDoStory,
        // A tela mostra a ressalva quando o story não saiu: "publicado" sem
        // dizer isso seria a tela afirmando o que não aconteceu.
        aviso: publicado.avisoDoStory,
      });
    } catch (erro) {
      const motivo =
        erro instanceof ErroDaMeta || erro instanceof Error ? erro.message : 'Falha desconhecida.';

      // Fica em `falhou`, e não de volta em `pendente`: quem pediu está olhando
      // a resposta, e um item pendente faria o cron repetir por baixo sem
      // ninguém ter decidido isso.
      await supabase
        .from('publish_queue')
        .update({ status: 'falhou', last_error: motivo, attempts: (item.attempts ?? 0) + 1 })
        .eq('id', item.id);

      falhas.push({ rede, conta: conexao.account_name, motivo });
    }
  }

  /*
    O conteúdo só vira `published` se alguma rede aceitou. Marcar com tudo
    falhado diria no quadro que a peça está no ar — a afirmação mais cara que
    esta rota pode fazer errado.
  */
  if (publicadas.length) {
    await supabase
      .from('jobs')
      .update({ status: 'published', published_date: new Date().toISOString() })
      .eq('id', job.id);
  }

  /*
    Nada publicado continua sendo erro de requisição: quem clicou está olhando
    a resposta, e um 200 com a lista vazia faria a tela ter de lembrar de
    conferir. Uma rede de duas é 200 — e o texto nomeia as duas.
  */
  if (!publicadas.length) {
    return json({ error: falhas.map((f) => f.motivo).join(' '), falhas }, 502);
  }

  return json({ ok: true, publicadas, falhas, semConta, manuais });
};

/**
 * Mantém as conexões vivas.
 *
 * O token do Instagram vale 60 dias. Sem renovar, a conexão de uma agência
 * que ficou dois meses sem publicar simplesmente para de funcionar — e o
 * sintoma é a publicação agendada falhando de madrugada, não um aviso.
 *
 * Roda em toda passada do agendador e olha **todas** as conexões, não só as
 * que têm item na fila: é justamente quem não publica há tempos que corre o
 * risco. A Meta só renova token com mais de 24 horas, e a margem de 10 dias
 * dá quase duas semanas de tentativas antes de a conta cair.
 */
/**
 * Mantém o número de seguidores da Página verdadeiro.
 *
 * Ele é lido ao conectar, e conexão é coisa de uma vez só: sem esta passada,
 * a tela mostraria para sempre o número do dia em que a Página entrou, com
 * cara de hoje. `seguidores_em` deixaria isso visível — e uma data velha à
 * vista é melhor que um número velho escondido —, mas o barato aqui é manter
 * o número, não explicar por que ele é velho.
 *
 * Uma vez por dia por conexão, e só Facebook: o Instagram não tem Página, e
 * `dadosDaPagina` fala com `graph.facebook.com` com o token **da Página**.
 *
 * Nunca lança. Seguidor é enfeite perto de publicar, e uma leitura falha não
 * pode derrubar a passada que leva o post do cliente ao ar.
 */
const INTERVALO_DE_SEGUIDORES_MS = 24 * 60 * 60_000;

const atualizarSeguidoresDasPaginas = async (supabase: any): Promise<number> => {
  try {
    const limite = new Date(Date.now() - INTERVALO_DE_SEGUIDORES_MS).toISOString();

    const { data: conexoes } = await supabase
      .from('social_connections')
      .select('id, account_id')
      .eq('platform', 'facebook')
      .or(`seguidores_em.is.null,seguidores_em.lt.${limite}`)
      .limit(LOTE);

    if (!conexoes?.length) return 0;

    let medidas = 0;
    for (const conexao of conexoes) {
      const { data: guardado } = await supabase
        .from('social_tokens')
        .select('access_token')
        .eq('connection_id', conexao.id)
        .maybeSingle();

      if (!guardado?.access_token) continue;

      const dados = await dadosDaPagina(conexao.account_id, guardado.access_token);
      if (dados.seguidores === undefined) continue;

      await supabase
        .from('social_connections')
        .update({ seguidores: dados.seguidores, seguidores_em: new Date().toISOString() })
        .eq('id', conexao.id);

      medidas += 1;
    }

    return medidas;
  } catch (erro) {
    console.warn('[publicar] seguidores', erro instanceof Error ? erro.message : erro);
    return 0;
  }
};

const MARGEM_DE_RENOVACAO_MS = 10 * 24 * 60 * 60_000;

const renovarTokensQuePodemVencer = async (supabase: any): Promise<number> => {
  const limite = new Date(Date.now() + MARGEM_DE_RENOVACAO_MS).toISOString();

  const { data: conexoes, error } = await supabase
    .from('social_connections')
    .select('id, account_name')
    .eq('platform', 'instagram')
    .not('expires_at', 'is', null)
    .lte('expires_at', limite)
    .limit(LOTE);

  if (error || !conexoes?.length) return 0;

  let renovadas = 0;
  for (const conexao of conexoes) {
    try {
      const { data: guardado } = await supabase
        .from('social_tokens')
        .select('access_token')
        .eq('connection_id', conexao.id)
        .maybeSingle();

      if (!guardado?.access_token) continue;

      const { token, expiraEm } = await renovarToken(guardado.access_token);

      await supabase
        .from('social_tokens')
        .update({ access_token: token, updated_at: new Date().toISOString() })
        .eq('connection_id', conexao.id);

      await supabase
        .from('social_connections')
        .update({
          expires_at: expiraEm
            ? new Date(Date.now() + expiraEm * 1000).toISOString()
            : null,
        })
        .eq('id', conexao.id);

      renovadas++;
    } catch (erro) {
      // Uma conexão que não renova não pode derrubar a passada inteira: as
      // outras ainda têm publicação para fazer. O `expires_at` continua
      // vencendo, e a tela de Integrações mostra isso.
      console.error(
        '[publicar] renovação',
        conexao.account_name,
        erro instanceof Error ? erro.message : erro
      );
    }
  }
  return renovadas;
};

/**
 * O resultado de publicar um item da fila.
 *
 * `avisoDoStory` existe para o caso em que o feed saiu e o story não: é
 * publicado **com ressalva**, nunca falha, porque falhar republicaria o feed.
 */
type ResultadoDaPublicacao = {
  id: string;
  idDoStory?: string;
  avisoDoStory?: string;
};

/**
 * O motivo, quando a peça é feed+story e a arte vertical não existe.
 *
 * Numa constante porque as duas redes dão a mesma resposta, e porque o texto
 * chega **ao cliente da agência** pela tela de Publicações: ele tem de dizer o
 * que fazer, não só que algo faltou.
 */
const SEM_ARTE_DE_STORY =
  'O feed saiu. O story não: este conteúdo é "Feed + Story" e não tem arte de story. ' +
  'Suba a arte 9:16 em "Mídia do Story" e publique o story pelo aplicativo — ' +
  'republicar aqui duplicaria o feed.';

const publicarItem = async (
  supabase: any,
  item: any
): Promise<ResultadoDaPublicacao> => {
  const { data: conexao } = await supabase
    .from('social_connections')
    .select('platform, account_id')
    .eq('id', item.connection_id)
    .maybeSingle();

  if (!conexao) throw new Error('A conta conectada não existe mais.');
  if (!publicaSozinho(conexao.platform)) {
    throw new Error(`Publicação em ${conexao.platform} ainda não implementada.`);
  }

  const { data: token } = await supabase
    .from('social_tokens')
    .select('access_token')
    .eq('connection_id', item.connection_id)
    .maybeSingle();

  if (!token?.access_token) throw new Error('Conexão sem token. Reconecte a conta.');

  const { data: job } = await supabase
    .from('jobs')
    .select('title, caption, media_urls, story_media_urls, format, hashtags')
    .eq('id', item.job_id)
    .maybeSingle();

  if (!job) throw new Error('O conteúdo não existe mais.');

  const midia = (job.media_urls || [])[0];
  if (!midia) throw new Error('O conteúdo não tem mídia para publicar.');
  if (midia.startsWith('data:')) {
    throw new Error('A mídia precisa estar numa URL pública, não embutida.');
  }

  const legenda = [job.caption || job.title, (job.hashtags || []).join(' ')]
    .filter(Boolean)
    .join('\n\n');

  /**
   * Dois caminhos, e eles não se parecem por dentro.
   *
   * O Instagram cria um contêiner e espera a Meta processar; o Facebook
   * publica em um passo, e com o token **da Página**, que é o que
   * `social-callback` guardou. Ver `api/_lib/facebook.ts`.
   */
  if (conexao.platform === 'facebook') {
    /**
     * **Story de Página agora existe**, e por isso o `throw` que morava aqui
     * saiu. Ele era o cinto de quando `api/_lib/facebook.ts` não tinha o
     * fluxo: sem publicador, um conteúdo feed+story numa Página publicaria só
     * o feed e **descartaria a arte do story em silêncio**, com a fila dizendo
     * "publicado".
     *
     * O que substitui o cinto não é confiança: é a mesma captura do Instagram,
     * logo abaixo. O feed sai primeiro e a falha do story vira `last_error` —
     * ou a arte sai, ou a tela nomeia o motivo de não ter saído.
     */
    if (job.format === 'story') {
      return {
        id: await publicarStoryNoFacebook(conexao.account_id, token.access_token, midia),
      };
    }

    const idDoFeedNaPagina = await publicarNoFacebook(
      conexao.account_id,
      token.access_token,
      midia,
      legenda
    );

    if (job.format !== 'feed_story') return { id: idDoFeedNaPagina };

    /**
     * **O feed já está no ar, e isso muda tudo o que vem depois.**
     *
     * Deixar a exceção subir marcaria o item como `pendente`, e a passada
     * seguinte começaria publicando o **feed** de novo. Post duplicado no
     * perfil do cliente não volta.
     */
    const arteDoStoryNaPagina = (job.story_media_urls || [])[0];
    if (!arteDoStoryNaPagina) {
      return { id: idDoFeedNaPagina, avisoDoStory: SEM_ARTE_DE_STORY };
    }

    try {
      const idDoStory = await publicarStoryNoFacebook(
        conexao.account_id,
        token.access_token,
        arteDoStoryNaPagina
      );
      return { id: idDoFeedNaPagina, idDoStory };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.';
      return {
        id: idDoFeedNaPagina,
        avisoDoStory: `O feed saiu, o story não: ${motivo}`,
      };
    }
  }

  /**
   * "Feed + Story" é **uma peça com duas saídas**, e sai em dois contêineres.
   *
   * A ordem é feed primeiro, de propósito: é ele que tem métrica, permalink e
   * vida longa. O story expira em 24h.
   */
  const ehFeedStory = job.format === 'feed_story';
  const destino: 'feed' | 'story' = job.format === 'story' ? 'story' : 'feed';

  const idDoFeed = await publicarNoInstagram(
    conexao.account_id,
    token.access_token,
    midia,
    legenda,
    destino
  );

  if (!ehFeedStory) return { id: idDoFeed };

  /**
   * **O feed já está no ar, e isso muda tudo o que vem depois.**
   *
   * Se o story falhar agora, a exceção subiria e o laço marcaria o item como
   * `pendente` ou `falhou` — e a passada seguinte republicaria o **feed**.
   * Post duplicado no perfil do cliente não volta, e é o pior desfecho desta
   * rota.
   *
   * Por isso a falha do story é **capturada aqui**: o item fecha como
   * publicado, com o motivo em `last_error`. O story não sai sozinho depois;
   * quem decide republicar é uma pessoa, com o feed já no ar à vista.
   */
  /**
   * **Sem arte de story, o story não sai — e isso é a correção de um post
   * errado no perfil de um cliente.**
   *
   * Aqui havia `(job.story_media_urls || [])[0] || midia`: faltando a arte
   * vertical, ele mandava a **do feed**. A Meta aceita, publica, e a fila
   * fecha como `publicado` com `story_external_id` preenchido e `last_error`
   * nulo — sucesso completo, story errado no ar. Foi o que aconteceu no
   * primeiro teste real: feed certo, story com a arte 4:5 esticada no 9:16.
   *
   * O fallback parecia generoso e era o oposto. As proporções são outras —
   * 4:5 e 9:16 —, então a mesma imagem nos dois **sai cortada num deles**;
   * é a razão de `story_media_urls` ser coluna própria, escrita neste mesmo
   * arquivo. Substituir uma arte por outra é decisão de quem produz a peça,
   * nunca do publicador.
   *
   * O desfecho segue o padrão que já existe logo abaixo, para a falha do
   * story: o feed fica no ar (ele está certo), o item fecha como publicado —
   * marcar `falhou` republicaria o feed na passada seguinte — e o motivo vai
   * para `last_error`, à vista na fila e na tela do conteúdo.
   */
  const midiaDoStory = (job.story_media_urls || [])[0];
  if (!midiaDoStory) {
    return { id: idDoFeed, avisoDoStory: SEM_ARTE_DE_STORY };
  }

  try {
    const idDoStory = await publicarNoInstagram(
      conexao.account_id,
      token.access_token,
      midiaDoStory,
      '',
      'story'
    );
    return { id: idDoFeed, idDoStory };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.';
    return {
      id: idDoFeed,
      avisoDoStory: `O feed saiu, o story não: ${motivo}`,
    };
  }
};

/**
 * Quantos dias de publicação a medição cobre.
 *
 * Métrica de post antigo não muda mais, e remedi-la gastaria a passada
 * inteira num número que ninguém vai olhar. Trinta dias é a janela em que um
 * post ainda ganha alcance — e é o período que um relatório mensal pede.
 */
const DIAS_DE_METRICA = 30;

/** Quantos posts por passada. O teto real é o orçamento de tempo. */
const METRICAS_POR_PASSADA = 15;

/**
 * Atualiza as métricas do que já foi publicado.
 *
 * **Quem mede é o cron, e isso não é escolha de arquitetura — é a única
 * opção.** O número vem da Meta pelo token, e `social_tokens` tem RLS ligada
 * com zero políticas: nem o dono da agência alcança. O navegador não tem como
 * buscar isso, então a tela lê `post_metrics`, que só a chave de serviço
 * escreve.
 *
 * A linha nasce **sem número**, no momento da publicação, com `medido_em` no
 * epoch — assim ela é a primeira da fila de medição em vez de depender de
 * alguém lembrar de criá-la.
 */
const atualizarMetricas = async (
  supabase: any,
  comecou: number
): Promise<{ medidos: number; falhas: number }> => {
  let medidos = 0;
  let falhas = 0;

  const desde = new Date(Date.now() - DIAS_DE_METRICA * 24 * 60 * 60_000).toISOString();

  // Backfill: o que foi publicado antes desta rotina existir, ou antes de a
  // linha ser criada por qualquer motivo. Sem isto o histórico ficaria para
  // sempre sem medição, e a tela mostraria só o que nasceu depois do deploy —
  // uma tela que começa vazia escondendo o que já aconteceu.
  /**
   * **Só Instagram.** `buscarMetricas` fala com `graph.instagram.com`; um post
   * de Página do Facebook precisa de outro endpoint, que ainda não existe
   * aqui. Marcar a linha como `instagram` e medir mesmo assim encheria
   * `ultimo_erro` de falha previsível e esconderia as reais no meio.
   */
  const { data: doInstagram } = await supabase
    .from('social_connections')
    .select('id')
    .eq('platform', 'instagram');

  const conexoesDoInstagram = (doInstagram || []).map((c: any) => c.id);
  if (!conexoesDoInstagram.length) return { medidos, falhas };

  const { data: publicados } = await supabase
    .from('publish_queue')
    .select('id, job_id, connection_id, workspace_id, external_id, published_at')
    .eq('status', 'publicado')
    .in('connection_id', conexoesDoInstagram)
    .not('external_id', 'is', null)
    .gte('published_at', desde)
    .limit(200);

  for (const item of publicados || []) {
    await supabase.from('post_metrics').upsert(
      {
        workspace_id: item.workspace_id,
        job_id: item.job_id,
        connection_id: item.connection_id,
        platform: 'instagram',
        external_id: item.external_id,
        publicado_em: item.published_at,
        // Epoch: primeira da fila de medição. `ignoreDuplicates` impede que
        // este valor sobrescreva a medição de uma linha que já existe.
        medido_em: new Date(0).toISOString(),
      },
      { onConflict: 'connection_id,external_id', ignoreDuplicates: true }
    );
  }

  const { data: aMedir } = await supabase
    .from('post_metrics')
    .select('id, connection_id, external_id')
    .eq('platform', 'instagram')
    .gte('publicado_em', desde)
    .order('medido_em')
    .limit(METRICAS_POR_PASSADA);

  for (const linha of aMedir || []) {
    if (Date.now() - comecou > ORCAMENTO_MS) break;

    try {
      const { data: token } = await supabase
        .from('social_tokens')
        .select('access_token')
        .eq('connection_id', linha.connection_id)
        .maybeSingle();

      if (!token?.access_token) throw new Error('Conexão sem token.');

      const m = await buscarMetricas(linha.external_id, token.access_token);

      await supabase
        .from('post_metrics')
        .update({
          alcance: m.alcance,
          curtidas: m.curtidas,
          comentarios: m.comentarios,
          salvamentos: m.salvamentos,
          compartilhamentos: m.compartilhamentos,
          permalink: m.permalink,
          medido_em: new Date().toISOString(),
          ultimo_erro: null,
        })
        .eq('id', linha.id);

      medidos += 1;
    } catch (erro) {
      // `medido_em` avança mesmo na falha: sem isso a mesma linha quebrada
      // seria tentada em toda passada e seguraria a fila inteira atrás dela.
      // O motivo fica gravado, à vista.
      await supabase
        .from('post_metrics')
        .update({
          medido_em: new Date().toISOString(),
          ultimo_erro: erro instanceof Error ? erro.message : 'Falha desconhecida.',
        })
        .eq('id', linha.id);

      falhas += 1;
    }
  }

  return { medidos, falhas };
};

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
