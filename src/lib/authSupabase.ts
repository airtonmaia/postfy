import { supabase } from './supabase';
import { workspaceDaLinha } from './mappers';
import type { Workspace, Role } from '../types';

/**
 * Autenticação via Supabase Auth.
 *
 * A sessão é gerida pelo SDK (renovação automática, persistência) e o JWT
 * resultante é o que a RLS enxerga como `auth.uid()`. Ou seja: a mesma sessão
 * que autentica é a que autoriza — não há um segundo sistema de permissão do
 * lado do cliente para contornar.
 */

export interface ResultadoAuth {
  sucesso: boolean;
  mensagem?: string;
  precisaConfirmarEmail?: boolean;
}

/** Mensagens do Supabase vêm em inglês; traduzimos as mais comuns. */
const traduzir = (mensagem: string): string => {
  const m = mensagem.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (m.includes('user already registered')) return 'Este e-mail já possui conta. Faça login ou recupere a senha.';
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('unable to validate email')) return 'Informe um e-mail válido.';
  if (m.includes('for security purposes')) return 'Aguarde alguns segundos antes de tentar de novo.';
  if (m.includes('email rate limit')) return 'Limite de envio de e-mails atingido. Tente mais tarde.';
  return mensagem;
};

export const entrar = async (email: string, senha: string): Promise<ResultadoAuth> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });
  if (error) return { sucesso: false, mensagem: traduzir(error.message) };
  return { sucesso: true };
};

/**
 * Cadastro: cria o usuário e, se já houver sessão, a agência.
 *
 * Quando a confirmação de e-mail está ligada no projeto, o signUp não devolve
 * sessão — sem sessão não há `auth.uid()`, e a RPC de criação da agência
 * recusaria. Nesse caso a agência é criada no primeiro login, por
 * garantirAgencia().
 */
export const cadastrar = async (input: {
  nome: string;
  email: string;
  senha: string;
  nomeDaAgencia?: string;
}): Promise<ResultadoAuth> => {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.senha,
    options: {
      // Guardado em user_metadata, que é editável pelo usuário — por isso é
      // usado só para exibição, nunca para decisão de permissão.
      data: {
        nome: input.nome.trim(),
        nome_da_agencia: (input.nomeDaAgencia || '').trim(),
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  if (error) return { sucesso: false, mensagem: traduzir(error.message) };

  if (!data.session) {
    return {
      sucesso: true,
      precisaConfirmarEmail: true,
      mensagem: 'Conta criada. Confirme o e-mail que enviamos para poder entrar.',
    };
  }

  const criada = await garantirAgencia();
  if (!criada.sucesso) return criada;

  return { sucesso: true };
};

/**
 * Garante que o usuário logado pertence a alguma agência.
 * Roda no primeiro login: cria a agência com o nome informado no cadastro.
 */
export const garantirAgencia = async (): Promise<ResultadoAuth> => {
  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao.session?.user;
  if (!usuario) return { sucesso: false, mensagem: 'Sessão não encontrada.' };

  const { data: membros, error: erroMembros } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .limit(1);

  if (erroMembros) {
    return { sucesso: false, mensagem: erroMembros.message };
  }
  if (membros && membros.length > 0) {
    return { sucesso: true };
  }

  const metadados = usuario.user_metadata || {};
  const nomeDaAgencia =
    (metadados.nome_da_agencia || '').trim() ||
    `Agência de ${(metadados.nome || usuario.email || 'nova conta').split('@')[0]}`;

  const { error } = await supabase.rpc('criar_agencia', {
    nome: nomeDaAgencia,
    nome_do_usuario: metadados.nome || null,
  });

  if (error) return { sucesso: false, mensagem: error.message };
  return { sucesso: true };
};

/** Cria uma agência adicional para quem já tem conta. */
export const criarAgencia = async (
  nome: string,
  nomeDoUsuario?: string
): Promise<{ sucesso: boolean; mensagem?: string; workspace?: Workspace }> => {
  const { data, error } = await supabase.rpc('criar_agencia', {
    nome,
    nome_do_usuario: nomeDoUsuario || null,
  });
  if (error) return { sucesso: false, mensagem: error.message };
  return { sucesso: true, workspace: data ? workspaceDaLinha(data) : undefined };
};

export const sair = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const enviarRecuperacaoDeSenha = async (email: string): Promise<ResultadoAuth> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/?recuperar=1`,
  });
  if (error) return { sucesso: false, mensagem: traduzir(error.message) };
  return {
    sucesso: true,
    mensagem: 'Se existir uma conta com este e-mail, o link de recuperação foi enviado.',
  };
};

export const definirNovaSenha = async (senha: string): Promise<ResultadoAuth> => {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { sucesso: false, mensagem: traduzir(error.message) };
  return { sucesso: true, mensagem: 'Senha atualizada.' };
};

export interface SessaoDoApp {
  userId: string;
  email: string;
  nome: string;
  avatar: string;
  role: Role;
  workspaceId: string;
}

/**
 * Sessão do ponto de vista do app: identidade do Supabase Auth + o vínculo
 * com a agência, que é onde mora o papel.
 */
export const carregarSessao = async (
  workspacePreferido?: string | null
): Promise<SessaoDoApp | null> => {
  const { data } = await supabase.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return null;

  const { data: membros, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', usuario.id);

  if (error || !membros || membros.length === 0) return null;

  const escolhido =
    membros.find((m: any) => m.workspace_id === workspacePreferido) || membros[0];

  const metadados = usuario.user_metadata || {};

  return {
    userId: usuario.id,
    email: usuario.email || '',
    nome: escolhido.name || metadados.nome || (usuario.email || '').split('@')[0],
    avatar: escolhido.avatar || metadados.avatar || '',
    // O papel vem da tabela de membros, nunca de user_metadata: metadados são
    // editáveis pelo próprio usuário e não servem para autorização.
    role: (escolhido.role || 'owner') as Role,
    workspaceId: escolhido.workspace_id,
  };
};

export const aoMudarAutenticacao = (
  callback: (temSessao: boolean) => void
): (() => void) => {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
    callback(Boolean(sessao));
  });
  return () => data.subscription.unsubscribe();
};
