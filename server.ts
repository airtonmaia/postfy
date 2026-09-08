import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { initAuth, requireAuth } from './server/lib/auth';
import { authRouter } from './server/routes/auth';
import { dataRouter } from './server/routes/data';
import { geminiRouter, isGeminiConfigured } from './server/routes/gemini';
import { createRateLimiter, failSafely, securityHeaders, isNonEmptyString } from './server/lib/http';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Necessário para que req.ip seja o IP real atrás de um proxy/CDN,
// senão o rate limit trata o mundo inteiro como um cliente só.
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(express.json({ limit: '2mb' }));

// ==========================================
// Rotas de API
// ==========================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    ai: isGeminiConfigured() ? 'configurada' : 'não configurada',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/gemini', geminiRouter);

/**
 * Disparo real de webhook. Roda no servidor para não esbarrar em CORS e para
 * que o resultado exibido na tela seja o status HTTP de verdade.
 */
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyFn: (req) => req.user?.id || req.ip || 'anon',
  message: 'Muitos disparos de teste. Aguarde um minuto.',
});

app.post('/api/webhooks/test', requireAuth, webhookLimiter, async (req, res) => {
  try {
    const { url, event } = req.body || {};
    if (!isNonEmptyString(url, 2000)) {
      return res.status(400).json({ error: 'Informe a URL do webhook.' });
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return res.status(400).json({ error: 'URL inválida.' });
    }
    if (!['http:', 'https:'].includes(target.protocol)) {
      return res.status(400).json({ error: 'Use uma URL http ou https.' });
    }

    const payload = {
      event: isNonEmptyString(event, 100) ? event : 'test.ping',
      workspaceId: req.user!.workspaceId,
      sentAt: new Date().toISOString(),
      data: { message: 'Disparo de teste do Orquesia.' },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(target.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Orquesia-Webhook/1.0' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      return res.json({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });
    } catch (err: any) {
      const aborted = err?.name === 'AbortError';
      return res.status(502).json({
        ok: false,
        error: aborted
          ? 'O endpoint não respondeu em 8 segundos.'
          : 'Não foi possível alcançar o endpoint informado.',
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return failSafely(res, 'webhooks/test', error);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));

// ==========================================
// Frontend (Vite em dev, estáticos em produção)
// ==========================================

async function startServer() {
  await initAuth();

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Resolvido a partir do próprio bundle, e não de process.cwd(): assim o
    // servidor funciona independentemente do diretório de onde foi iniciado.
    const distPath = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Orquesia] Rodando em http://0.0.0.0:${PORT} (${isProduction ? 'produção' : 'desenvolvimento'})`);
    if (!isGeminiConfigured()) {
      console.log('[Orquesia] GEMINI_API_KEY ausente — os recursos de IA ficam desabilitados.');
    }
  });
}

startServer().catch((err) => {
  console.error('[Orquesia] Falha ao iniciar o servidor:', err);
  process.exit(1);
});
