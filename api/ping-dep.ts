import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

/**
 * Sonda que testa a outra variável: importar a dependência do npm.
 *
 * Não faz requisição nenhuma — só constrói o cliente, o que já exercita o
 * carregamento do módulo. Se esta crashar e /api/ping-lib responder, o
 * problema é o @supabase/supabase-js no runtime da Vercel (Node 24).
 *
 * Temporária. Sai assim que a causa estiver identificada.
 */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const cliente = createClient('https://exemplo.supabase.co', 'chave-de-mentira');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, importou: '@supabase/supabase-js', tipo: typeof cliente.from }));
}
