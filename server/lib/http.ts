import type { Request, Response, NextFunction } from 'express';

/** Parser de cookie mínimo — evita mais uma dependência só para isso. */
export const parseCookies = (header?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
};

export const serializeCookie = (
  name: string,
  value: string,
  opts: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string } = {}
): string => {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) segments.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) segments.push('HttpOnly');
  if (opts.secure) segments.push('Secure');
  segments.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  return segments.join('; ');
};

/**
 * Rate limit por janela deslizante, em memória.
 * Suficiente para uma instância; com várias, troque o Map por Redis.
 */
export const createRateLimiter = (opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) => {
  const hits = new Map<string, number[]>();

  // Limpeza periódica para a memória não crescer sem limite.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - opts.windowMs;
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((t) => t > cutoff);
      if (kept.length) hits.set(key, kept);
      else hits.delete(key);
    }
  }, opts.windowMs);
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn ? opts.keyFn(req) : req.ip || 'desconhecido';
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const stamps = (hits.get(key) || []).filter((t) => t > cutoff);

    if (stamps.length >= opts.max) {
      const retryAfter = Math.ceil((stamps[0] + opts.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: opts.message || 'Muitas requisições. Tente novamente em instantes.',
        retryAfter,
      });
    }

    stamps.push(now);
    hits.set(key, stamps);
    next();
  };
};

/** Cabeçalhos de segurança básicos, sem depender de helmet. */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

/**
 * Nunca devolvemos a mensagem crua do provider ao cliente: ela pode carregar
 * detalhe de infraestrutura. Loga completo no servidor, responde genérico.
 */
export const failSafely = (res: Response, scope: string, error: unknown, status = 500) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]`, detail);
  return res.status(status).json({
    error: 'Não foi possível concluir a operação. Tente novamente em instantes.',
  });
};

export const isNonEmptyString = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
