import { describe, it, expect } from 'vitest';
import {
  belongsToWorkspace,
  filterByWorkspace,
  mergeWorkspaceRows,
} from '../src/lib/workspaceScope';

const base = [
  { id: 'a', workspaceId: 'ws-1' },
  { id: 'b', workspaceId: 'ws-2' },
  { id: 'c', workspaceId: 'ws-1' },
  { id: 'legado' }, // sem workspaceId
];

describe('recorte por workspace', () => {
  it('inclui os registros do workspace e os legados sem workspaceId', () => {
    expect(filterByWorkspace(base, 'ws-1').map((r) => r.id)).toEqual(['a', 'c', 'legado']);
  });

  it('não vaza registros de outra agência', () => {
    const visiveis = filterByWorkspace(base, 'ws-2').map((r) => r.id);
    expect(visiveis).not.toContain('a');
    expect(visiveis).not.toContain('c');
  });

  it('trata ausência de workspaceId como pertencente ao workspace atual', () => {
    expect(belongsToWorkspace({}, 'qualquer')).toBe(true);
    expect(belongsToWorkspace({ workspaceId: 'ws-9' }, 'ws-1')).toBe(false);
  });
});

describe('gravação sem perder as outras agências', () => {
  // Regressão do bug que apagava dados: gravar o recorte por cima do conjunto
  // completo removia tudo que era das outras agências.
  it('preserva as linhas dos outros workspaces ao substituir as de um', () => {
    const resultado = mergeWorkspaceRows(base, 'ws-1', [{ id: 'novo', workspaceId: 'ws-1' }]);
    expect(resultado.find((r) => r.id === 'b')).toBeDefined();
    expect(resultado.find((r) => r.id === 'novo')).toBeDefined();
    expect(resultado.find((r) => r.id === 'a')).toBeUndefined();
  });

  it('carimba o workspace de destino, ignorando o que veio no registro', () => {
    const resultado = mergeWorkspaceRows(base, 'ws-1', [
      { id: 'invasor', workspaceId: 'ws-2' },
    ]);
    expect(resultado.find((r) => r.id === 'invasor')?.workspaceId).toBe('ws-1');
    // e a linha original de ws-2 continua lá
    expect(resultado.filter((r) => r.workspaceId === 'ws-2').map((r) => r.id)).toEqual(['b']);
  });

  it('esvaziar um workspace não afeta os demais', () => {
    const resultado = mergeWorkspaceRows(base, 'ws-1', []);
    expect(resultado.map((r) => r.id)).toEqual(['b']);
  });
});
