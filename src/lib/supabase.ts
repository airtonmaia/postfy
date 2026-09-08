/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase — autenticação e banco.
 *
 * A URL e a chave publicável abaixo são valores públicos por definição: elas
 * vão para o bundle e ficam visíveis no navegador de qualquer visitante. O que
 * protege os dados é a RLS (ver supabase/migrations), não o sigilo da chave.
 *
 * Por isso ficam embutidas como padrão, e não como segredo obrigatório: sem
 * isso, todo deploy novo (preview da Vercel incluído) subiria com o app
 * inoperante até alguém preencher variável de ambiente. As variáveis
 * continuam valendo e sobrepõem o padrão, para apontar outro projeto.
 *
 * A chave `service_role` NUNCA entra aqui: ela ignora a RLS e só existe no
 * servidor.
 */

const PROJETO_PADRAO = {
  url: 'https://ietpfqqeattymgbqmonq.supabase.co',
  // Chave publicável (sb_publishable_...), recomendada no lugar da anon legada.
  publishableKey: 'sb_publishable_RHh5a7HrkRxos3CvubjNxg_67IEsCDo',
};

const env = (import.meta as any).env || {};

export const supabaseUrl: string =
  env.VITE_SUPABASE_URL || PROJETO_PADRAO.url;

export const supabaseKey: string =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  PROJETO_PADRAO.publishableKey;

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://'));

/**
 * Instância única. Mais de um cliente na mesma página disputa o mesmo registro
 * de sessão no storage e gera renovação de token concorrente.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Necessário para o link de recuperação de senha e o de convite, que
    // chegam com o token no fragmento da URL.
    flowType: 'pkce',
  },
});

export const getSupabaseClient = (): SupabaseClient => supabase;
