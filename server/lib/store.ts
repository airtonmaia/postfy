import fs from 'fs/promises';
import path from 'path';

/**
 * Persistência em arquivo JSON. É o caminho usado quando nenhum banco externo
 * está configurado: mantém os dados fora do navegador (ou seja, compartilhados
 * entre os membros da agência) sem exigir infraestrutura.
 *
 * Limitação conhecida e intencional: um único processo. Para rodar com várias
 * instâncias, troque este módulo por Postgres/Supabase mantendo a mesma
 * interface (ver README).
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

let writeChain: Promise<unknown> = Promise.resolve();

const ensureDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const fileFor = (name: string) => {
  if (!/^[a-z0-9_-]+$/i.test(name)) {
    throw new Error(`Nome de coleção inválido: ${name}`);
  }
  return path.join(DATA_DIR, `${name}.json`);
};

export const readJson = async <T>(name: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(fileFor(name), 'utf8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return fallback;
    console.error(`[store] falha ao ler ${name}:`, err?.message);
    return fallback;
  }
};

/**
 * Escrita atômica (tmp + rename) e serializada, para que uma falha no meio do
 * caminho não deixe um JSON truncado no lugar do arquivo bom.
 */
export const writeJson = async (name: string, data: unknown): Promise<void> => {
  const run = async () => {
    await ensureDir();
    const target = fileFor(name);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, target);
  };

  writeChain = writeChain.then(run, run);
  await writeChain;
};

/** Segredo de sessão estável entre reinícios quando não vem do ambiente. */
export const resolveSessionSecret = async (): Promise<string> => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[auth] SESSION_SECRET não definido. Gerando um segredo em disco. ' +
        'Defina SESSION_SECRET no ambiente para que as sessões sobrevivam a um redeploy.'
    );
  }

  const stored = await readJson<{ secret?: string }>('session-secret', {});
  if (stored.secret) return stored.secret;

  const { randomToken } = await import('./crypto');
  const secret = randomToken(48);
  await writeJson('session-secret', { secret });
  return secret;
};
