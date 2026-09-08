import { Router } from 'express';
import {
  authenticate,
  createAccount,
  clearSession,
  issueSession,
  readSessionUser,
  toPublicUser,
} from '../lib/auth';
import { createRateLimiter, failSafely, isNonEmptyString } from '../lib/http';
import { readJson } from '../lib/store';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Freio de força bruta: por IP e por e-mail alvo. */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar de novo.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas contas criadas a partir deste endereço. Tente novamente mais tarde.',
});

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, agencyName } = req.body || {};

    if (!isNonEmptyString(name, 120)) {
      return res.status(400).json({ error: 'Informe seu nome.' });
    }
    if (!isNonEmptyString(email, 200) || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    }

    const { user, workspace } = await createAccount({ name, email, password, agencyName });
    issueSession(res, user);
    return res.status(201).json({ user: toPublicUser(user), workspace });
  } catch (error: any) {
    if (error?.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'Este e-mail já possui cadastro. Faça login.' });
    }
    return failSafely(res, 'auth/register', error);
  }
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email, 200) || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const user = await authenticate(email, password);
    if (!user) {
      // Mensagem única para não revelar se o e-mail existe.
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    issueSession(res, user);
    const workspaces = await readJson<any[]>('workspaces', []);
    const workspace = workspaces.find((w) => w.id === user.workspaceId) || null;
    return res.json({ user: toPublicUser(user), workspace });
  } catch (error) {
    return failSafely(res, 'auth/login', error);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  return res.json({ ok: true });
});

authRouter.get('/me', async (req, res) => {
  try {
    const user = await readSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const workspaces = await readJson<any[]>('workspaces', []);
    const workspace = workspaces.find((w) => w.id === user.workspaceId) || null;
    return res.json({ user: toPublicUser(user), workspace });
  } catch (error) {
    return failSafely(res, 'auth/me', error);
  }
});

/** Diz ao frontend se já existe autenticação de verdade disponível. */
authRouter.get('/status', async (_req, res) => {
  try {
    const users = await readJson<any[]>('users', []);
    return res.json({ enabled: true, hasAccounts: users.length > 0 });
  } catch (error) {
    return failSafely(res, 'auth/status', error);
  }
});
