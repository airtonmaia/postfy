import type { Request, Response, NextFunction } from 'express';
import { hashPassword, verifyPassword, signSession, verifySession, randomToken } from './crypto';
import { readJson, writeJson, resolveSessionSecret } from './store';
import { parseCookies, serializeCookie } from './http';

export type Role =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'social_media'
  | 'designer'
  | 'copywriter'
  | 'financial'
  | 'client';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  workspaceId: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  workspaceId: string;
}

export interface StoredWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export const SESSION_COOKIE = 'orquesia_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

let sessionSecret = '';

export const initAuth = async () => {
  sessionSecret = await resolveSessionSecret();
  await bootstrapAdminFromEnv();
};

export const toPublicUser = (user: StoredUser): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  workspaceId: user.workspaceId,
});

const readUsers = () => readJson<StoredUser[]>('users', []);
const readWorkspaces = () => readJson<StoredWorkspace[]>('workspaces', []);

export const findUserByEmail = async (email: string): Promise<StoredUser | undefined> => {
  const users = await readUsers();
  const needle = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === needle);
};

export const findUserById = async (id: string): Promise<StoredUser | undefined> => {
  const users = await readUsers();
  return users.find((u) => u.id === id);
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'agencia';

export const createAccount = async (input: {
  name: string;
  email: string;
  password: string;
  agencyName?: string;
  role?: Role;
  /** Quando informado, entra numa agência existente em vez de criar uma nova. */
  joinWorkspaceId?: string;
}): Promise<{ user: StoredUser; workspace: StoredWorkspace }> => {
  const users = await readUsers();
  const workspaces = await readWorkspaces();

  const email = input.email.trim().toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw Object.assign(new Error('E-mail já cadastrado'), { code: 'EMAIL_TAKEN' });
  }

  const { hash, salt } = await hashPassword(input.password);
  const userId = `u-${randomToken(8)}`;

  let workspace: StoredWorkspace | undefined;
  let workspacesAtualizados = workspaces;

  if (input.joinWorkspaceId) {
    workspace = workspaces.find((w) => w.id === input.joinWorkspaceId);
    if (!workspace) {
      throw Object.assign(new Error('Agência não encontrada'), { code: 'WORKSPACE_NOT_FOUND' });
    }
  } else {
    const agencyName = (input.agencyName || `Agência de ${input.name}`).trim();
    workspace = {
      id: `ws-${randomToken(8)}`,
      name: agencyName,
      slug: slugify(agencyName),
      ownerId: userId,
      createdAt: new Date().toISOString(),
    };
    workspacesAtualizados = [...workspaces, workspace];
  }

  const user: StoredUser = {
    id: userId,
    name: input.name.trim(),
    email,
    avatar: '',
    role: input.role || 'owner',
    workspaceId: workspace.id,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  if (workspacesAtualizados !== workspaces) {
    await writeJson('workspaces', workspacesAtualizados);
  }
  await writeJson('users', [...users, user]);

  return { user, workspace };
};

// ============================================================
// Convites de equipe
// ============================================================
// Convite por link: o dono gera o link e compartilha pelo canal que preferir.
// Assim a equipe entra de verdade sem depender de um provedor de e-mail.

export interface StoredInvite {
  id: string;
  token: string;
  workspaceId: string;
  email: string;
  name?: string;
  role: Role;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

const readInvites = () => readJson<StoredInvite[]>('invites', []);

export const listWorkspaceUsers = async (workspaceId: string): Promise<PublicUser[]> => {
  const users = await readUsers();
  return users.filter((u) => u.workspaceId === workspaceId).map(toPublicUser);
};

export const listInvites = async (workspaceId: string): Promise<StoredInvite[]> => {
  const invites = await readInvites();
  const agora = Date.now();
  return invites.filter(
    (i) => i.workspaceId === workspaceId && !i.acceptedAt && new Date(i.expiresAt).getTime() > agora
  );
};

export const createInvite = async (input: {
  workspaceId: string;
  email: string;
  name?: string;
  role: Role;
  createdBy: string;
}): Promise<StoredInvite> => {
  const email = input.email.trim().toLowerCase();

  const users = await readUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw Object.assign(new Error('Este e-mail já tem conta'), { code: 'EMAIL_TAKEN' });
  }

  const invites = await readInvites();
  const agora = Date.now();

  // Substitui um convite pendente para o mesmo e-mail em vez de acumular.
  const restantes = invites.filter(
    (i) => !(i.workspaceId === input.workspaceId && i.email === email && !i.acceptedAt)
  );

  const invite: StoredInvite = {
    id: `inv-${randomToken(6)}`,
    token: randomToken(24),
    workspaceId: input.workspaceId,
    email,
    name: input.name?.trim() || undefined,
    role: input.role,
    createdBy: input.createdBy,
    createdAt: new Date(agora).toISOString(),
    expiresAt: new Date(agora + INVITE_TTL_MS).toISOString(),
  };

  await writeJson('invites', [...restantes, invite]);
  return invite;
};

export const revokeInvite = async (workspaceId: string, id: string): Promise<boolean> => {
  const invites = await readInvites();
  const restantes = invites.filter((i) => !(i.id === id && i.workspaceId === workspaceId));
  if (restantes.length === invites.length) return false;
  await writeJson('invites', restantes);
  return true;
};

export const findValidInvite = async (token: string): Promise<StoredInvite | null> => {
  if (!token) return null;
  const invites = await readInvites();
  const invite = invites.find((i) => i.token === token);
  if (!invite || invite.acceptedAt) return null;
  if (new Date(invite.expiresAt).getTime() < Date.now()) return null;
  return invite;
};

export const acceptInvite = async (input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ user: StoredUser; workspace: StoredWorkspace }> => {
  const invite = await findValidInvite(input.token);
  if (!invite) {
    throw Object.assign(new Error('Convite inválido ou expirado'), { code: 'INVITE_INVALID' });
  }

  const resultado = await createAccount({
    name: input.name,
    email: invite.email,
    password: input.password,
    role: invite.role,
    joinWorkspaceId: invite.workspaceId,
  });

  const invites = await readInvites();
  await writeJson(
    'invites',
    invites.map((i) =>
      i.id === invite.id ? { ...i, acceptedAt: new Date().toISOString() } : i
    )
  );

  return resultado;
};

export const getWorkspace = async (id: string): Promise<StoredWorkspace | undefined> => {
  const workspaces = await readWorkspaces();
  return workspaces.find((w) => w.id === id);
};

export const authenticate = async (
  email: string,
  password: string
): Promise<StoredUser | null> => {
  const user = await findUserByEmail(email);
  if (!user) {
    // Gasta o mesmo tempo de um hash real para não revelar,
    // pela latência, se o e-mail existe.
    await hashPassword(password);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  return ok ? user : null;
};

export const issueSession = (res: Response, user: StoredUser) => {
  const token = signSession(
    { sub: user.id, email: user.email, exp: Date.now() + SESSION_TTL_MS },
    sessionSecret
  );
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    })
  );
};

export const clearSession = (res: Response) => {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    })
  );
};

export const readSessionUser = async (req: Request): Promise<StoredUser | null> => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySession<{ sub?: string }>(token, sessionSecret);
  if (!payload?.sub) return null;
  return (await findUserById(payload.sub)) || null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: StoredUser;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const user = await readSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada ou inexistente. Faça login novamente.' });
  }
  req.user = user;
  next();
};

/** Restringe uma rota a papéis específicos. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Seu perfil não tem permissão para esta ação.' });
    }
    next();
  };

/**
 * Cria o primeiro dono a partir do ambiente, para que um deploy novo tenha
 * como entrar sem depender de cadastro aberto.
 */
const bootstrapAdminFromEnv = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await findUserByEmail(email);
  if (existing) return;

  if (password.length < 8) {
    console.warn('[auth] ADMIN_PASSWORD tem menos de 8 caracteres. Usuário inicial não criado.');
    return;
  }

  await createAccount({
    name: process.env.ADMIN_NAME || 'Administrador',
    email,
    password,
    agencyName: process.env.ADMIN_AGENCY || 'Minha Agência',
    role: 'owner',
  });
  console.log(`[auth] Usuário inicial criado para ${email}.`);
};
