import { PutObjectCommand } from '@aws-sdk/client-s3';
import { rota } from './_lib/rota.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  clienteDeServico,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth.js';
import {
  r2Configurado,
  clienteR2,
  listarObjetos,
  apagarObjeto,
  abrirEnvio,
  continuarEnvio,
  abortarEnvio,
  type EnvioEmCurso,
} from './_lib/r2.js';
import {
  credenciaisDoGoogle,
  renovarAcesso,
  liberarPorLink,
  trancarPorLink,
} from './_lib/googleDrive.js';


/**
 * URL pré-assinada para upload no Cloudflare R2.
 *
 * O arquivo vai do navegador direto para o R2: o binário não passa pela
 * função, o que evita o limite de corpo do serverless e não paga trânsito
 * duas vezes. As credenciais do R2 ficam só aqui.
 *
 * Substitui o base64 no localStorage, que estourava a cota do navegador com
 * dois ou três anexos.
 */

const TIPOS_PERMITIDOS = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
]);

const TAMANHO_MAXIMO = 100 * 1024 * 1024; // 100 MB

/**
 * Pasta dos arquivos do produto, e não de uma agência.
 *
 * Não é um uuid, e é por isso que serve: `workspaces.id` é uuid, então
 * nenhuma agência pode se chamar assim e disputar esta pasta.
 */
const PASTA_DA_PLATAFORMA = 'plataforma';

/** Nome de arquivo seguro: sem caminho, sem caractere de controle. */
const nomeSeguro = (nome: string): string =>
  nome
    .split(/[\\/]/).pop()!
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .slice(-120) || 'arquivo';

/**
 * Confere que a pessoa é da agência, pela RLS, e devolve o papel.
 *
 * Extraído porque os três modos precisam da mesma conferência: pedir URL,
 * listar a biblioteca e apagar um arquivo. Uma cópia por modo é o jeito mais
 * rápido de um deles ficar para trás quando a regra mudar.
 */
const papelNaAgencia = async (
  request: Request,
  workspaceId: string,
  userId: string
): Promise<{ role: string } | Response> => {
  const supabase = clienteDoUsuario(request);
  const { data: membro, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return falharComSeguranca('upload/membership', error, 500);
  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);
  if (membro.role === 'client') {
    return json({ error: 'Seu perfil não pode gerenciar arquivos.' }, 403);
  }
  return membro;
};

