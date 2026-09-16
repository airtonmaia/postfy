import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Cliente compartilhado do R2.
 *
 * Existia um `cliente()` local em `upload-url.ts`, e a exclusão de agência
 * precisava do mesmo cliente para apagar arquivo — duas cópias da mesma
 * configuração é o tipo de coisa que diverge sem ninguém notar. Ficou aqui,
 * e `upload-url.ts` passou a importar daqui.
 */

export const r2Configurado = (): boolean =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );

export const clienteR2 = (): S3Client =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

/**
 * Apaga todos os objetos sob um prefixo. Devolve quantos apagou.
 *
 * Usado na exclusão de agência: cada arquivo enviado por `arquivosApi.enviar`
 * grava sob `${workspaceId}/...`, então o prefixo é a agência inteira.
 *
 * Sem R2 configurado devolve 0 sem erro — se nunca esteve configurado, nunca
 * houve upload para deixar rastro (a rota de upload recusa com 503 sem essas
 * variáveis). Mas um erro de verdade na chamada à AWS — rede, credencial,
 * bucket errado — **sobe para quem chamou**, e não é engolido aqui. Esta
 * função é sempre chamada antes de apagar a linha do banco: se o R2 falhar e
 * a exclusão prosseguisse mesmo assim, o arquivo ficaria órfão na nuvem sem
 * nenhuma linha em lugar nenhum apontando para ele — inalcançável até por
 * quem soubesse procurar.
 */
export const apagarPrefixo = async (prefixo: string): Promise<number> => {
  if (!r2Configurado()) return 0;

  const cliente = clienteR2();
  const bucket = process.env.R2_BUCKET!;
  let apagados = 0;
  let continuationToken: string | undefined;

  do {
    const listados = await cliente.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefixo,
        ContinuationToken: continuationToken,
      })
    );

    const chaves = (listados.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => Boolean(key))
      .map((Key) => ({ Key }));

    if (chaves.length > 0) {
      // DeleteObjects aceita até 1000 chaves por chamada, e a listagem já
      // pagina em páginas de até 1000 — cada lote listado cabe numa chamada
      // de exclusão só.
      await cliente.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chaves, Quiet: true },
        })
      );
      apagados += chaves.length;
    }

    continuationToken = listados.IsTruncated
      ? listados.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return apagados;
};


export interface ObjetoDoR2 {
  key: string;
  url: string | null;
  tamanho: number;
  modificadoEm: string | null;
}

/**
 * Lista os objetos de um prefixo, do mais novo para o mais velho.
 *
 * É o que a Biblioteca mostra. Ela lê **o balde**, e não uma tabela de
 * índice, porque índice só conheceria o que foi enviado depois de ele
 * existir — e o acervo de uma agência em uso já está lá. A escolha tem um
 * custo assumido: o balde não sabe de quem é cada arquivo, então a pasta do
 * cliente é derivada do uso, no navegador.
 *
 * `teto` existe porque a resposta da função serverless tem limite e a
 * listagem pagina de mil em mil: sem ele, uma agência com dez mil arquivos
 * montaria um JSON que não cabe na resposta e a rota morreria sem dizer por
 * quê.
 */
export const listarObjetos = async (
  prefixo: string,
  teto = 2000
): Promise<ObjetoDoR2[]> => {
  if (!r2Configurado()) return [];

  const cliente = clienteR2();
  const bucket = process.env.R2_BUCKET!;
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');

  const objetos: ObjetoDoR2[] = [];
  let continuationToken: string | undefined;

  do {
    const listados = await cliente.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefixo,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of listados.Contents || []) {
      if (!obj.Key) continue;
      objetos.push({
        key: obj.Key,
        url: base ? `${base}/${obj.Key}` : null,
        tamanho: obj.Size ?? 0,
        modificadoEm: obj.LastModified?.toISOString() ?? null,
      });
    }

    continuationToken =
      listados.IsTruncated && objetos.length < teto
        ? listados.NextContinuationToken
        : undefined;
  } while (continuationToken);

  // O mais novo primeiro: é o que a pessoa acabou de subir e vai procurar.
  return objetos
    .sort((a, b) => (b.modificadoEm || '').localeCompare(a.modificadoEm || ''))
    .slice(0, teto);
};

/** Apaga um objeto. Diferente de `apagarPrefixo`, que leva a pasta inteira. */
export const apagarObjeto = async (chave: string): Promise<void> => {
  if (!r2Configurado()) return;
  await clienteR2().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: chave })
  );
};
