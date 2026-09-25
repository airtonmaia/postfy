import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * O envio em partes, exercitado de verdade.
 *
 * **Uma guarda de fonte não pegaria este defeito.** O código "mandava a
 * parte quando passasse do tamanho", que lido parece certo — e produzia
 * pedaços de 8,0 MB, depois 8,3, depois 8,1, porque cada leitura do fluxo
 * traz o que traz. O S3 aceita isso; o **R2 recusa**, com
 * `All non-trailing parts must have the same length`.
 *
 * E o erro só aparece em arquivo com mais de uma parte: exatamente os
 * grandes, que são os que o envio em partes veio atender. O arquivo pequeno
 * de teste passava.
 *
 * Por isso o teste é sobre os **bytes que saem**, com o cliente do R2
 * trocado por um que anota o que recebeu.
 */

const enviadas: { numero: number; tamanho: number }[] = [];
let concluido = false;
let abortado = false;

vi.mock('@aws-sdk/client-s3', () => {
  class Comando {
    constructor(public input: any) {}
  }
  class CreateMultipartUploadCommand extends Comando {}
  class UploadPartCommand extends Comando {}
  class CompleteMultipartUploadCommand extends Comando {}
  class AbortMultipartUploadCommand extends Comando {}
  class ListObjectsV2Command extends Comando {}
  class DeleteObjectsCommand extends Comando {}
  class DeleteObjectCommand extends Comando {}

  class S3Client {
    async send(comando: any) {
      if (comando instanceof CreateMultipartUploadCommand) return { UploadId: 'upload-1' };
      if (comando instanceof UploadPartCommand) {
        enviadas.push({
          numero: comando.input.PartNumber,
          tamanho: comando.input.Body.length,
        });
        return { ETag: `etag-${comando.input.PartNumber}` };
      }
      if (comando instanceof CompleteMultipartUploadCommand) {
        concluido = true;
        return {};
      }
      if (comando instanceof AbortMultipartUploadCommand) {
        abortado = true;
        return {};
      }
      return {};
    }
  }

  return {
    S3Client,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteObjectCommand,
  };
});

const { abrirEnvio, continuarEnvio } = await import('../api/_lib/r2');

const PARTE = 8 * 1024 * 1024;

/**
 * Um fluxo que entrega pedaços de tamanhos irregulares, como a rede entrega.
 *
 * **A sequência não pode se repetir**, e isso não é capricho: a primeira
 * versão deste teste usava quatro tamanhos em ciclo, e a soma de um ciclo
 * inteiro dava sempre o mesmo número — então até a implementação errada
 * produzia partes idênticas, e o teste aprovava o defeito. Conferido ao
 * contrário foi o que mostrou isso.
 *
 * Os tamanhos saem de um gerador determinístico: irregulares a cada leitura,
 * e os mesmos em toda execução.
 */
const fluxoIrregular = (total: number, base: number): ReadableStream<Uint8Array> => {
  let restante = total;
  let semente = 7;

  return new ReadableStream<Uint8Array>({
    pull(controlador) {
      if (restante <= 0) {
        controlador.close();
        return;
      }
      // Congruente linear simples: basta ser variado e repetível.
      semente = (semente * 1103515245 + 12345) % 2147483648;
      const variacao = semente % base;
      const tamanho = Math.min(base + variacao, restante);
      restante -= tamanho;
      controlador.enqueue(new Uint8Array(tamanho));
    },
  });
};

beforeEach(() => {
  enviadas.length = 0;
  concluido = false;
  abortado = false;
  process.env.R2_ACCOUNT_ID = 'conta';
  process.env.R2_ACCESS_KEY_ID = 'chave';
  process.env.R2_SECRET_ACCESS_KEY = 'segredo';
  process.env.R2_BUCKET = 'balde';
});

/** O caminho de sempre: abre, consome o fluxo inteiro e fecha. */
const enviarDeUmaVez = async (chave: string, fluxo: ReadableStream<Uint8Array>, tipo: string) => {
  const envio = await abrirEnvio(chave, tipo);
  return continuarEnvio(envio, fluxo, 60_000);
};

describe('todas as partes menos a última têm o mesmo tamanho', () => {
  it('um arquivo de 30 MB em pedaços irregulares', async () => {
    // 30 MB não é múltiplo de 8: sobra uma última parte menor, que é a única
    // que pode ser diferente.
    const { concluido: fechou } = await enviarDeUmaVez(
      'ws/video.mp4',
      fluxoIrregular(30 * 1024 * 1024, 900_000),
      'video/mp4'
    );

    expect(fechou).toBe(true);
    expect(concluido).toBe(true);
    expect(enviadas.length).toBeGreaterThan(1);

    const semAUltima = enviadas.slice(0, -1).map((p) => p.tamanho);
    expect(new Set(semAUltima).size, 'partes de tamanhos diferentes — o R2 recusa').toBe(1);

    // E a soma bate: nenhum byte se perdeu no caminho.
    expect(enviadas.reduce((s, p) => s + p.tamanho, 0)).toBe(30 * 1024 * 1024);
  });

  it('a numeração é sequencial a partir de 1', () => {
    expect(enviadas.map((p) => p.numero)).toEqual(enviadas.map((_, i) => i + 1));
  });

  it('arquivo menor que uma parte sai numa parte só', async () => {
    await enviarDeUmaVez('ws/foto.jpg', fluxoIrregular(300_000, 64_000), 'image/jpeg');

    expect(enviadas.length).toBe(1);
    expect(enviadas[0].tamanho).toBe(300_000);
    expect(concluido).toBe(true);
  });

  it('arquivo de tamanho exato não deixa uma parte vazia no fim', async () => {
    /*
      O caso que a implementação anterior errava do outro lado: com o total
      múltiplo do tamanho da parte, uma versão ingênua manda uma parte de
      zero byte no fim — e o R2 recusa parte vazia.
    */
    await enviarDeUmaVez('ws/certo.mp4', fluxoIrregular(16 * 1024 * 1024, 1_100_000), 'video/mp4');

    expect(enviadas.length).toBe(2);
    expect(enviadas.every((p) => p.tamanho > 0)).toBe(true);
  });
});

