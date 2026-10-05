import { describe, it, expect } from 'vitest';

import { numerosDoPerfil, tipoDeContaLegivel, type ContaConectada } from '../src/lib/redes';

/**
 * Os números do perfil conectado.
 *
 * **São puros, então têm teste de comportamento, não de fonte.** A regra que
 * eles carregam é a mesma do alcance em Relatórios, e é a que mais engana
 * quando quebra: *nulo é "não medi", zero é "medi e deu zero"*.
 *
 * O estrago de confundir os dois é específico e caro. A agência abre a ficha
 * do cliente justamente para conferir que conectou a conta certa — e
 * `0 seguidores` numa leitura que falhou faz ela concluir que conectou uma
 * conta morta, ou que o perfil do cliente está vazio. Nos dois casos ela age
 * sobre um número que ninguém mediu.
 */

const conta = (campos: Partial<ContaConectada>): ContaConectada => ({
  id: 'c1',
  workspaceId: 'w1',
  platform: 'instagram',
  accountId: '1',
  accountName: 'teste',
  createdAt: '2026-01-01T00:00:00Z',
  ...campos,
});

describe('os números do perfil', () => {
  it('não medido não vira linha nenhuma', () => {
    expect(numerosDoPerfil(conta({}))).toEqual([]);
  });

  it('zero medido aparece, e é diferente de não medido', () => {
    /*
      Perfil novo tem zero publicações de verdade, e esconder isso seria o erro
      espelhado: a tela deixaria de mostrar algo que foi medido. A comparação
      é `!= null`, nunca a verdade do valor.
    */
    expect(numerosDoPerfil(conta({ seguidores: 0, publicacoes: 0 }))).toEqual([
      '0 seguidores',
      '0 publicações',
    ]);
  });

  it('cada número entra sozinho quando só ele existe', () => {
    // A Página do Facebook traz seguidores e não traz publicações. Juntar os
    // dois num texto fixo faria a tela afirmar um que não veio.
    expect(numerosDoPerfil(conta({ seguidores: 1234 }))).toEqual(['1.234 seguidores']);
    expect(numerosDoPerfil(conta({ publicacoes: 42 }))).toEqual(['42 publicações']);
  });

  it('milhar sai no formato de quem lê', () => {
    expect(numerosDoPerfil(conta({ seguidores: 14800 }))[0]).toBe('14.800 seguidores');
  });
});

describe('o tipo de conta', () => {
  it('traduz o que a Meta manda em caixa alta', () => {
    expect(tipoDeContaLegivel('BUSINESS')).toBe('Conta comercial');
    expect(tipoDeContaLegivel('MEDIA_CREATOR')).toBe('Criador de conteúdo');
  });

  it('ausente é ausente, nunca um rótulo inventado', () => {
    // A linha some. Escrever "Conta pessoal" aqui afirmaria um tipo que a Meta
    // não disse — e é justamente o tipo que impede publicar.
    expect(tipoDeContaLegivel(undefined)).toBeUndefined();
    expect(tipoDeContaLegivel('')).toBeUndefined();
  });

  it('tipo desconhecido vira texto legível em vez de sumir', () => {
    // Categoria nova da Meta aparecendo como "Media Something" é melhor que a
    // linha inteira desaparecer sem ninguém notar.
    expect(tipoDeContaLegivel('MEDIA_SOMETHING')).toBe('MEDIA SOMETHING');
  });
});
