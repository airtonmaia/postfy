import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Sonda. Não faz parte do produto.
 *
 * Zero imports de runtime, zero dependências, zero lógica. Se as rotas de
 * verdade falharem e esta responder, o problema está no nosso código ou nas
 * bibliotecas que ele carrega. Se esta também falhar, o problema é a
 * plataforma — configuração de build, versão de builder, detecção do
 * diretório `api/` — e não adianta mexer em handler.
 *
 * Vale o arquivo porque `FUNCTION_INVOCATION_FAILED` não diz nada: é 500 sem
 * corpo, sem stack, sem pista. Já custou três ciclos de diagnóstico
 * eliminando hipóteses uma a uma; esta rota divide o problema pela metade em
 * uma requisição.
 */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      node: process.version,
      // Confirma qual commit está de fato servindo, que foi outra dúvida
      // que apareceu no meio do diagnóstico.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'desconhecido',
    })
  );
}