/**
 * A cópia que continua na chamada seguinte.
 *
 * **O tempo da função era um teto de tamanho disfarçado**: 45 segundos a
 * ~3,5 MB/s dão uns 160 MB, e o vídeo maior que isso falhava *sempre* — a
 * tentativa seguinte refazia o mesmo percurso e parava no mesmo lugar,
 * enquanto a tela mandava "tentar de novo".
 *
 * O que este bloco exercita é o que nenhuma guarda de fonte pegaria: se o
 * ponto de retomada não bater com o que já subiu, o arquivo fica
 * **corrompido com o tamanho certo** — bytes repetidos ou faltando no meio
 * do vídeo, sem erro em lugar nenhum.
 */
describe('o envio continua de onde parou', () => {
  it('pausar não aborta, e para num múltiplo exato da parte', async () => {
    const envio = await abrirEnvio('ws/grande.mp4', 'video/mp4');

    /*
      Pedaços de 9 MB: a primeira leitura já fecha uma parte inteira, e só
      então o orçamento vencido interrompe. Com pedaços menores a pausa
      aconteceria antes da primeira parte, e o teste não diria nada sobre o
      alinhamento — que é justamente o que ele existe para medir.
    */
    const resultado = await continuarEnvio(
      envio,
      fluxoIrregular(40 * 1024 * 1024, 9 * 1024 * 1024),
      -1
    );

    expect(resultado.concluido).toBe(false);
    expect(concluido, 'fechou um envio que não terminou').toBe(false);
    expect(abortado, 'pausar jogou fora o que já tinha subido').toBe(false);

    /*
      O que sobrou da leitura é descartado de propósito: o próximo `Range`
      sai deste número, e um pedaço incompleto contado aqui deslocaria o
      arquivo inteiro a partir da emenda.
    */
    expect(resultado.envio.copiados % PARTE).toBe(0);
    expect(resultado.envio.copiados).toBeGreaterThan(0);
    expect(resultado.envio.copiados).toBe(enviadas.reduce((s, p) => s + p.tamanho, 0));
  });

  it('a segunda chamada fecha o arquivo, sem byte repetido nem faltando', async () => {
    const TOTAL = 40 * 1024 * 1024;

    const envio = await abrirEnvio('ws/grande.mp4', 'video/mp4');
    const primeira = await continuarEnvio(envio, fluxoIrregular(TOTAL, 9 * 1024 * 1024), -1);
    expect(primeira.concluido).toBe(false);

    /*
      O fluxo da segunda chamada é o que o `Range` devolve: **só o que
      falta**. É aqui que um ponto de retomada errado apareceria — o total
      deixaria de fechar com o tamanho do arquivo.
    */
    const restante = TOTAL - primeira.envio.copiados;
    const segunda = await continuarEnvio(
      primeira.envio,
      fluxoIrregular(restante, 1_100_000),
      60_000
    );

    expect(segunda.concluido).toBe(true);
    expect(concluido).toBe(true);
    expect(segunda.envio.copiados).toBe(TOTAL);

    // Nenhum byte a mais nem a menos, somando as duas chamadas.
    expect(enviadas.reduce((s, p) => s + p.tamanho, 0)).toBe(TOTAL);

    // A numeração continua de onde parou: parte repetida sobrescreve a
    // anterior no balde, e o arquivo sai com um buraco no meio.
    expect(enviadas.map((p) => p.numero)).toEqual(enviadas.map((_, i) => i + 1));

    // E a regra do R2 continua valendo **através da emenda**: só a última
    // pode ter tamanho diferente.
    const semAUltima = enviadas.slice(0, -1).map((p) => p.tamanho);
    expect(new Set(semAUltima).size, 'a emenda quebrou o tamanho das partes').toBe(1);
    expect(semAUltima[0]).toBe(PARTE);
  });

  it('erro de verdade aborta e não deixa lixo no balde', async () => {
    const envio = await abrirEnvio('ws/ruim.mp4', 'video/mp4');

    const fluxoQueQuebra = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('a conexão caiu');
      },
    });

    await expect(continuarEnvio(envio, fluxoQueQuebra, 60_000)).rejects.toThrow('a conexão caiu');
    expect(abortado, 'a parte pendente ficou no balde ocupando espaço').toBe(true);
    expect(concluido).toBe(false);
  });
});
