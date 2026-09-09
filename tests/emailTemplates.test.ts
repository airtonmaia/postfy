import { describe, it, expect } from 'vitest';
import { preencher, VARIAVEIS_POR_EVENTO } from '../src/lib/emailTemplates';

/**
 * O preenchimento de variáveis é onde um e-mail vai para o cliente final com
 * "Olá, {{cliente}}" no corpo. Vale testar os casos chatos, não o feliz.
 */
describe('preenchimento das variáveis', () => {
  it('substitui o que foi informado', () => {
    expect(preencher('Olá, {{cliente}}', { cliente: 'Airton' })).toBe('Olá, Airton');
  });

  it('substitui a mesma variável mais de uma vez', () => {
    expect(preencher('{{a}} e {{a}}', { a: 'x' })).toBe('x e x');
  });

  // Melhor um espaço vazio do que a chave crua aparecendo para o cliente.
  it('apaga a variável que ninguém preencheu', () => {
    expect(preencher('Olá, {{cliente}}!', {})).toBe('Olá, !');
  });

  it('não mexe em texto sem variável', () => {
    expect(preencher('Sem variáveis aqui', { cliente: 'x' })).toBe('Sem variáveis aqui');
  });

  it('ignora chave desconhecida no valor', () => {
    expect(preencher('{{titulo}}', { titulo: 'Post', sobrando: 'y' })).toBe('Post');
  });

  // Um valor com cara de variável não pode virar substituição em cascata.
  it('não reprocessa o que acabou de inserir', () => {
    expect(preencher('{{a}}', { a: '{{b}}', b: 'nunca' })).toBe('{{b}}');
  });
});

describe('variáveis oferecidas por evento', () => {
  it('só o pedido de ajuste oferece o feedback', () => {
    // Prometer {{feedback}} onde o gatilho não tem feedback produz e-mail
    // com buraco no texto.
    const comFeedback = Object.entries(VARIAVEIS_POR_EVENTO)
      .filter(([, vars]) => vars.includes('{{feedback}}'))
      .map(([evento]) => evento);

    expect(comFeedback).toEqual(['pedido_de_ajuste']);
  });

  it('todo evento oferece pelo menos o link', () => {
    for (const [evento, vars] of Object.entries(VARIAVEIS_POR_EVENTO)) {
      expect(vars, evento).toContain('{{link}}');
    }
  });
});
