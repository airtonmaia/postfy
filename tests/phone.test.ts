import { describe, it, expect } from 'vitest';
import { mesmoTelefone, variacoesDoNumero, somenteDigitos } from '../src/lib/phone';

describe('comparação de telefone no portal do cliente', () => {
  it('reconhece o mesmo número com formatações diferentes', () => {
    expect(mesmoTelefone('(11) 98765-4321', '11987654321')).toBe(true);
    expect(mesmoTelefone('+55 11 98765-4321', '(11) 98765-4321')).toBe(true);
    expect(mesmoTelefone('11 9 8765 4321', '5511987654321')).toBe(true);
  });

  it('tolera a ausência do nono dígito', () => {
    expect(mesmoTelefone('(11) 98765-4321', '1187654321')).toBe(true);
    expect(mesmoTelefone('1187654321', '11987654321')).toBe(true);
  });

  it('não casa números diferentes', () => {
    expect(mesmoTelefone('(11) 98765-4321', '(11) 91111-2222')).toBe(false);
    expect(mesmoTelefone('(11) 98765-4321', '(21) 98765-4321')).toBe(false);
  });

  // Este é o caso que abria o portal do cliente errado: a implementação antiga
  // usava a.includes(b) || b.includes(a).
  it('não casa por pedaço do número', () => {
    expect(mesmoTelefone('(11) 98765-4321', '999')).toBe(false);
    expect(mesmoTelefone('(11) 98765-4321', '4321')).toBe(false);
    expect(mesmoTelefone('(11) 98765-4321', '11')).toBe(false);
    expect(mesmoTelefone('(11) 98765-4321', '8765')).toBe(false);
  });

  it('trata entradas vazias como não correspondentes', () => {
    expect(mesmoTelefone('', '')).toBe(false);
    expect(mesmoTelefone('(11) 98765-4321', '')).toBe(false);
  });

  it('extrai apenas os dígitos', () => {
    expect(somenteDigitos('+55 (11) 98765-4321')).toBe('5511987654321');
    expect(variacoesDoNumero('')).toEqual([]);
  });
});
