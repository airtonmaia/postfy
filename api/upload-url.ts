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
import { r2Configurado, clienteR2, listarObjetos, apagarObjeto } from './_lib/r2.js';
import { credenciaisDoGoogle, renovarAcesso } from './_lib/googleDrive.js';


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
const miniaturaDoDrive = async (request: Request, userId: string): Promise<Response> => {
  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { workspaceId, fileId } = corpo || {};
  if (!textoValido(workspaceId, 64) || !textoValido(fileId, 200)) {
    return json({ error: 'Agência ou arquivo não informado.' }, 400);
  }

  const membro = await papelNaAgencia(request, workspaceId, userId);
  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);

  if (!r2Configurado()) {
    return json({ error: 'Armazenamento não configurado.', code: 'NOT_CONFIGURED' }, 503);
  }

  const { id, segredo } = credenciaisDoGoogle();
  if (!id || !segredo) {
    return json({ error: 'Google Drive não configurado no servidor.' }, 503);
  }

  const supabase = clienteDeServico();
  if (!supabase) return json({ error: 'Credenciais não configuradas.' }, 503);

  const { data: credencial } = await supabase
    .from('drive_credenciais')
    .select('refresh_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!credencial?.refresh_token) {
    return json({ error: 'Esta agência não tem Google Drive conectado.' }, 409);
  }

  try {
    const { acesso } = await renovarAcesso(credencial.refresh_token, id, segredo);

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