async function handler(request: Request): Promise<Response> {
  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  /**
   * **Antes dos três modos, e não só do POST.**
   *
   * `listarObjetos` devolve lista vazia quando o R2 não está configurado, e
   * uma Biblioteca vazia é indistinguível de uma agência que ainda não subiu
   * nada — a tela diria "nenhum arquivo" para um problema de configuração.
   * É a armadilha 9: quem depende de configuração externa **diz o que
   * falta, com o nome da variável**, em vez de mostrar o zero.
   */
  if (!r2Configurado()) {
    return json(
      {
        error:
          'Armazenamento de arquivos não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET.',
        code: 'STORAGE_NOT_CONFIGURED',
      },
      503
    );
  }

  /**
   * Três modos numa rota só, e isso é o limite de 12 funções da armadilha 6.
   *
   * A Biblioteca precisa listar e apagar arquivos do R2, e as credenciais do
   * R2 já moram aqui — uma rota nova para cada verbo levaria o produto a 14
   * e **o deploy inteiro falharia**, com a produção presa na versão anterior.
   * Juntar é a resposta padrão daqui quando aparece rota nova.
   */
  if (request.method === 'GET') return listarDaBiblioteca(request, usuario.id);
  if (request.method === 'DELETE') return apagarDaBiblioteca(request, usuario.id);

  /*
    Quarto modo: a miniatura do arquivo do Drive. Ela é buscada aqui por
    causa de CORS — o endereço de miniatura do Google não manda cabeçalho de
    origem cruzada, e o `fetch` da aba falha antes do primeiro byte.
  */
  if (request.method === 'POST') {
    const espiada = await request.clone().json().catch(() => ({} as any));
    if (espiada?.acao === 'miniatura-do-drive') {
      return miniaturaDoDrive(request, usuario.id);
    }
    // E a cópia do arquivo em si, pelo mesmo motivo: o download do Drive
    // redireciona para um domínio que não libera origem cruzada, e no
    // navegador ele morre antes do primeiro byte.
    if (espiada?.acao === 'copiar-do-drive') {
      return copiarDoDrive(request, usuario.id);
    }
    // E a liberação por link, que é o que faz o player do Google tocar no
    // portal — ele transcodifica, o nosso `<video>` entrega o original.
    if (espiada?.acao === 'liberar-no-drive') {
      return acessoPorLinkNoDrive(request, usuario.id, true);
    }
    if (espiada?.acao === 'trancar-no-drive') {
      return acessoPorLinkNoDrive(request, usuario.id, false);
    }
  }

  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  if (excedeuLimite(`upload:${usuario.id}`, 60, 60_000)) {
    return json({ error: 'Muitos uploads em sequência. Aguarde um instante.' }, 429);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { fileName, contentType, size, workspaceId } = corpo || {};

  if (!textoValido(fileName, 300)) {
    return json({ error: 'Informe o nome do arquivo.' }, 400);
  }
  if (!textoValido(contentType, 120) || !TIPOS_PERMITIDOS.has(contentType)) {
    return json({ error: 'Tipo de arquivo não permitido.' }, 400);
  }
  if (typeof size !== 'number' || size <= 0 || size > TAMANHO_MAXIMO) {
    return json(
      { error: `Arquivo acima do limite de ${TAMANHO_MAXIMO / 1024 / 1024} MB.` },
      413
    );
  }
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }

  try {
    const supabase = clienteDoUsuario(request);

    if (workspaceId === PASTA_DA_PLATAFORMA) {
      // Marca, banners e imagem de prévia do próprio Orquesia não pertencem a
      // agência nenhuma. Sem este caso, o dono do produto teria que gravá-los
      // dentro de uma agência qualquer — e o arquivo da tela de entrada
      // passaria a morar na pasta de um cliente.
      //
      // A RLS de platform_admins só deixa um admin enxergar a própria linha:
      // para qualquer outro a consulta volta vazia, que é exatamente a
      // resposta. Não há checagem de papel no navegador aqui.
      const { data: admin, error } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', usuario.id)
        .maybeSingle();

      if (error) return falharComSeguranca('upload/plataforma', error, 500);
      if (!admin) {
        return json(
          { error: 'Só o administrador da plataforma grava nesta pasta.' },
          403
        );
      }
    } else {
      // O usuário diz em qual agência quer gravar, então confirmamos que ele
      // pertence a ela — a consulta passa pela RLS, como qualquer outra.
      const membro = await papelNaAgencia(request, workspaceId, usuario.id);
      if (membro instanceof Response) return membro;
    }

    // Prefixo por agência: mantém os arquivos separados e evita colisão.
    const chave = `${workspaceId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(fileName)}`;

    const urlDeUpload = await getSignedUrl(
      clienteR2(),
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: chave,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: 300 }
    );

    // URL pública: exige domínio ligado ao bucket no painel do R2.
    const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    const urlPublica = base ? `${base}/${chave}` : null;

    return json({ uploadUrl: urlDeUpload, key: chave, publicUrl: urlPublica });
  } catch (erro) {
    return falharComSeguranca('upload/presign', erro);
  }
}

/**
 * A Biblioteca: tudo que a agência tem no R2.
 *
 * Lê **o balde**, e não uma tabela de índice. Índice só conheceria o que foi
 * enviado depois de ele existir, e o acervo de uma agência em uso já está
 * lá — começar do zero esconderia meses de arquivo.
 *
 * O balde não sabe de quem é cada arquivo: a chave é `workspaceId/nome`,
 * plana. A pasta do cliente é derivada do **uso** no navegador, cruzando com
 * `jobs.media_urls`, `client_materials.url` e `clients.files`. Guardar o
 * cliente na chave resolveria só os arquivos novos, e deixaria os antigos
 * órfãos para sempre.
 */
