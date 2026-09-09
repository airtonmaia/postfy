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
    init.body = Readable.toWeb(req) as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init as RequestInit);
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
