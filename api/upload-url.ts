import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth';

export const config = { runtime: 'nodejs' };

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

const configurado = () =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );

const cliente = () =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

/** Nome de arquivo seguro: sem caminho, sem caractere de controle. */
const nomeSeguro = (nome: string): string =>
  nome
    .split(/[\\/]/).pop()!
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .slice(-120) || 'arquivo';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (!configurado()) {
    return json(
      {
        error:
          'Armazenamento de arquivos não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET.',
        code: 'STORAGE_NOT_CONFIGURED',
      },
      503
    );
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
    // O usuário diz em qual agência quer gravar, então confirmamos que ele
    // pertence a ela — a consulta passa pela RLS, como qualquer outra.
    const supabase = clienteDoUsuario(request);
    const { data: membro, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (error) return falharComSeguranca('upload/membership', error, 500);
    if (!membro) {
      return json({ error: 'Você não pertence a esta agência.' }, 403);
    }
    if (membro.role === 'client') {
      return json({ error: 'Seu perfil não pode enviar arquivos.' }, 403);
    }

    // Prefixo por agência: mantém os arquivos separados e evita colisão.
    const chave = `${workspaceId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(fileName)}`;

    const urlDeUpload = await getSignedUrl(
      cliente(),
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
