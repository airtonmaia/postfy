import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extrairJson, ErroDeIA, configuracaoDaIA } from '../api/_lib/ia';

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

/**
 * A escolha do fornecedor mora só em variável de ambiente. Se o padrão mudar
 * sem querer, a IA passa a chamar outro endereço com a chave do OpenRouter e
 * o erro só aparece em produção, como 401.
 */
describe('escolha do fornecedor', () => {
  const original = { ...process.env };

  beforeEach(() => {
    for (const chave of ['IA_PROVEDOR', 'IA_API_KEY', 'IA_MODELO', 'IA_BASE_URL', 'GEMINI_API_KEY', 'GEMINI_MODEL']) {
      delete process.env[chave];
    }
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('sem IA_PROVEDOR, usa o OpenRouter', () => {
    process.env.IA_API_KEY = 'chave';
    const c = configuracaoDaIA();
    expect(c?.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(c?.modelo).toContain(':free');
  });

  it('manda os cabeçalhos de atribuição que o OpenRouter espera', () => {
    process.env.IA_API_KEY = 'chave';
    expect(configuracaoDaIA()?.cabecalhos).toMatchObject({ 'X-Title': 'Orquesia' });
  });

  it('não inventa configuração sem chave', () => {
    expect(configuracaoDaIA()).toBeNull();
  });

  it('respeita o fornecedor e o modelo informados', () => {
    process.env.IA_PROVEDOR = 'groq';
    process.env.IA_API_KEY = 'chave';
    process.env.IA_MODELO = 'llama-3.1-8b-instant';
    const c = configuracaoDaIA();
    expect(c?.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(c?.modelo).toBe('llama-3.1-8b-instant');
    expect(c?.cabecalhos).toBeUndefined();
  });

  it('endpoint customizado tem prioridade sobre o preset', () => {
    process.env.IA_PROVEDOR = 'openrouter';
    process.env.IA_API_KEY = 'chave';
    process.env.IA_BASE_URL = 'http://localhost:11434/v1/';
    expect(configuracaoDaIA()?.baseUrl).toBe('http://localhost:11434/v1');
  });

  it('fornecedor desconhecido não vira chamada às cegas', () => {
    process.env.IA_PROVEDOR = 'inexistente';
    process.env.IA_API_KEY = 'chave';
    expect(configuracaoDaIA()).toBeNull();
  });
});
