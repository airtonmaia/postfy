import { describe, it, expect } from 'vitest';

import * as gemini from '../api/gemini';
import * as uploadUrl from '../api/upload-url';
import * as sendInvite from '../api/send-invite';
import * as webhookTest from '../api/webhook-test';
import * as status from '../api/status';
import * as sendEmail from '../api/send-email';

/**
 * Formato do export das funções serverless.
 *
 * Nossas rotas usam a assinatura Web (Request/Response). O builder da Vercel
 * decide isso pelo formato do export, e a regra não é óbvia: com
 * `export default` ele assume o handler clássico do Node e chama a função com
 * (req, res). Aí `request.headers.get(...)` estoura num IncomingMessage, a
 * função morre antes de responder e a Vercel devolve um 500 sem corpo JSON.
 *
 * Foi exatamente isso que derrubou as quatro rotas em produção sem aparecer em
 * teste nenhum: cada handler funcionava quando chamado à mão com um Request.
 * O que faltava era verificar como a Vercel vai chamá-lo.
 *
 * A checagem abaixo reproduz `compileUserCode` de @vercel/node.
 */

const METODOS_HTTP = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];

/** Mesma lógica de unwrapDefaults + isWebHandler do builder. */
const detectar = (modulo: Record<string, unknown>): 'web' | 'node-classico' => {
  let alvo: any = modulo;
  for (let i = 0; i < 5; i++) {
    if (alvo && alvo.default) alvo = alvo.default;
    else break;
  }
  const ehWeb =
    METODOS_HTTP.some((m) => typeof alvo[m] === 'function') || typeof alvo.fetch === 'function';
  return ehWeb ? 'web' : 'node-classico';
};

const rotas = {
  'api/gemini.ts': gemini,
  'api/upload-url.ts': uploadUrl,
  'api/send-invite.ts': sendInvite,
  'api/webhook-test.ts': webhookTest,
  'api/status.ts': status,
  'api/send-email.ts': sendEmail,
} as Record<string, Record<string, unknown>>;

describe('formato do export das rotas serverless', () => {
  for (const [nome, modulo] of Object.entries(rotas)) {
    it(`${nome} é reconhecida como handler Web pela Vercel`, () => {
      expect(detectar(modulo)).toBe('web');
    });

    it(`${nome} exporta POST e não exporta default`, () => {
      expect(typeof modulo.POST).toBe('function');
      // Um default reintroduzido faz o builder ignorar o POST: unwrapDefaults
      // desce para dentro do default e perde os exports nomeados.
      expect(modulo.default).toBeUndefined();
    });
  }
});

describe('handler responde a Request de verdade', () => {
  // Sem Authorization, toda rota tem que responder 401 em JSON — nunca
  // estourar. Um throw aqui vira 500 sem corpo em produção.
  for (const [nome, modulo] of Object.entries(rotas)) {
    it(`${nome} devolve 401 em JSON sem token`, async () => {
      const resposta = await (modulo.POST as (r: Request) => Promise<Response>)(
        new Request('https://app.orquesia.com.br/api/teste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      );
      expect(resposta.status).toBe(401);
      expect(resposta.headers.get('content-type')).toContain('application/json');
      await expect(resposta.json()).resolves.toHaveProperty('error');
    });
  }
});
