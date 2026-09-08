import { Router } from 'express';
import { requireAuth, Role } from '../lib/auth';
import { readJson, writeJson } from '../lib/store';
import { createRateLimiter, failSafely } from '../lib/http';
import { mergeWorkspaceRows } from '../../src/lib/workspaceScope';

/**
 * API de dados da aplicação. Cada coleção guarda as linhas de TODOS os
 * workspaces num arquivo só, mas leitura e escrita são sempre recortadas pelo
 * workspace da sessão — é aqui que o isolamento multi-tenant é garantido, no
 * servidor, e não na confiança do que o navegador manda.
 */

export const DATA_COLLECTIONS = [
  'clients',
  'jobs',
  'leads',
  'proposals',
  'contracts',
  'automations',
  'notifications',
  'activityLogs',
  'clientMaterials',
  'timesheetLogs',
  'plans',
  'squads',
  'teamMembers',
] as const;

export type DataCollection = (typeof DATA_COLLECTIONS)[number];

const isCollection = (value: string): value is DataCollection =>
  (DATA_COLLECTIONS as readonly string[]).includes(value);

const fileFor = (collection: DataCollection) => `app-${collection}`;

const MAX_ROWS = 5000;

const writeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyFn: (req) => req.user?.id || req.ip || 'anon',
  message: 'Muitas gravações em sequência. Aguarde um instante.',
});

export const dataRouter = Router();

dataRouter.use(requireAuth);

/** Devolve todas as coleções do workspace da sessão de uma vez. */
dataRouter.get('/', async (req, res) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const payload: Record<string, unknown[]> = {};

    for (const collection of DATA_COLLECTIONS) {
      const all = await readJson<any[]>(fileFor(collection), []);
      // Aqui o recorte é estrito: no servidor não existe registro legado sem
      // dono, então nada sem workspaceId pode vazar para outra agência.
      payload[collection] = all.filter((row) => row?.workspaceId === workspaceId);
    }

    return res.json({ workspaceId, collections: payload });
  } catch (error) {
    return failSafely(res, 'data/readAll', error);
  }
});

/**
 * Papéis autorizados a gravar cada grupo de coleções.
 *
 * Antes a rota exigia só sessão: qualquer papel autenticado, inclusive
 * `client`, podia mandar um PUT com array vazio e apagar toda a coleção da
 * agência. O mapa de permissões da interface não protege a API — quem chama
 * o endpoint direto passa por cima dele.
 */
const PAPEIS_DE_ESCRITA: Record<DataCollection, Role[]> = {
  clients: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  jobs: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  automations: ['owner', 'admin', 'manager'],
  notifications: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  activityLogs: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  clientMaterials: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  timesheetLogs: ['owner', 'admin', 'manager', 'social_media', 'designer', 'copywriter'],
  squads: ['owner', 'admin', 'manager'],
  leads: ['owner', 'admin', 'manager', 'financial'],
  proposals: ['owner', 'admin', 'manager', 'financial'],
  contracts: ['owner', 'admin', 'manager', 'financial'],
  plans: ['owner'],
  teamMembers: ['owner', 'admin'],
};

dataRouter.put('/:collection', writeLimiter, async (req, res) => {
  try {
    const { collection } = req.params;
    if (!isCollection(collection)) {
      return res.status(400).json({ error: 'Coleção desconhecida.' });
    }

    const papel = req.user!.role;
    if (!PAPEIS_DE_ESCRITA[collection].includes(papel)) {
      return res.status(403).json({
        error: 'Seu perfil não tem permissão para alterar estes dados.',
      });
    }

    const rows = req.body?.rows;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Formato inválido: esperado { rows: [] }.' });
    }
    if (rows.length > MAX_ROWS) {
      return res
        .status(413)
        .json({ error: `Coleção acima do limite de ${MAX_ROWS} registros.` });
    }

    const workspaceId = req.user!.workspaceId;
    const all = await readJson<any[]>(fileFor(collection), []);

    // mergeWorkspaceRows carimba o workspace da sessão em toda linha recebida
    // (o cliente não decide em qual tenant escreve) e preserva as linhas das
    // outras agências.
    const atualizado = mergeWorkspaceRows(all, workspaceId, rows);

    await writeJson(fileFor(collection), atualizado);
    return res.json({ ok: true, count: rows.length });
  } catch (error) {
    return failSafely(res, 'data/write', error);
  }
});
