import { describe, it, expect } from 'vitest';
import { montarEstado, conferirEstado, assinarEstado } from '../api/social-connect';

/**
 * O `state` do OAuth carrega qual agência está conectando a conta.
 *
 * Sem assinatura, trocar o id no meio do caminho ligaria a conta de Instagram
 * de alguém a uma agência alheia — o jeito clássico de sequestrar uma conexão
 * OAuth. A verificação abaixo é a única coisa entre isso e o banco.
 */

const SEGREDO = 'segredo-de-teste-com-tamanho-razoavel';
const AGENCIA = 'dc5ed5e6-f499-4223-8277-deb96e1f56a5';
const USUARIO = 'aec361c3-5b6e-49b7-91e2-c6a776efaa74';

describe('estado assinado do OAuth', () => {
  it('vai e volta preservando agência e usuário', () => {
    const estado = montarEstado(AGENCIA, USUARIO, SEGREDO);
    expect(conferirEstado(estado, SEGREDO)).toEqual({
      workspaceId: AGENCIA,
      userId: USUARIO,
    });
  });

  // O cliente entra no estado porque no retorno não há sessão para conferir
  // nada: um `clientId` na query da volta seria escolhido por quem quisesse,
  // e ligaria a conta de um cliente ao perfil de outro.
  it('leva também de quem é a conta', () => {
    const CLIENTE = '6e5f2f2a-1f4b-4a2e-9f35-3b1a0d7c8e11';
    const estado = montarEstado(AGENCIA, USUARIO, SEGREDO, CLIENTE);
    expect(conferirEstado(estado, SEGREDO)).toEqual({
      workspaceId: AGENCIA,
      userId: USUARIO,
      clientId: CLIENTE,
    });
  });

  // Estado emitido antes de o cliente existir aqui: continua válido, e a
  // conexão fica sem cliente — que a tela mostra como "não publica".
  it('aceita estado antigo, de três campos', () => {
    const corpo = `${AGENCIA}.${USUARIO}.${Date.now()}`;
    const estado = `${Buffer.from(corpo).toString('base64url')}.${assinarEstado(corpo, SEGREDO)}`;
    expect(conferirEstado(estado, SEGREDO)).toEqual({
      workspaceId: AGENCIA,
      userId: USUARIO,
      clientId: undefined,
    });
  });

  it('recusa o cliente trocado no meio do caminho', () => {
    const CLIENTE = '6e5f2f2a-1f4b-4a2e-9f35-3b1a0d7c8e11';
    const estado = montarEstado(AGENCIA, USUARIO, SEGREDO, CLIENTE);
    const [corpoB64, assinatura] = estado.split('.');
    const corpo = Buffer.from(corpoB64, 'base64url').toString();

    const forjado = Buffer.from(
      corpo.replace(CLIENTE, '00000000-0000-4000-8000-000000000999')
    ).toString('base64url');

    expect(conferirEstado(`${forjado}.${assinatura}`, SEGREDO)).toBeNull();
  });

  it('recusa estado assinado com outro segredo', () => {
    const estado = montarEstado(AGENCIA, USUARIO, 'outro-segredo');
    expect(conferirEstado(estado, SEGREDO)).toBeNull();
  });

  // O ataque que importa: trocar a agência mantendo a assinatura original.
  it('recusa a agência trocada no meio do caminho', () => {
    const estado = montarEstado(AGENCIA, USUARIO, SEGREDO);
    const [, assinatura] = estado.split('.');

    const forjado = Buffer.from(
      `00000000-0000-4000-8000-000000000999.${USUARIO}.${Date.now()}`
    ).toString('base64url');

    expect(conferirEstado(`${forjado}.${assinatura}`, SEGREDO)).toBeNull();
  });

  it('recusa estado sem assinatura', () => {
    const corpo = Buffer.from(`${AGENCIA}.${USUARIO}.${Date.now()}`).toString('base64url');
    expect(conferirEstado(corpo, SEGREDO)).toBeNull();
  });

  it('recusa lixo', () => {
    for (const entrada of ['', '.', 'a.b', 'não-base64.assinatura']) {
      expect(conferirEstado(entrada, SEGREDO), entrada).toBeNull();
    }
  });

  // Um estado válido para sempre vira link de conexão reaproveitável.
  it('recusa estado vencido', () => {
    const corpo = `${AGENCIA}.${USUARIO}.${Date.now() - 60 * 60_000}`;
    const estado = `${Buffer.from(corpo).toString('base64url')}.${assinarEstado(corpo, SEGREDO)}`;

    expect(conferirEstado(estado, SEGREDO)).toBeNull();
    // E continua válido dentro de uma janela maior, provando que o que
    // reprovou foi a idade e não a assinatura.
    expect(conferirEstado(estado, SEGREDO, 2 * 60 * 60_000)).not.toBeNull();
  });

  it('a assinatura muda quando os dados mudam', () => {
    const a = assinarEstado('agencia-a.usuario.1', SEGREDO);
    const b = assinarEstado('agencia-b.usuario.1', SEGREDO);
    expect(a).not.toBe(b);
  });
});
