/**
 * Cliente HTTP da API do Orquesia.
 * Sempre com credentials: 'include' porque a sessão vive num cookie httpOnly —
 * o token nunca fica acessível ao JavaScript, o que fecha a porta para XSS
 * roubar a sessão.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique sua conexão.', 0);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    throw new ApiError(
      payload?.error || `Falha na requisição (${response.status}).`,
      response.status,
      payload?.code
    );
  }

  return payload as T;
};

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  workspaceId: string;
}

export interface ApiWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface SessionPayload {
  user: ApiUser;
  workspace: ApiWorkspace | null;
}

export const authApi = {
  register: (input: { name: string; email: string; password: string; agencyName?: string }) =>
    request<SessionPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<SessionPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  /** Retorna null quando não há sessão, em vez de estourar. */
  me: async (): Promise<SessionPayload | null> => {
    try {
      return await request<SessionPayload>('/api/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
};

export interface TeamInvite {
  id: string;
  workspaceId: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export const teamApi = {
  listUsers: () => request<{ users: ApiUser[] }>('/api/auth/users'),

  listInvites: () => request<{ invites: TeamInvite[] }>('/api/auth/invites'),

  createInvite: (input: { email: string; name?: string; role: string }) =>
    request<{ invite: TeamInvite; token: string }>('/api/auth/invites', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  revokeInvite: (id: string) =>
    request<{ ok: boolean }>(`/api/auth/invites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  lookupInvite: (token: string) =>
    request<{ email: string; name: string | null; role: string; agencyName: string | null }>(
      `/api/auth/invites/token/${encodeURIComponent(token)}`
    ),

  acceptInvite: (input: { token: string; name: string; password: string }) =>
    request<SessionPayload>('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const dataApi = {
  fetchAll: () =>
    request<{ workspaceId: string; collections: Record<string, any[]> }>('/api/data'),

  pushCollection: (collection: string, rows: unknown[]) =>
    request<{ ok: boolean; count: number }>(`/api/data/${collection}`, {
      method: 'PUT',
      body: JSON.stringify({ rows }),
    }),
};

export const webhookApi = {
  test: (url: string, event?: string) =>
    request<{ ok: boolean; status?: number; statusText?: string }>('/api/webhooks/test', {
      method: 'POST',
      body: JSON.stringify({ url, event }),
    }),
};

export const aiApi = {
  generateCopy: (params: Record<string, unknown>) =>
    request<any>('/api/gemini/generate-copy', { method: 'POST', body: JSON.stringify(params) }),

  convertFeedback: (params: Record<string, unknown>) =>
    request<any>('/api/gemini/convert-feedback', { method: 'POST', body: JSON.stringify(params) }),

  editorialIdeas: (params: Record<string, unknown>) =>
    request<any>('/api/gemini/editorial-ideas', { method: 'POST', body: JSON.stringify(params) }),
};
