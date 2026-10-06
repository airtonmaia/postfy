import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';
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

/**
 * **Toda coleção do contexto passa pelo recorte — e a equipe era a exceção.**
 *
 * `listarMembros` lê `workspace_members` sem filtro, e a RLS devolve as linhas
 * de **todas** as agências de que a pessoa participa. Dez coleções passavam por
 * `belongsToWorkspace`; `users` não passava, e o efeito só aparece para quem
 * tem mais de uma agência: o seletor de "Quem está nesta peça" mostrava nove
 * nomes numa agência de quatro pessoas, com o mesmo nome três vezes — uma linha
 * por agência da mesma pessoa.
 *
 * A guarda é **derivada**: ela lista os `useState` que guardam o conjunto
 * completo (`allX`) e exige um recorte para cada um. Uma coleção nova sem
 * filtro reprova aqui sem ninguém editar o teste — lista literal teria de ser
 * mantida à mão, que é como uma guarda deixa de guardar.
 */
describe('nenhuma coleção do contexto escapa do recorte por agência', () => {
  const contexto = semComentarios(
    readFileSync(join(__dirname, '..', 'src', 'context', 'PostfyContext.tsx'), 'utf-8')
  );

  it('todo conjunto completo tem um recorte derivado dele', () => {
    const completos = [...contexto.matchAll(/const \[(all\w+), set\w+\] = useState/g)].map(
      (m) => m[1]
    );
    expect(completos.length, 'o contexto não guarda mais os conjuntos completos').toBeGreaterThan(5);

    const semRecorte = completos.filter(
      (nome) => !contexto.includes(`${nome}.filter(belongsToWorkspace)`)
    );

    expect(
      semRecorte,
      'uma coleção do contexto é entregue à tela com as linhas das outras agências dentro'
    ).toEqual([]);
  });
});
