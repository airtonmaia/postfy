/**
 * Regras de recorte por workspace.
 *
 * Isolado num módulo próprio porque foi aqui que nasceu a perda de dados: o
 * estado era inicializado já filtrado pelo workspace atual e o efeito de
 * persistência gravava esse array filtrado por cima do conjunto completo,
 * apagando os registros das outras agências na primeira renderização.
 */

export interface ComWorkspace {
  workspaceId?: string;
}

/**
 * Registros sem workspaceId são considerados do workspace atual: são dados
 * legados, anteriores ao multi-tenant, e sumiriam da tela se fossem excluídos.
 */
export const belongsToWorkspace = <T extends ComWorkspace>(
  row: T,
  workspaceId: string
): boolean => !row.workspaceId || row.workspaceId === workspaceId;

export const filterByWorkspace = <T extends ComWorkspace>(
  rows: T[],
  workspaceId: string
): T[] => rows.filter((row) => belongsToWorkspace(row, workspaceId));

/**
 * Troca as linhas de um workspace preservando as dos demais.
 * É a operação que faltava: substituir o conjunto completo pelo recorte
 * destruía o que pertencia às outras agências.
 */
export const mergeWorkspaceRows = <T extends ComWorkspace>(
  todas: T[],
  workspaceId: string,
  novas: T[]
): T[] => [
  ...todas.filter((row) => row.workspaceId && row.workspaceId !== workspaceId),
  ...novas.map((row) => ({ ...row, workspaceId })),
];
