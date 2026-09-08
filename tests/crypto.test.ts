import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  randomToken,
} from '../server/lib/crypto';

describe('hash de senha', () => {
  it('aceita a senha correta', async () => {
    const { hash, salt } = await hashPassword('senhaSegura123');
    expect(await verifyPassword('senhaSegura123', hash, salt)).toBe(true);
  });

  it('rejeita a senha errada', async () => {
    const { hash, salt } = await hashPassword('senhaSegura123');
    expect(await verifyPassword('senhaerrada', hash, salt)).toBe(false);
  });

  it('nunca guarda a senha em texto puro', async () => {
    const { hash, salt } = await hashPassword('senhaSegura123');
    expect(hash).not.toContain('senhaSegura123');
    expect(salt).not.toContain('senhaSegura123');
  });

  it('gera hashes diferentes para a mesma senha, por causa do salt', async () => {
    const a = await hashPassword('mesmasenha');
    const b = await hashPassword('mesmasenha');
    expect(a.hash).not.toBe(b.hash);
  });

  it('rejeita entradas vazias em vez de deixar passar', async () => {
    expect(await verifyPassword('', '', '')).toBe(false);
    expect(await verifyPassword('algo', 'abc', '')).toBe(false);
  });
});

describe('token de sessão', () => {
  const segredo = 'segredo-de-teste';

  it('valida um token que ele mesmo assinou', () => {
    const token = signSession({ sub: 'u-1', exp: Date.now() + 60_000 }, segredo);
    expect(verifySession<{ sub: string }>(token, segredo)?.sub).toBe('u-1');
  });

  it('rejeita token assinado com outro segredo', () => {
    const token = signSession({ sub: 'u-1', exp: Date.now() + 60_000 }, segredo);
    expect(verifySession(token, 'outro-segredo')).toBeNull();
  });

  it('rejeita token com o conteúdo adulterado', () => {
    const token = signSession({ sub: 'u-1', exp: Date.now() + 60_000 }, segredo);
    const [, assinatura] = token.split('.');
    const forjado =
      Buffer.from(JSON.stringify({ sub: 'u-admin', exp: Date.now() + 60_000 }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '') +
      '.' +
      assinatura;
    expect(verifySession(forjado, segredo)).toBeNull();
  });

  it('rejeita token expirado', () => {
    const token = signSession({ sub: 'u-1', exp: Date.now() - 1 }, segredo);
    expect(verifySession(token, segredo)).toBeNull();
  });

  it('rejeita entradas malformadas', () => {
    expect(verifySession('', segredo)).toBeNull();
    expect(verifySession('sem-ponto', segredo)).toBeNull();
    expect(verifySession('a.b.c', segredo)).toBeNull();
  });
});

describe('randomToken', () => {
  it('não repete entre chamadas', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken(16)));
    expect(tokens.size).toBe(50);
  });
});
