import { describe, it, expect } from 'vitest';
import { ehIpBloqueado, validarUrlExterna } from '../server/lib/ssrf';

describe('classificação de endereços', () => {
  it('bloqueia loopback', () => {
    expect(ehIpBloqueado('127.0.0.1')).toBe(true);
    expect(ehIpBloqueado('127.1.2.3')).toBe(true);
    expect(ehIpBloqueado('::1')).toBe(true);
  });

  it('bloqueia as faixas privadas RFC1918', () => {
    expect(ehIpBloqueado('10.0.0.1')).toBe(true);
    expect(ehIpBloqueado('172.16.0.1')).toBe(true);
    expect(ehIpBloqueado('172.31.255.254')).toBe(true);
    expect(ehIpBloqueado('192.168.1.1')).toBe(true);
  });

  // O endereço de metadados da nuvem é o alvo mais valioso de um SSRF:
  // é de onde saem credenciais de instância.
  it('bloqueia link-local e metadados da nuvem', () => {
    expect(ehIpBloqueado('169.254.169.254')).toBe(true);
    expect(ehIpBloqueado('169.254.0.1')).toBe(true);
    expect(ehIpBloqueado('fe80::1')).toBe(true);
  });

  it('bloqueia CGNAT, multicast e reservadas', () => {
    expect(ehIpBloqueado('100.64.0.1')).toBe(true);
    expect(ehIpBloqueado('224.0.0.1')).toBe(true);
    expect(ehIpBloqueado('240.0.0.1')).toBe(true);
    expect(ehIpBloqueado('0.0.0.0')).toBe(true);
  });

  it('bloqueia IPv4 mapeado em IPv6, que reintroduziria as faixas internas', () => {
    expect(ehIpBloqueado('::ffff:127.0.0.1')).toBe(true);
    expect(ehIpBloqueado('::ffff:169.254.169.254')).toBe(true);
    expect(ehIpBloqueado('::ffff:10.0.0.1')).toBe(true);
  });

  it('bloqueia unique-local IPv6', () => {
    expect(ehIpBloqueado('fc00::1')).toBe(true);
    expect(ehIpBloqueado('fd12:3456::1')).toBe(true);
  });

  it('libera endereços públicos', () => {
    expect(ehIpBloqueado('8.8.8.8')).toBe(false);
    expect(ehIpBloqueado('1.1.1.1')).toBe(false);
    expect(ehIpBloqueado('172.15.0.1')).toBe(false); // logo antes da faixa privada
    expect(ehIpBloqueado('172.32.0.1')).toBe(false); // logo depois
    expect(ehIpBloqueado('2606:4700:4700::1111')).toBe(false);
  });

  it('bloqueia o que não é endereço reconhecível', () => {
    expect(ehIpBloqueado('nao-e-um-ip')).toBe(true);
    expect(ehIpBloqueado('')).toBe(true);
  });
});

describe('validação de URL de webhook', () => {
  it('recusa esquemas que não sejam http(s)', async () => {
    for (const url of ['file:///etc/passwd', 'gopher://x', 'ftp://x/y', 'data:text/plain,x']) {
      const r = await validarUrlExterna(url);
      expect(r.ok, url).toBe(false);
    }
  });

  it('recusa URL malformada', async () => {
    expect((await validarUrlExterna('nao é uma url')).ok).toBe(false);
    expect((await validarUrlExterna('')).ok).toBe(false);
  });

  it('recusa IP interno escrito direto na URL', async () => {
    for (const url of [
      'http://127.0.0.1/webhook',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5:8080/x',
      'http://192.168.0.1/',
      'http://[::1]:3000/',
    ]) {
      const r = await validarUrlExterna(url);
      expect(r.ok, url).toBe(false);
      expect(r.motivo).toContain('interna');
    }
  });

  it('recusa nomes internos', async () => {
    for (const url of ['http://localhost:3000/x', 'http://algo.internal/x']) {
      expect((await validarUrlExterna(url)).ok, url).toBe(false);
    }
  });

  // Credenciais embutidas costumam ser tentativa de confundir o parser de URL
  // (http://esperado.com@169.254.169.254/).
  it('recusa credenciais embutidas na URL', async () => {
    const r = await validarUrlExterna('http://usuario:senha@exemplo.com/hook');
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('credenciais');
  });

  it('aceita um destino público normal', async () => {
    const r = await validarUrlExterna('https://example.com/webhook');
    expect(r.ok).toBe(true);
  });
});