/**
 * A miniatura de um arquivo do Drive, guardada no R2.
 *
 * **Ela é buscada aqui, e não no navegador, por causa de CORS.** A URL que o
 * Google devolve aponta para `lh3.googleusercontent.com`, que **não manda**
 * cabeçalho de origem cruzada: o `fetch` da aba falha antes de ler o
 * primeiro byte. A primeira versão tentou no navegador e a miniatura vinha
 * sempre vazia — o cartão mostrava o nome do arquivo, e a prévia e o portal
 * ficavam com o quadro em branco. No servidor não há CORS.
 *
 * E ela **precisa** virar um arquivo nosso: a URL do Google é curta de vida
 * e pede a conta que autorizou, enquanto o portal do cliente é anônimo por
 * definição. Nenhum endereço do Google carrega lá.
 *
 * São alguns kilobytes. O vídeo, que é o que pesa, continua só no Drive.
 *
 * Mora nesta rota porque é aqui que as credenciais do R2 já estão — rota
 * nova levaria o produto a 13 funções e **derrubaria o deploy inteiro**
 * (armadilha 6).
 */
/**
 * Um token de acesso ao Drive da agência, para uso interno desta rota.
 *
 * Devolve o **motivo** em vez de lançar: as duas chamadas que o usam — a
 * miniatura e a cópia do arquivo — tratam "não deu" como desfecho válido, e
 * o que elas precisam é dizer por que não deu. Foi a falta disso que fez
 * esta entrega levar três rodadas.
 */
const acessoDoDrive = async (
  workspaceId: string,
  /**
   * Qual conta do Drive.
   *
   * A agência pode ter duas — a dela e a do cliente — e o token de uma não
   * alcança o arquivo da outra: `drive.file` é por app **e por conta**, e
   * usar a errada devolve 404, que é o mesmo sintoma do arquivo sem
   * concessão.
   *
   * Ausente, cai na conta **mais antiga** da agência: é a única que existia
   * quando as referências sem esse campo foram gravadas.
   */
  contaId?: string
): Promise<{ token?: string; motivo?: string }> => {
  const { id, segredo } = credenciaisDoGoogle();
  if (!id || !segredo) {
    return { motivo: 'falta GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET no servidor' };
  }

  const supabase = clienteDeServico();
  if (!supabase) return { motivo: 'falta a chave de serviço no servidor' };

  /*
    A conta é conferida **contra a agência de quem pediu**, e não aceita como
    veio: sem isso, um id de conta de outra agência daria acesso ao Drive
    dela. É o mesmo cuidado da chave do balde, que é conferida contra o
    prefixo antes de apagar.
  */
  const consulta = supabase
    .from('drive_contas')
    .select('id')
    .eq('workspace_id', workspaceId);

  const { data: conta } = contaId
    ? await consulta.eq('id', contaId).maybeSingle()
    : await consulta.order('conectado_em').limit(1).maybeSingle();

  if (!conta) {
    return {
      motivo: contaId
        ? 'esta conta do Google Drive não pertence à agência'
        : 'esta agência não tem Google Drive conectado',
    };
  }

  const { data: credencial } = await supabase
    .from('drive_contas_credenciais')
    .select('refresh_token')
    .eq('conta_id', conta.id)
    .maybeSingle();

  if (!credencial?.refresh_token) {
    return { motivo: 'esta conta do Google Drive perdeu a credencial — reconecte' };
  }

  try {
    const { acesso } = await renovarAcesso(credencial.refresh_token, id, segredo);
    return { token: acesso };
  } catch {
    return { motivo: 'a autorização do Google Drive expirou ou foi revogada' };
  }
};

