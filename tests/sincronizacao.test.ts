import { describe, it, expect } from 'vitest';
import { diferenciar, temMudanca, novoId } from '../src/lib/sincronizacao';

describe('diferenciar coleções', () => {
  const a = { id: '1', nome: 'A' };
  const b = { id: '2', nome: 'B' };

  it('detecta inserção', () => {
    const d = diferenciar([a], [a, b]);
    expect(d.inseridos.map((x) => x.id)).toEqual(['2']);
    expect(d.atualizados).toEqual([]);
    expect(d.removidos).toEqual([]);
  });

  it('detecta remoção', () => {
    const d = diferenciar([a, b], [a]);
    expect(d.removidos).toEqual(['2']);
    expect(d.inseridos).toEqual([]);
  });

  it('detecta alteração de conteúdo', () => {
    const d = diferenciar([a], [{ id: '1', nome: 'A editado' }]);
    expect(d.atualizados.map((x) => x.id)).toEqual(['1']);
    expect(d.inseridos).toEqual([]);
    expect(d.removidos).toEqual([]);
  });

  it('não reporta mudança quando nada mudou', () => {
    const d = diferenciar([a, b], [{ ...a }, { ...b }]);
    expect(temMudanca(d)).toBe(false);
  });

  // Reordenar não é mudança de dado: se contasse, arrastar um card no Kanban
  // dispararia update de todas as linhas.
  it('ignora mudança de ordem', () => {
    const d = diferenciar([a, b], [b, a]);
    expect(temMudanca(d)).toBe(false);
  });

  it('detecta alteração em campo aninhado', () => {
    const antes = [{ id: '1', checklist: [{ id: 'c1', feito: false }] }];
    const depois = [{ id: '1', checklist: [{ id: 'c1', feito: true }] }];
    expect(diferenciar(antes, depois).atualizados).toHaveLength(1);
  });

  it('lida com as três operações de uma vez', () => {
    const antes = [a, b, { id: '3', nome: 'C' }];
    const depois = [{ id: '1', nome: 'A2' }, { id: '4', nome: 'D' }, b];
    const d = diferenciar(antes, depois);
    expect(d.atualizados.map((x) => x.id)).toEqual(['1']);
    expect(d.inseridos.map((x) => x.id)).toEqual(['4']);
    expect(d.removidos).toEqual(['3']);
  });

  it('trata coleções vazias', () => {
    expect(temMudanca(diferenciar([], []))).toBe(false);
    expect(diferenciar([], [a]).inseridos).toHaveLength(1);
    expect(diferenciar([a], []).removidos).toEqual(['1']);
  });
});

describe('novoId', () => {
  it('gera identificador no formato uuid', () => {
    expect(novoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('não repete', () => {
    const ids = new Set(Array.from({ length: 200 }, () => novoId()));
    expect(ids.size).toBe(200);
  });
});
