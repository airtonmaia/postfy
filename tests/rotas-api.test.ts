import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import * as gemini from '../api/gemini';
import * as uploadUrl from '../api/upload-url';
import * as sendInvite from '../api/send-invite';
import * as webhookTest from '../api/webhook-test';
import * as status from '../api/status';
import * as sendEmail from '../api/send-email';
import * as socialConnect from '../api/social-connect';
import * as publicar from '../api/publicar';
import * as ping from '../api/ping';

/**
 * Formato do export das funções serverless.
 *
 * Este arquivo já protegeu a regra errada. Vale registrar a história, porque
 * ela é o motivo de o contrato atual ser o que é:
 *
 * 1. As rotas usavam `export default` com assinatura Web. O builder da Vercel
 *    tratou como handler clássico do Node e chamou com (req, res);
 *    `request.headers.get(...)` estourou num IncomingMessage e a função morreu
 *    antes de responder — 500 sem corpo. Quatro rotas ficaram assim por
 *    semanas.
 *
 * 2. A correção trocou para `export const POST`, sem default, porque é assim
 *    que o builder **instalado aqui** reconhece a assinatura Web. Só que a
 *    versão do builder que roda na nuvem não é a do package.json, e não dá
 *    para fixá-la: numa versão que procura só o default, não há handler algum
 *    e a função crasha de novo, com a mesma cara.
 *
 * O contrato atual não depende de detecção: a rota exporta um handler
 * `(req, res)` clássico — que toda versão entende — e por dentro continua
 * Request/Response. É o adaptador em api/_lib/rota.ts.
 *
 * Por isso o teste que importa agora não é o formato do export: é **chamar o
 * default como a Vercel chama e exigir que ele escreva uma resposta**.
 */

const rotas = {
  'api/gemini.ts': gemini,
  'api/upload-url.ts': uploadUrl,
  'api/send-invite.ts': sendInvite,
  'api/webhook-test.ts': webhookTest,
  'api/status.ts': status,
  'api/send-email.ts': sendEmail,
  'api/social-connect.ts': socialConnect,
  'api/publicar.ts': publicar,
} as Record<string, Record<string, unknown>>;

/** Mínimo de IncomingMessage/ServerResponse que o adaptador consome. */
const chamarComoAVercel = async (
  modulo: Record<string, unknown>,
  metodo = 'POST',
  cabecalhos: Record<string, string> = {}
) => {
  const req: any = {
    method: metodo,
    url: '/api/teste',
    headers: { host: 'app.orquesia.com.br', ...cabecalhos },
    // O adaptador só lê o corpo fora de GET/HEAD.
    [Symbol.asyncIterator]: async function* () {},
  };

  const escrito: string[] = [];
  const res: any = {
    statusCode: 0,
    headersSent: false,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    write(pedaco: any) {
      escrito.push(Buffer.from(pedaco).toString());
    },
    end(pedaco?: any) {
      if (pedaco) escrito.push(Buffer.from(pedaco).toString());
      this.finalizado = true;
    },
    finalizado: false,
  };

  const handler = modulo.default as (req: any, res: any) => Promise<void>;
  await handler(req, res);
  return { res, corpo: escrito.join('') };
};

describe('a Vercel consegue invocar cada rota', () => {
  for (const [nome, modulo] of Object.entries(rotas)) {
    it(`${nome} exporta um handler (req, res)`, () => {
      // Toda versão do builder sabe chamar isto. É o ponto da correção.
      expect(typeof modulo.default).toBe('function');
    });

    /**
     * O teste central. Um handler que não escreve resposta nenhuma produz
     * FUNCTION_INVOCATION_FAILED em produção — 500 sem corpo, sem pista.
     * Era exatamente o sintoma das duas vezes em que isso quebrou.
     */
    it(`${nome} responde quando chamada como a Vercel chama`, async () => {
      const { res } = await chamarComoAVercel(modulo);
      expect(res.finalizado, 'a função terminou sem responder').toBe(true);
      expect(res.statusCode).toBeGreaterThanOrEqual(200);
      expect(res.statusCode).toBeLessThan(600);
    });

    it(`${nome} não estoura com GET`, async () => {
      const { res } = await chamarComoAVercel(modulo, 'GET');
      expect(res.finalizado).toBe(true);
    });
  }
});

/**
 * A sonda existe para dividir o problema quando tudo falha em produção.
 * Se ela deixar de responder aqui, deixou de servir para isso.
 */
describe('sonda /api/ping', () => {
  it('responde 200 sem depender de nada', async () => {
    const { res, corpo } = await chamarComoAVercel(ping, 'GET');
    expect(res.finalizado).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(corpo)).toHaveProperty('ok', true);
  });

  it('não importa nada em tempo de execução', () => {
    // Um import aqui derrota o propósito: a sonda passaria a poder falhar
    // pelo mesmo motivo que as rotas de verdade.
    const fonte = readFileSync('api/ping.ts', 'utf-8');
    const imports: string[] = fonte.match(/^import .*/gm) ?? [];
    expect(imports.every((l) => l.startsWith('import type'))).toBe(true);
  });
});

describe('sem sessão, resposta é 401 em JSON', () => {
  // publicar não usa sessão: é chamada pelo agendador, que não tem usuário.
  const comSessao = Object.fromEntries(
    Object.entries(rotas).filter(([nome]) => nome !== 'api/publicar.ts')
  );

  for (const [nome, modulo] of Object.entries(comSessao)) {
    it(`${nome} devolve 401 sem token`, async () => {
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

describe('o publicador não pode ficar aberto', () => {
  const semSegredo = async (cabecalhos: Record<string, string> = {}) => {
    const { res, corpo } = await chamarComoAVercel(publicar, 'GET', cabecalhos);
    return { status: res.statusCode, corpo };
  };

  it('recusa chamada sem o segredo do cron', async () => {
    const anterior = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect((await semSegredo()).status).toBe(401);
    } finally {
      if (anterior !== undefined) process.env.CRON_SECRET = anterior;
    }
  });

  it('recusa segredo errado', async () => {
    const anterior = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'o-certo';
    try {
      const { status } = await semSegredo({ authorization: 'Bearer o-errado' });
      expect(status).toBe(401);
    } finally {
      if (anterior === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = anterior;
    }
  });
});