/**
 * Traz um arquivo do Drive para o balde.
 *
 * ### Por que aqui, e não no navegador
 *
 * A primeira versão baixava no navegador: `fetch` no `drive/v3/files/ID?alt=media`
 * e `PUT` na URL pré-assinada. Funciona às vezes, e "às vezes" é o problema —
 * o download do Drive **redireciona** para `googleusercontent.com`, e o
 * destino do redirecionamento não manda cabeçalho de origem cruzada. O
 * navegador corta antes do primeiro byte, o erro é capturado, e a peça fica
 * sem cópia sem nada dizer.
 *
 * Foi o que aconteceu com dois vídeos seguidos enquanto a miniatura — que
 * **já** era buscada aqui, pelo mesmo motivo — funcionava nos dois. O sinal
 * estava na mesa: o que roda no servidor passa, o que roda na aba não.
 *
 * Aqui não há CORS, não há memória de aba e não depende de qual navegador
 * está aberto.
 *
 * ### O teto existe e é dito
 *
 * A função serverless tem 60 segundos e memória finita. Acima do teto o
 * arquivo **não** é copiado, e a resposta diz isso com o tamanho — a peça
 * segue com a miniatura, e quem produz fica sabendo por quê. Um arquivo que
 * estoura o tempo no meio deixaria a função morta sem resposta, que é o
 * mesmo silêncio de antes com outro nome.
 */
/**
 * O teto da cópia.
 *
 * Era 100 MB porque o arquivo inteiro ia para a memória da função — e o
 * primeiro vídeo real a esbarrar nele tinha **109 MB**, que é o tamanho de
 * um Reels comum. O teto não descrevia uma decisão de produto; descrevia o
 * `PutObject` simples.
 *
 * Com o envio em partes, o pico de memória é o tamanho de uma parte. O que
 * limita agora é **tempo**: a função tem 60 segundos para baixar do Google e
 * subir para o balde. 500 MB é o que cabe nessa janela com folga em conexão
 * de datacenter, e acima disso a resposta diz o tamanho em vez de deixar a
 * função morrer sem responder — que é o mesmo silêncio que custou três
 * rodadas de diagnóstico.
 */
const LIMITE_DA_COPIA = 500 * 1024 * 1024;

