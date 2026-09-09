import type { IncomingMessage, ServerResponse } from 'node:http';
import { textoValido } from './_lib/auth';

/**
 * Sonda que testa UMA variável: importar de `api/_lib/`.
 *
 * Usa a função mais boba que existe lá, sem tocar em rede nem em segredo. Se
 * esta rota crashar e /api/ping responder, o problema é o arquivo de `_lib`
 * não chegar ao pacote da função — arquivos com prefixo `_` são ignorados
 * como rota, e a dúvida é se continuam sendo incluídos como dependência.
 *
 * Temporária. Sai assim que a causa estiver identificada.
 */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, importou: '_lib/auth', funciona: textoValido('x') }));
}
