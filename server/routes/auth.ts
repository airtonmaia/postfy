import { Router } from 'express';
import {
  authenticate,
  createAccount,
  clearSession,
  issueSession,
  readSessionUser,
  toPublicUser,
  requireAuth,
  requireRole,
  listWorkspaceUsers,
  listInvites,
  createInvite,
  revokeInvite,
  findValidInvite,
  acceptInvite,
  getWorkspace,
  Role,
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


// ============================================================
// Equipe e convites
// ============================================================

const PAPEIS_VALIDOS: Role[] = [
  'owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter', 'financial', 'client',
];

/** Membros da agência da sessão. */
authRouter.get('/users', requireAuth, async (req, res) => {
  try {
    return res.json({ users: await listWorkspaceUsers(req.user!.workspaceId) });
  } catch (error) {
    return failSafely(res, 'auth/users', error);
  }
});

authRouter.get('/invites', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const invites = await listInvites(req.user!.workspaceId);
    // O token é o segredo do convite: só volta junto do link recém-criado.
    return res.json({
      invites: invites.map(({ token, ...resto }) => resto),
    });
  } catch (error) {
    return failSafely(res, 'auth/invites/list', error);
  }
});

authRouter.post('/invites', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { email, name, role } = req.body || {};

    if (!isNonEmptyString(email, 200) || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!PAPEIS_VALIDOS.includes(role)) {
      return res.status(400).json({ error: 'Papel inválido.' });
    }

    const invite = await createInvite({
      workspaceId: req.user!.workspaceId,
      email,
      name,
      role,
      createdBy: req.user!.id,
    });

    const { token, ...semToken } = invite;
    return res.status(201).json({ invite: semToken, token });
  } catch (error: any) {
    if (error?.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'Este e-mail já possui conta nesta plataforma.' });
    }
    return failSafely(res, 'auth/invites/create', error);
  }
});

authRouter.delete('/invites/:id', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const removido = await revokeInvite(req.user!.workspaceId, req.params.id);
    if (!removido) return res.status(404).json({ error: 'Convite não encontrado.' });
    return res.json({ ok: true });
  } catch (error) {
    return failSafely(res, 'auth/invites/revoke', error);
  }
});

/** Consulta pública do convite, para a tela de aceite. */
authRouter.get('/invites/token/:token', async (req, res) => {
  try {
    const invite = await findValidInvite(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado.' });

    const workspace = await getWorkspace(invite.workspaceId);
    return res.json({
      email: invite.email,
      name: invite.name || null,
      role: invite.role,
      agencyName: workspace?.name || null,
    });
  } catch (error) {
    return failSafely(res, 'auth/invites/lookup', error);
  }
});

authRouter.post('/accept-invite', registerLimiter, async (req, res) => {
  try {
    const { token, name, password } = req.body || {};

    if (!isNonEmptyString(token, 200)) {
      return res.status(400).json({ error: 'Convite inválido.' });
    }
    if (!isNonEmptyString(name, 120)) {
      return res.status(400).json({ error: 'Informe seu nome.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    }

    const { user, workspace } = await acceptInvite({ token, name, password });
    issueSession(res, user);
    return res.status(201).json({ user: toPublicUser(user), workspace });
  } catch (error: any) {
    if (error?.code === 'INVITE_INVALID') {
      return res.status(410).json({ error: 'Convite inválido ou expirado.' });
    }
    if (error?.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'Este e-mail já possui conta. Faça login.' });
    }
    return failSafely(res, 'auth/accept-invite', error);
  }
});