const copiarDoDrive = async (request: Request, userId: string): Promise<Response> => {
  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { workspaceId, fileId, contaId, continuar, desistir } = corpo || {};
  if (!textoValido(workspaceId, 64) || !textoValido(fileId, 200)) {
    return json({ error: 'Agência ou arquivo não informado.' }, 400);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);

  if (!r2Configurado()) {
    return json({ error: 'Armazenamento não configurado.', code: 'NOT_CONFIGURED' }, 503);
  }

  /**
   * O estado de uma cópia em andamento, conferido antes de valer qualquer
   * coisa.
   *
   * Ele viaja pelo navegador e volta, então **não é credencial**. A chave tem
   * de começar pelo `workspaceId` de quem está chamando: sem isso, quem tem
   * uma agência qualquer manda a chave de outra e passa a gravar dentro dela.
   * É a mesma conferência da exclusão na Biblioteca, onde ela já está
   * registrada como o que separa a checagem de membro de um enfeite.
   */
  const emCurso = (bruto: any): EnvioEmCurso | null => {
    if (!bruto || typeof bruto !== 'object') return null;
    const { chave, uploadId, partes, copiados } = bruto;

    if (!textoValido(chave, 300) || !textoValido(uploadId, 300)) return null;
    if (!chave.startsWith(`${workspaceId}/`)) return null;
    if (!Array.isArray(partes) || partes.length > 10_000) return null;
    if (typeof copiados !== 'number' || !Number.isFinite(copiados) || copiados < 0) return null;

    return {
      chave,
      uploadId,
      copiados,
      partes: partes.map((p: any, i: number) => ({
        ETag: String(p?.ETag || ''),
        PartNumber: Number(p?.PartNumber) || i + 1,
      })),
    };
  };

  /*
    Desistir é um modo, e ele existe por dinheiro: o envio agora sobrevive
    entre chamadas, então parte enviada e não concluída fica no balde —
    invisível na listagem, e cobrada pela Cloudflare até alguém limpar. Quem
    para de tentar precisa dizer, porque o balde não tem como saber que
    ninguém vai voltar.
  */
  if (desistir) {
    const envio = emCurso(continuar);
    if (envio) await abortarEnvio(envio);
    return json({ url: null, motivo: 'cópia cancelada' });
  }

  const acesso = await acessoDoDrive(workspaceId, contaId);
  if (!acesso.token) return json({ url: null, motivo: acesso.motivo });

  try {
    const ficha = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
        '?fields=name,mimeType,size&supportsAllDrives=true',
      { headers: { Authorization: `Bearer ${acesso.token}` } }
    );

    if (!ficha.ok) {
      return json({
        url: null,
        motivo:
          ficha.status === 404
            ? 'o arquivo não está mais no Drive, ou o acesso foi retirado'
            : `o Google recusou a ficha do arquivo (${ficha.status})`,
      });
    }

    const dados = await ficha.json();
    const tamanho = Number(dados.size || 0);

    if (tamanho > LIMITE_DA_COPIA) {
      const mb = Math.round(tamanho / 1024 / 1024);
      return json({
        url: null,
        /*
          O número sai da constante, e isso não é estilo: ele estava escrito à
          mão e **ficou para trás** quando o teto subiu de 100 para 500 MB. Um
          arquivo de 600 MB era recusado dizendo que o limite era 100 — a
          pessoa comprimia o vídeo para 200 MB, que já passava desde sempre, e
          o produto respondia com um número que ninguém mais usava.
        */
        motivo: `o arquivo tem ${mb} MB e o limite de cópia é ${Math.round(
          LIMITE_DA_COPIA / 1024 / 1024
        )} MB`,
      });
    }

    const tipo = dados.mimeType || 'application/octet-stream';
    const retomando = emCurso(continuar);

    /*
      Retomando, o download recomeça **do byte onde o envio parou** — não do
      começo. Sem o `Range`, cada chamada baixaria o arquivo inteiro de novo
      para chegar ao ponto certo, e a cópia nunca terminaria: cada rodada
      gastaria o orçamento inteiro repetindo o que a anterior já fez.
    */
    const conteudo = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
        '?alt=media&supportsAllDrives=true',
      {
        headers: {
          Authorization: `Bearer ${acesso.token}`,
          ...(retomando?.copiados ? { Range: `bytes=${retomando.copiados}-` } : {}),
        },
      }
    );

    if (!conteudo.ok) {
      return json({ url: null, motivo: `o Google recusou o download (${conteudo.status})` });
    }

    /*
      **Retomar só vale se o Google honrou o `Range`.** Ele responde 206 com
      o pedaço pedido; um 200 significa que veio o arquivo inteiro, e
      continuar dali gravaria o começo do vídeo no meio dele — um arquivo
      corrompido que nada acusa, porque o tamanho fecha. Melhor recomeçar do
      zero e gastar uma rodada.
    */
    if (retomando?.copiados && conteudo.status !== 206) {
      await abortarEnvio(retomando);
      return json({
        url: null,
        motivo: 'o Google não aceitou continuar de onde parou; a cópia recomeça do início',
        recomecar: true,
      });
    }

    if (!conteudo.body) return json({ url: null, motivo: 'o Google não devolveu conteúdo' });

    const envio =
      retomando ||
      (await abrirEnvio(
        `${workspaceId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(
          dados.name || `${fileId}.mp4`
        )}`,
        tipo
      ));

    /*
      Em partes, e não `arrayBuffer()`: o buffer inteiro na memória é o que
      obrigava o teto de 100 MB, e o primeiro vídeo real a esbarrar nele
      tinha 109. Aqui o pico é o tamanho de uma parte.
    */
    const resultado = await continuarEnvio(
      envio,
      conteudo.body as ReadableStream<Uint8Array>
    );

    /*
      Não acabou: o envio fica **aberto** no balde e o estado volta para quem
      chamou, que torna a pedir. O tempo de uma função deixa de ser um teto de
      tamanho — era ele que fazia o vídeo de 160 MB falhar sempre, com a
      mensagem mandando "tentar de novo", que é o único conselho que não podia
      funcionar: a tentativa seguinte refazia o mesmo percurso e parava no
      mesmo lugar.
    */
    if (!resultado.concluido) {
      return json({
        url: null,
        pendente: resultado.envio,
        total: tamanho || null,
      });
    }

    const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!base) return json({ url: null, motivo: 'falta R2_PUBLIC_BASE_URL no servidor' });

    return json({ url: `${base}/${resultado.envio.chave}`, chave: resultado.envio.chave });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'falha desconhecida';
    console.warn('[upload] cópia do drive', motivo);
    return json({ url: null, motivo });
  }
};

