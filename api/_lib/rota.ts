import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/**
 * Adaptador entre a assinatura Web e a do Node.
 *
 * Nossas rotas são escritas com `Request`/`Response`, que é o formato bom de
 * testar: dá para chamar o handler direto com um Request e conferir a
 * resposta, sem simular objetos do Node.
 *
 * O problema é como a Vercel decide qual assinatura o arquivo usa. Ela
 * inspeciona o formato do export, e essa regra **mudou entre versões do
 * builder**:
 *
 *   - `export default` com assinatura Web  → tratado como handler do Node,
 *     chamado com (req, res). O `request.headers.get(...)` estoura e a função
 *     morre antes de responder. Foi o bug que derrubou as quatro rotas
 *     originais por semanas.
 *   - `export const POST` sem default → reconhecido como Web pelos builders
 *     novos, e ignorado pelos antigos, que procuram só o default. Aí não há
 *     handler algum e a função crasha de novo.
 *
 * Nenhuma das duas formas é segura sozinha, porque a versão do builder na
 * nuvem não é a que está no package.json — não temos como fixá-la.
 *
 * Este adaptador sai desse jogo: a rota exporta um handler `(req, res)`
 * clássico, que **toda** versão entende, e por dentro continua sendo
 * `Request`/`Response`. A detecção deixa de importar.
 */

type HandlerWeb = (request: Request) => Promise<Response>;

const SEM_CORPO = new Set(['GET', 'HEAD']);

/** Monta um Request da Web a partir do IncomingMessage do Node. */
const requisicaoDoNode = (req: IncomingMessage): Request => {
  const protocolo = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `${protocolo}://${host}`);

  const metodo = (req.method || 'GET').toUpperCase();

  const init: RequestInit & { duplex?: string } = {
    method: metodo,
    headers: req.headers as unknown as HeadersInit,
  };

  // Passar body em GET/HEAD é erro de construção do Request, não detalhe.
  if (!SEM_CORPO.has(metodo)) {
    const corpo = corpoDaRequisicao(req);
    if (corpo !== undefined) {
      init.body = corpo;
    } else {
      init.body = Readable.toWeb(req) as unknown as BodyInit;
      init.duplex = 'half';
    }
  }

  return new Request(url, init as RequestInit);
};

/**
 * O corpo, quando o runtime já o consumiu.
 *
 * A Vercel entrega handlers `(req, res)` com o corpo **já lido e parseado** em
 * `req.body`. O stream, nesse ponto, está esgotado: montar o Request a partir
 * dele produz um corpo que nunca termina, e `request.json()` fica esperando
 * para sempre. A função não responde, não estoura, não gera erro — o
 * navegador simplesmente segura a requisição.
 *
 * Foi assim que o upload ficou parado em 0%. As rotas GET funcionavam porque
 * não têm corpo para ler, o que escondeu o problema.
 *
 * Devolve `undefined` quando não há nada pronto, para o chamador cair no
 * stream — que é o caminho certo em runtimes que não pré-parseiam.
 */
const corpoDaRequisicao = (req: IncomingMessage): string | Buffer | undefined => {
  const bruto = (req as IncomingMessage & { body?: unknown }).body;

  if (bruto === undefined || bruto === null) {
    // Sem corpo pronto e stream já encerrado: ler dele travaria. Corpo vazio
    // faz a rota responder 400 "JSON inválido", que é ruim mas é uma
    // resposta — melhor que pendurar a conexão.
    return req.readableEnded ? '' : undefined;
  }

  if (typeof bruto === 'string' || Buffer.isBuffer(bruto)) return bruto;

  // Objeto já parseado: volta para texto, porque quem lê do outro lado é
  // `request.json()`.
  try {
    return JSON.stringify(bruto);
  } catch {
    return '';
  }
};

/** Escreve a Response da Web no ServerResponse do Node. */
const responder = async (res: ServerResponse, resposta: Response): Promise<void> => {
  res.statusCode = resposta.status;
  resposta.headers.forEach((valor, chave) => res.setHeader(chave, valor));

  if (resposta.body) {
    for await (const pedaco of resposta.body as unknown as AsyncIterable<Uint8Array>) {
      res.write(pedaco);
    }
  }
  res.end();
};

export const rota = (handler: HandlerWeb) =>
  async function (req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await responder(res, await handler(requisicaoDoNode(req)));
    } catch (erro) {
      // Um throw aqui vira FUNCTION_INVOCATION_FAILED: 500 sem corpo, sem
      // pista nenhuma para quem está do outro lado. Melhor responder feio do
      // que não responder.
      console.error('[rota] falha não tratada', erro instanceof Error ? erro.stack : erro);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify({ error: 'Erro interno na função.' }));
    }
  };
