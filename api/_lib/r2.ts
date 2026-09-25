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
 * Um envio aberto no balde, que pode continuar noutra chamada.
 *
 * **O tempo da função era um teto de tamanho disfarçado.** O envio cabia em
 * uma invocação ou não acontecia: 45 segundos a ~3,5 MB/s dão uns 160 MB, e
 * um vídeo maior que isso falhava *sempre* — tentar de novo repetia o mesmo
 * percurso e parava no mesmo lugar. A mensagem dizia "tente de novo", que
 * era o único conselho que não podia funcionar.
 *
 * Aqui o envio é um estado: o que já subiu fica no balde, e a chamada
 * seguinte retoma do byte onde a anterior parou. O limite deixa de ser o
 * tempo de uma função e passa a ser a paciência de quem espera.
 *
 * O estado viaja pelo navegador e volta, então ele **não é credencial**: a
 * rota reconfere a agência e exige que a chave comece pelo `workspaceId`
 * antes de escrever qualquer byte — sem isso, quem tem uma agência qualquer
 * mandaria a chave de outra e gravaria dentro dela. É a mesma conferência da
 * exclusão na Biblioteca, pelo mesmo motivo.
 */
export interface EnvioEmCurso {
  chave: string;
  uploadId: string;
  partes: { ETag?: string; PartNumber: number }[];
  /**
   * Bytes já fechados em partes — e **só** eles.
   *
   * É deste número que a próxima chamada pede o `Range` ao Google, então ele
   * não pode contar o que ficou na sobra: o pedaço incompleto é descartado ao
   * pausar e vem de novo na chamada seguinte. Isso custa no máximo uma parte
   * de download repetido, e é o que mantém toda parte com o tamanho exato —
   * a regra do R2 que já custou uma entrega inteira.
   */
  copiados: number;
}

export const abrirEnvio = async (chave: string, tipo: string): Promise<EnvioEmCurso> => {
  const inicio = await clienteR2().send(
    new CreateMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET,
      Key: chave,
      ContentType: tipo,
    })
  );
  return { chave, uploadId: inicio.UploadId!, partes: [], copiados: 0 };
};

/**
 * Consome o fluxo enquanto couber no orçamento.
 *
 * Devolve `concluido: true` quando o fluxo terminou — e aí o envio já foi
 * fechado no balde. `false` significa que o orçamento acabou antes, e o
 * envio continua **aberto**, esperando a chamada seguinte com o mesmo estado.
 *
 * **Pausar não aborta**, e é essa a diferença para a versão anterior. O
 * abort só acontece em erro de verdade ou quando alguém desiste: parte
 * enviada e não concluída fica no balde ocupando espaço, invisível na
 * listagem, e a Cloudflare cobra por ela até alguém limpar.
 */
export const continuarEnvio = async (
  envio: EnvioEmCurso,
  corpo: ReadableStream<Uint8Array>,
  /**
   * Quando parar, em milissegundos desde agora.
   *
   * **Sem isto, o arquivo grande demais mata a função sem resposta** — e a
   * tela volta ao silêncio que custou três rodadas de diagnóstico. É o mesmo
   * `ORCAMENTO_MS` do agendador, pela mesma razão: estourar no meio é o pior
   * desfecho, porque não sobra nem o motivo.
   */
  orcamentoMs = 45_000
): Promise<{ concluido: boolean; envio: EnvioEmCurso }> => {
  const comecou = Date.now();
  const cliente = clienteR2();
  const Bucket = process.env.R2_BUCKET;
  const { chave: Key, uploadId: UploadId } = envio;

  const partes = [...envio.partes];
  let copiados = envio.copiados;

  try {
    const leitor = corpo.getReader();
    let sobra = Buffer.alloc(0);

    const enviarParte = async (dados: Buffer) => {
      const numero = partes.length + 1;
      const resposta = await cliente.send(
        new UploadPartCommand({ Bucket, Key, UploadId, PartNumber: numero, Body: dados })
      );
      partes.push({ ETag: resposta.ETag, PartNumber: numero });
      copiados += dados.length;
    };

    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (!value) continue;

      sobra = Buffer.concat([sobra, Buffer.from(value)]);

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

      /*
        A conferência vem **depois** de fechar as partes inteiras, e não
        antes: parando com 8 MB acumulados na mão, esse pedaço seria baixado
        de novo sem precisar. E ela vem depois de ler, não no topo do laço,
        porque é a leitura que demora — é ela que o orçamento mede.
      */
      if (Date.now() - comecou > orcamentoMs) {
        // A sobra morre aqui de propósito: ver `copiados`, acima.
        await leitor.cancel().catch(() => {
          /* O fluxo já pode ter morrido junto com a conexão. */
        });
        return { concluido: false, envio: { ...envio, partes, copiados } };
      }
    }

    // A última parte é o que sobrou, de qualquer tamanho. Arquivo menor que
    // uma parte cai aqui com uma parte só, que é válido.
    if (sobra.length) await enviarParte(sobra);

    await cliente.send(
      new CompleteMultipartUploadCommand({
        Bucket,
        Key,
        UploadId,
        MultipartUpload: { Parts: partes },
      })
    );

    return { concluido: true, envio: { ...envio, partes, copiados } };
  } catch (erro) {
    await abortarEnvio(envio);
    throw erro;
  }
};

/**
 * Desiste do envio e limpa o que já subiu.
 *
 * Não é zelo: parte enviada e não concluída **fica no balde ocupando
 * espaço**, invisível na listagem, e a Cloudflare cobra por ela até alguém
 * limpar. Como o envio agora sobrevive entre chamadas, quem desiste precisa
 * dizer — o balde não tem como saber que ninguém vai voltar.
 */
export const abortarEnvio = async (envio: EnvioEmCurso): Promise<void> => {
  await clienteR2()
    .send(
      new AbortMultipartUploadCommand({
        Bucket: process.env.R2_BUCKET,
        Key: envio.chave,
        UploadId: envio.uploadId,
      })
    )
    .catch(() => {
      /* Já falhou uma vez; não há a quem contar a segunda. */
    });
};