/**
 * Libera (ou tranca) por link os arquivos do Drive de uma peça.
 *
 * **É o que faz o portal tocar sem gastar o celular do cliente.** O player do
 * Google transcodifica e escolhe a resolução pela conexão; o nosso `<video>`
 * apontando para o balde entrega o original — 109 MB num vídeo comum.
 *
 * A liberação é retirada quando a peça sai de aprovação, e é isso que torna
 * a exposição aceitável: enquanto ela existe, quem tiver o endereço do
 * arquivo assiste.
 *
 * Os ids vêm do corpo, e a agência é conferida antes — mas repare que a
 * conferência que importa é outra: o token é **da agência**, e `drive.file`
 * só alcança os arquivos que aquele app recebeu pelo seletor. Um id de
 * arquivo alheio simplesmente não é alcançável, mesmo que alguém o mande.
 */
const acessoPorLinkNoDrive = async (
  request: Request,
  userId: string,
  liberar: boolean
): Promise<Response> => {
  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { workspaceId, fileIds, contaId } = corpo || {};
  if (!textoValido(workspaceId, 64) || !Array.isArray(fileIds) || !fileIds.length) {
    return json({ error: 'Agência ou arquivos não informados.' }, 400);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);

  const acesso = await acessoDoDrive(workspaceId, contaId);
  if (!acesso.token) return json({ ok: false, motivo: acesso.motivo });

  let feitos = 0;
  // Dez por chamada: uma peça tem no máximo dez artes, e um número solto
  // aqui viraria uma varredura do Drive inteiro no dia em que alguém
  // mandasse uma lista grande.
  for (const fileId of fileIds.slice(0, 10)) {
    if (!textoValido(fileId, 200)) continue;
    const deuCerto = liberar
      ? await liberarPorLink(fileId, acesso.token)
      : await trancarPorLink(fileId, acesso.token);
    if (deuCerto) feitos += 1;
  }

  return json({ ok: true, feitos });
};

