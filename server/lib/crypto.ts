import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHmac,
} from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Deriva o hash da senha com scrypt. O salt é gerado por usuário e guardado
 * junto do hash — nunca guardamos a senha em texto puro.
 */
export const hashPassword = async (
  password: string
): Promise<{ hash: string; salt: string }> => {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return { hash: derived.toString('hex'), salt };
};

/** Compara em tempo constante para não vazar informação por timing. */
export const verifyPassword = async (
  password: string,
  hash: string,
  salt: string
): Promise<boolean> => {
  if (!password || !hash || !salt) return false;
  try {
    const derived = await scrypt(password, salt, KEY_LENGTH);
    const expected = Buffer.from(hash, 'hex');
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
};

const b64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromB64url = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Token de sessão assinado (HMAC-SHA256). Formato: <payload>.<assinatura>.
 * Não é criptografado — o payload é legível — então só carrega id, e-mail e
 * expiração, nunca dado sensível.
 */
export const signSession = (
  payload: Record<string, unknown>,
  secret: string
): string => {
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${signature}`;
};

export const verifySession = <T = Record<string, unknown>>(
  token: string,
  secret: string
): T | null => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = createHmac('sha256', secret).update(body).digest();
  const received = fromB64url(signature);
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(fromB64url(body).toString('utf8'));
    if (typeof parsed?.exp === 'number' && Date.now() > parsed.exp) return null;
    return parsed as T;
  } catch {
    return null;
  }
};

export const randomToken = (bytes = 32): string =>
  randomBytes(bytes).toString('hex');
