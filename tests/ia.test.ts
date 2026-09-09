import { describe, it, expect } from 'vitest';
import { extrairJson, ErroDeIA } from '../api/_lib/ia';

/**
 * Mesmo pedindo JSON, modelos devolvem o objeto embrulhado de várias formas.
 * Como a camada é independente de fornecedor, ela precisa aguentar todas —
 * um modelo gratuito costuma ser menos disciplinado que um pago.
 */
describe('extração do JSON da resposta', () => {
  it('aceita JSON puro', () => {
    expect(extrairJson('{"caption":"oi"}')).toEqual({ caption: 'oi' });
  });

  it('aceita JSON com espaços e quebras em volta', () => {
    expect(extrairJson('\n\n  {"a":1}  \n')).toEqual({ a: 1 });
  });

  it('remove cerca de markdown', () => {
    expect(extrairJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recorta quando o modelo escreve um parágrafo antes', () => {
    const resposta = 'Claro! Aqui está o conteúdo:\n{"caption":"texto","hashtags":["#a"]}';
    expect(extrairJson(resposta)).toEqual({ caption: 'texto', hashtags: ['#a'] });
  });

  it('recorta quando há texto depois também', () => {
    const resposta = 'Segue:\n{"a":1}\nEspero ter ajudado!';
    expect(extrairJson(resposta)).toEqual({ a: 1 });
  });

  it('preserva objetos aninhados no recorte', () => {
    const resposta = 'Resultado:\n{"checklist":[{"item":"x","role":"designer"}]}\nfim';
    expect(extrairJson(resposta)).toEqual({
      checklist: [{ item: 'x', role: 'designer' }],
    });
  });

  it('acusa erro quando não há JSON algum', () => {
    expect(() => extrairJson('desculpe, não posso ajudar')).toThrow(ErroDeIA);
    expect(() => extrairJson('')).toThrow(ErroDeIA);
  });

  it('acusa erro quando o JSON está truncado', () => {
    expect(() => extrairJson('{"caption":"texto sem fecha')).toThrow(ErroDeIA);
  });
});