const miniaturaDoDrive = async (request: Request, userId: string): Promise<Response> => {
  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { workspaceId, fileId, contaId } = corpo || {};
  if (!textoValido(workspaceId, 64) || !textoValido(fileId, 200)) {
    return json({ error: 'Agência ou arquivo não informado.' }, 400);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);

  if (!r2Configurado()) {
    return json({ error: 'Armazenamento não configurado.', code: 'NOT_CONFIGURED' }, 503);
  }

  const acessoDaAgencia = await acessoDoDrive(workspaceId, contaId);
  if (!acessoDaAgencia.token) return json({ url: null, motivo: acessoDaAgencia.motivo });

  try {
    const acesso = acessoDaAgencia.token;

    const ficha = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
        '?fields=thumbnailLink,hasThumbnail,mimeType&supportsAllDrives=true',
      { headers: { Authorization: `Bearer ${acesso}` } }
    );

    if (!ficha.ok) {
      return json({ url: null, motivo: `o Google recusou a ficha do arquivo (${ficha.status})` });
    }

    const dados = await ficha.json();

    /**
     * **Dois endereços, e o segundo existe porque o primeiro não é
     * garantido.**
     *
     * `thumbnailLink` só vem quando o Google já gerou a miniatura — para um
     * vídeo recém-enviado ele pode demorar, e para alguns formatos não vem
     * nunca. `drive.google.com/thumbnail` gera sob demanda e aceita o token
     * no cabeçalho, então serve de segunda tentativa.
     */
    const candidatos = [
      typeof dados.thumbnailLink === 'string'
        ? dados.thumbnailLink.replace(/=s\d+(-c)?$/, '=s800')
        : null,
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`,
    ].filter(Boolean) as string[];

    let imagem: Response | null = null;
    const tentativas: string[] = [];

    for (const endereco of candidatos) {
      /*
        Com o cabeçalho primeiro: para arquivo que não é público, o Google
        devolve 403 sem ele. Sem o cabeçalho depois, porque alguns endereços
        de miniatura recusam a credencial em vez de ignorá-la.
      */
      for (const comToken of [true, false]) {
        const tentativa = await fetch(
          endereco,
          comToken ? { headers: { Authorization: `Bearer ${acesso}` } } : undefined
        );

        const tipo = tentativa.headers.get('content-type') || '';
        // Uma página de erro do Google volta com 200 e `text/html`. Gravá-la
        // daria uma "miniatura" que o navegador não desenha — o mesmo quadro
        // vazio, agora com um arquivo no balde.
        if (tentativa.ok && tipo.startsWith('image/')) {
          imagem = tentativa;
          break;
        }

        tentativas.push(`${tentativa.status}${tipo ? ` ${tipo.split(';')[0]}` : ''}`);
      }
      if (imagem) break;
    }

    if (!imagem) {
      return json({
        url: null,
        motivo:
          `o Google não devolveu imagem (${tentativas.join(', ')})` +
          (dados.hasThumbnail === false ? ' — este arquivo ainda não tem miniatura gerada' : ''),
      });
    }

    const bytes = Buffer.from(await imagem.arrayBuffer());
    const tipo = imagem.headers.get('content-type') || 'image/jpeg';
    const chave = `${workspaceId}/${Date.now()}-miniatura-${nomeSeguro(`${fileId}.jpg`)}`;

    await clienteR2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: chave,
        Body: bytes,
        ContentType: tipo,
      })
    );

    const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    // Sem domínio público a miniatura existe no balde e não abre em lugar
    // nenhum. `null` aqui faz a tela cair no nome do arquivo, que é honesto.
    return json(
      base
        ? { url: `${base}/${chave}` }
        : { url: null, motivo: 'falta R2_PUBLIC_BASE_URL no servidor' }
    );
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'falha desconhecida';
    console.warn('[upload] miniatura do drive', motivo);
    return json({ url: null, motivo });
  }
};

const listarDaBiblioteca = async (request: Request, userId: string): Promise<Response> => {
  const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (membro instanceof Response) return membro;

  try {
    // O prefixo com a barra é o que impede uma agência de ler a de outra:
    // sem ela, `abc` casaria com `abcdef/`.
    const arquivos = await listarObjetos(`${workspaceId}/`);
    return json({ arquivos });
  } catch (erro) {
    return falharComSeguranca('biblioteca/listar', erro);
  }
};

/**
 * Apaga um arquivo do R2.
 *
 * **A chave é conferida contra a agência**, e não aceita como veio: sem isso,
 * uma sessão qualquer mandaria a chave de outra agência e apagaria o arquivo
 * dela — a conferência de membro acima seria inútil, porque ela olha o
 * `workspaceId` do corpo, não a chave.
 */
const apagarDaBiblioteca = async (request: Request, userId: string): Promise<Response> => {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId') || '';
  const chave = url.searchParams.get('key') || '';

  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }
  if (!textoValido(chave, 500)) {
    return json({ error: 'Arquivo não informado.' }, 400);
  }
  if (!chave.startsWith(`${workspaceId}/`)) {
    return json({ error: 'Este arquivo não é desta agência.' }, 403);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (membro instanceof Response) return membro;

  try {
    await apagarObjeto(chave);
    return json({ ok: true });
  } catch (erro) {
    return falharComSeguranca('biblioteca/apagar', erro);
  }
};

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

/**
 * Handler no formato Web, exportado para os testes chamarem direto.
 * O que a Vercel executa é o default abaixo.
 */
export const POST = handler;
export const GET = handler;
export const DELETE = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
