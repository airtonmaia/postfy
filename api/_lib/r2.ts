import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
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

/**
 * Envia um fluxo para o balde em partes, sem carregá-lo inteiro na memória.
 *
 * **O `PutObject` simples obriga a ter o arquivo todo na mão.** Com um vídeo
 * de 109 MB isso é um `Buffer` de 109 MB dentro de uma função serverless —
 * e foi por isso que a cópia tinha um teto de 100 MB, que é justamente o
 * tamanho de um Reels comum. O teto não era uma decisão de produto; era a
 * memória.
 *
 * Em partes, o pico de memória é o tamanho de uma parte. O arquivo pode ser
 * muito maior que a função.
 *
 * **Sem dependência nova**: o `@aws-sdk/client-s3` já está aqui, e
 * `@aws-sdk/lib-storage` traria um pacote a mais e os dois lockfiles para
 * atualizar — o CI instala com `--frozen-lockfile`, e este projeto já
 * quebrou uma vez exatamente assim.
 *
 * O `abort` no erro não é zelo: parte enviada e não concluída **fica no
 * balde ocupando espaço**, invisível na listagem, e a Cloudflare cobra por
 * ela até alguém limpar.
 */
const TAMANHO_DA_PARTE = 8 * 1024 * 1024;

/**
 * Quando o envio desiste por tempo.
 *
 * Lançar um erro qualquer aqui daria "falha desconhecida" a quem está
 * olhando a tela. O nome existe para a resposta poder dizer o que houve e o
 * que fazer.
 */
export class TempoEsgotadoNoEnvio extends Error {
  constructor(public enviados: number) {
    super('Tempo esgotado no envio.');
    this.name = 'TempoEsgotadoNoEnvio';
  }
}

export const enviarEmPartes = async (
  chave: string,
  corpo: ReadableStream<Uint8Array>,
  tipo: string,
  /**
   * Quando parar, em milissegundos desde o início da função.
   *
   * **Sem isto, o arquivo grande demais mata a função sem resposta** — e a
   * tela volta ao silêncio que custou três rodadas de diagnóstico. É o mesmo
   * `ORCAMENTO_MS` do agendador, pela mesma razão: estourar no meio é o pior
   * desfecho, porque não sobra nem o motivo.
   */
  orcamentoMs = 45_000
): Promise<void> => {
  const comecou = Date.now();
  const cliente = clienteR2();
  const Bucket = process.env.R2_BUCKET;

  const inicio = await cliente.send(
    new CreateMultipartUploadCommand({ Bucket, Key: chave, ContentType: tipo })
  );
  const UploadId = inicio.UploadId;

  try {
    const leitor = corpo.getReader();
    const partes: { ETag?: string; PartNumber: number }[] = [];
    let sobra = Buffer.alloc(0);
    let enviadosAoTodo = 0;
    let numero = 1;

    const enviarParte = async (dados: Buffer) => {
      const resposta = await cliente.send(
        new UploadPartCommand({ Bucket, Key: chave, UploadId, PartNumber: numero, Body: dados })
      );
      partes.push({ ETag: resposta.ETag, PartNumber: numero });
      numero += 1;
      enviadosAoTodo += dados.length;
    };

    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (!value) continue;

      sobra = Buffer.concat([sobra, Buffer.from(value)]);

      if (Date.now() - comecou > orcamentoMs) {
        throw new TempoEsgotadoNoEnvio(enviadosAoTodo + sobra.length);
      }

      /**
       * **Partes de tamanho exato, e não "pelo menos tanto".**
       *
       * O S3 aceita partes de tamanhos diferentes; o **R2 não**: ele recusa
       * com `All non-trailing parts must have the same length`. A primeira
       * versão mandava o que tivesse acumulado quando passasse do limite —
       * 8,0 MB, depois 8,3, depois 8,1 — e o erro só aparecia no arquivo que
       * tinha mais de uma parte, ou seja, exatamente nos grandes que o envio
       * em partes veio resolver.
       *
       * A sobra fica para a parte seguinte. A última pode ser menor, e é a
       * única que pode.
       */
      while (sobra.length >= TAMANHO_DA_PARTE) {
        await enviarParte(sobra.subarray(0, TAMANHO_DA_PARTE));
        sobra = sobra.subarray(TAMANHO_DA_PARTE);
      }
    }

    // A última parte é o que sobrou, de qualquer tamanho. Arquivo menor que
    // uma parte cai aqui com uma parte só, que é válido.
    if (sobra.length) await enviarParte(sobra);

    await cliente.send(
      new CompleteMultipartUploadCommand({
        Bucket,
        Key: chave,
        UploadId,
        MultipartUpload: { Parts: partes },
      })
    );
  } catch (erro) {
    await cliente
      .send(new AbortMultipartUploadCommand({ Bucket, Key: chave, UploadId }))
      .catch(() => {
        /* Já falhou uma vez; não há a quem contar a segunda. */
      });
    throw erro;
  }
};
