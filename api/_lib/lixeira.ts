import { apagarPrefixo } from './r2.js';

/**
 * Apaga uma agência de vez: arquivos no R2, depois a linha no banco.
 *
 * Nessa ordem, e não a outra. Se apagasse a linha primeiro e o R2 falhasse
 * depois, a agência já teria sumido de toda consulta — inclusive da fila
 * que este mesmo processo usa para encontrar quem falta apagar — e os
 * arquivos ficariam órfãos para sempre, sem ninguém para tentar de novo.
 *
 * `apagarPrefixo` sobe qualquer erro de verdade do R2; esta função não
 * engole isso. Quem chama (o expurgo diário ou a exclusão imediata do admin)
 * decide o que fazer com a falha — mas nenhum dos dois apaga a linha do
 * banco se os arquivos não confirmarem apagados.
 *
 * O banco fica por último porque ele é quem tem `on delete cascade`: apagar
 * a linha de `workspaces` já leva junto clientes, jobs, leads, propostas,
 * contratos, automações, notificações, squads, convites, planos, conexões
 * sociais, fila de publicação e logs — as 16 tabelas que referenciam
 * `workspace_id`. Nenhuma precisa ser apagada à mão aqui.
 */
export const apagarAgenciaDeVez = async (
  supabase: any,
  workspaceId: string
): Promise<{ arquivosApagados: number }> => {
  const arquivosApagados = await apagarPrefixo(`${workspaceId}/`);

  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
  if (error) throw new Error(error.message);

  return { arquivosApagados };
};
