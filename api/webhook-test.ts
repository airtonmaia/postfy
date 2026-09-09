import {
  usuarioDaRequisicao,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth';
import { rota } from './_lib/rota';
import { buscarComProtecao } from './_lib/ssrf';

export const config = { runtime: 'nodejs' };

/**
 * Disparo de teste de webhook.
 *
 * Roda no servidor para não esbarrar em CORS e para devolver o status HTTP
 * real do destino. Toda a proteção contra SSRF está em _lib/ssrf: sem ela,
 * qualquer usuário autenticado usaria esta rota como sonda da rede interna e
 * do endpoint de metadados da nuvem.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (excedeuLimite(`webhook:${usuario.id}`, 10, 60_000)) {
    return json({ error: 'Muitos disparos de teste. Aguarde um minuto.' }, 429);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  if (!textoValido(corpo?.url, 2000)) {
    return json({ error: 'Informe a URL do webhook.' }, 400);
  }

  const controlador = new AbortController();
  const prazo = setTimeout(() => controlador.abort(), 8000);

  try {
    const resposta = await buscarComProtecao(corpo.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Orquesia-Webhook/1.0' },
      body: JSON.stringify({
        event: textoValido(corpo?.event, 100) ? corpo.event : 'test.ping',
        sentAt: new Date().toISOString(),
        data: { message: 'Disparo de teste do Orquesia.' },
      }),
      signal: controlador.signal,
    });

    return json({ ok: resposta.ok, status: resposta.status, statusText: resposta.statusText });
  } catch (erro: any) {
    if (erro?.code === 'DESTINO_BLOQUEADO' || erro?.code === 'MUITOS_REDIRECIONAMENTOS') {
      return json({ ok: false, error: erro.message }, 400);
    }
    if (erro?.name === 'AbortError') {
      return json({ ok: false, error: 'O endpoint não respondeu em 8 segundos.' }, 502);
    }
    return falharComSeguranca('webhook/test', erro, 502);
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * Export nomeado, e sem `export default`, de propósito.
 *
 * O builder da Vercel (@vercel/node) decide a assinatura pelo formato do
 * export: só reconhece handler no padrão Web (Request/Response) quando existe
 * um export nomeado de método (POST/GET/fetch). Com `export default` ele
 * assume o handler clássico do Node e entrega (req, res) — aí
 * `request.headers.get(...)` estoura num IncomingMessage e a função morre
 * antes de responder, devolvendo um 500 sem corpo.
 *
 * Era esse o motivo de nenhuma rota /api ter funcionado em produção.
 * Não troque por default sem reler `unwrapDefaults` no builder.
 */

/**
 * Handler no formato Web, exportado para os testes chamarem direto.
 * O que a Vercel executa é o default abaixo.
 */
export const POST = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
