import { supabase } from './supabase';

/**
 * Preferências do usuário, guardadas no Postgres.
 *
 * Antes viviam no localStorage, o que prendia a preferência a um navegador:
 * quem entrava pelo celular pegava o tema claro e caía na primeira agência da
 * lista, sempre. Aqui a linha é do usuário, então segue com ele.
 *
 * Nada aqui é crítico: se a gravação falhar, a tela continua funcionando com
 * o valor em memória. Por isso os erros são registrados e não propagados —
 * derrubar a interface porque o tema não salvou seria pior que o problema.
 */

export interface Preferencias {
  theme: 'light' | 'dark';
  lastWorkspaceId: string | null;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  theme: 'light',
  lastWorkspaceId: null,
};

export const carregarPreferencias = async (): Promise<Preferencias> => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('theme, last_workspace_id')
    .maybeSingle();

  if (error) {
    console.warn('[preferencias] não foi possível ler:', error.message);
    return PREFERENCIAS_PADRAO;
  }
  if (!data) return PREFERENCIAS_PADRAO;

  return {
    theme: data.theme === 'dark' ? 'dark' : 'light',
    lastWorkspaceId: data.last_workspace_id ?? null,
  };
};

/**
 * Grava só o que mudou.
 *
 * O upsert precisa do user_id: a RLS confere `user_id = auth.uid()`, e sem a
 * coluna preenchida o insert é recusado. Ele vem da sessão, não de parâmetro,
 * para não existir caminho onde a tela peça para gravar no nome de outro.
 */
export const salvarPreferencias = async (mudancas: Partial<Preferencias>): Promise<void> => {
  const { data: sessao } = await supabase.auth.getSession();
  const userId = sessao.session?.user?.id;
  if (!userId) return;

  const linha: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (mudancas.theme !== undefined) linha.theme = mudancas.theme;
  if (mudancas.lastWorkspaceId !== undefined) linha.last_workspace_id = mudancas.lastWorkspaceId;

  const { error } = await supabase.from('user_settings').upsert(linha, { onConflict: 'user_id' });

  if (error) {
    console.warn('[preferencias] não foi possível gravar:', error.message);
  }
};
