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
 *
 * `criarAgenciaPropria: false` é o caso do convite, e existe por um bug real:
 * quem se cadastrava pelo link do convite ganhava uma agência própria antes
 * de o vínculo ser criado, ficava em duas, e caía na errada ao entrar. Quem
 * chega por convite tem agência — a de quem convidou.
 */
export const cadastrar = async (input: {
  nome: string;
  email: string;
  senha: string;
  nomeDaAgencia?: string;
  criarAgenciaPropria?: boolean;
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

  if (input.criarAgenciaPropria === false) return { sucesso: true };

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

  // Quem tem convite pendente já tem agência: a de quem convidou.
  //
  // Sem esta pergunta, o convidado que confirma o e-mail e entra pela tela de
  // login normal ganha uma agência própria no caminho, aceita o convite
  // depois, e acaba em duas — caindo na vazia. Ver a migração
  // 20260909110000_convite_antes_de_agencia.sql.
  const { data: temConvite, error: erroConvite } = await supabase.rpc(
    'tenho_convite_pendente'
  );
  if (erroConvite) {
    // Na dúvida, não cria: uma agência a menos se resolve abrindo o convite;
    // uma agência a mais fica para sempre na lista da pessoa.
    return { sucesso: false, mensagem: erroConvite.message };
  }
  if (temConvite) {
    // Não dá para aceitar por aqui: o token só existe no link, e é ele que
    // prova o convite. Então a tela diz o que falta, em vez de deixar a
    // pessoa numa sessão sem agência nenhuma — que é o que acontecia.
    return {
      sucesso: false,
      mensagem:
        'Você tem um convite esperando. Abra o link que recebeu por e-mail para entrar na agência.',
    };
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
  /**
   * Dono do SaaS, não dono de agência.
   *
   * São eixos diferentes e estavam confundidos: `role` diz o que a pessoa faz
   * dentro de uma agência, e todo mundo que se cadastra vira `owner` da sua.
   * Isto aqui vem da tabela platform_admins, que a RLS também consulta —
   * então esconder o menu e proteger o dado usam a mesma fonte.
   */
  ehAdminDaPlataforma: boolean;
}

/**
 * Pergunta ao banco se o usuário administra a plataforma.
 *
 * A RLS de platform_admins só deixa um admin enxergar a tabela, então para
 * quem não é a consulta volta vazia — que é exatamente a resposta certa.
 */
const consultarAdminDaPlataforma = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Na dúvida, não é admin. Um erro de rede não pode abrir o menu.
    console.warn('[auth] não foi possível verificar admin da plataforma:', error.message);
    return false;
  }
  return Boolean(data);
};

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

  // Ordem explícita porque o fallback é o primeiro da lista: sem `order`, o
  // Postgres não promete ordem nenhuma, e a agência inicial podia mudar de
  // uma recarga para a outra em quem participa de mais de uma.
  const { data: membros, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', usuario.id)
    .order('created_at', { ascending: true });

  if (error || !membros || membros.length === 0) return null;

  const escolhido =
    membros.find((m: any) => m.workspace_id === workspacePreferido) || membros[0];

  const metadados = usuario.user_metadata || {};
  const ehAdminDaPlataforma = await consultarAdminDaPlataforma(usuario.id);

  return {
    userId: usuario.id,
    email: usuario.email || '',
    nome: escolhido.name || metadados.nome || (usuario.email || '').split('@')[0],
    avatar: escolhido.avatar || metadados.avatar || '',
    // O papel vem da tabela de membros, nunca de user_metadata: metadados são
    // editáveis pelo próprio usuário e não servem para autorização.
    role: (escolhido.role || 'owner') as Role,
    workspaceId: escolhido.workspace_id,
    ehAdminDaPlataforma,
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

// ============================================================
// Convites de equipe
// ============================================================

export interface ConvitePendente {
  id: string;
  workspaceId: string;
  email: string;
  name?: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

export interface DadosDoConvite {
  email: string;
  name: string | null;
  role: string;
  agencia: string | null;
}

export const listarConvites = async (): Promise<ConvitePendente[]> => {
  const { data, error } = await supabase
    .from('invites')
    .select('id, workspace_id, email, name, role, created_at, expires_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    id: l.id,
    workspaceId: l.workspace_id,
    email: l.email,
    name: l.name ?? undefined,
    role: l.role as Role,
    createdAt: l.created_at,
    expiresAt: l.expires_at,
  }));
};

/** O token só é devolvido nesta chamada; depois nem o dono consegue lê-lo. */
export const criarConvite = async (input: {
  workspaceId: string;
  email: string;
  role: Role;
  nome?: string;
}): Promise<{ token: string; convite: ConvitePendente }> => {
  const { data, error } = await supabase.rpc('criar_convite', {
    agencia: input.workspaceId,
    email_convidado: input.email,
    papel: input.role,
    nome_convidado: input.nome || null,
  });

  if (error) throw new Error(error.message);

  return {
    token: data.token,
    convite: {
      id: data.id,
      workspaceId: data.workspace_id,
      email: data.email,
      name: data.name ?? undefined,
      role: data.role as Role,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    },
  };
};

export interface SituacaoDoConvidado {
  temConta: boolean;
  jaEMembro: boolean;
  convitePendente: boolean;
}

/**
 * O que a tela precisa saber antes de convidar.
 *
 * Quem já tem conta não precisa de link: entra com a senha que já tem e só
 * aceita o cargo. Quem já é membro não precisa de convite nenhum.
 */
export const situacaoDoConvidado = async (
  workspaceId: string,
  email: string
): Promise<SituacaoDoConvidado> => {
  const { data, error } = await supabase.rpc('situacao_do_convidado', {
    agencia: workspaceId,
    email_convidado: email,
  });
  if (error) throw new Error(error.message);

  const bruto = (data as any) || {};
  return {
    temConta: Boolean(bruto.tem_conta),
    jaEMembro: Boolean(bruto.ja_e_membro),
    convitePendente: Boolean(bruto.convite_pendente),
  };
};

export const revogarConvite = async (id: string): Promise<void> => {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const buscarConvitePorToken = async (token: string): Promise<DadosDoConvite | null> => {
  const { data, error } = await supabase.rpc('convite_por_token', { t: token });
  if (error) throw new Error(error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return linha ? { email: linha.email, name: linha.name, role: linha.role, agencia: linha.agencia } : null;
};

/**
 * Aceite do convite.
 *
 * Exige sessão: o convidado primeiro cria a conta (ou entra, se já tiver) com
 * o mesmo e-mail do convite, e só então o vínculo é criado. A RPC confere que
 * o e-mail da sessão bate com o do convite — ter o link não basta.
 */
export const aceitarConvite = async (
  token: string,
  nomeDoUsuario?: string
): Promise<ResultadoAuth & { workspaceId?: string }> => {
  const { data, error } = await supabase.rpc('aceitar_convite', {
    t: token,
    nome_do_usuario: nomeDoUsuario || null,
  });
  if (error) return { sucesso: false, mensagem: traduzir(error.message) };

  // A agência do convite vira a agência da vez. Quem já tinha outra caía na
  // antiga depois de aceitar, e o convite parecia não ter funcionado.
  const linha = Array.isArray(data) ? data[0] : data;
  return { sucesso: true, workspaceId: linha?.id };
};

/** Membros da agência, para a tela de equipe. */
export interface MembroDaEquipe {
  userId: string;
  workspaceId: string;
  role: Role;
  name?: string;
  avatar?: string;
  ativo: boolean;
}

/**
 * Equipe de UMA agência.
 *
 * O filtro por `workspaceId` não é redundante com a RLS: ela deixa ler os
 * membros de todas as agências às quais a pessoa pertence, então sem o
 * recorte a tela de Usuários misturava as equipes de agências diferentes na
 * mesma lista.
 */
export const listarEquipe = async (workspaceId: string): Promise<MembroDaEquipe[]> => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    userId: l.user_id,
    workspaceId: l.workspace_id,
    role: l.role as Role,
    name: l.name ?? undefined,
    avatar: l.avatar ?? undefined,
    ativo: l.ativo ?? true,
  }));
};

/**
 * Papel, nome e acesso de um membro.
 *
 * Quem pode o quê é decidido no banco: a política deixa só owner/admin
 * escrever, e o trigger `membro_editado` recusa auto-promoção, rebaixar o
 * dono sem ser dono, e deixar a agência sem nenhum dono ativo.
 */
export const atualizarMembro = async (
  workspaceId: string,
  userId: string,
  mudancas: { role?: Role; ativo?: boolean; name?: string }
): Promise<void> => {
  const linha: Record<string, unknown> = {};
  if (mudancas.role !== undefined) linha.role = mudancas.role;
  if (mudancas.ativo !== undefined) linha.ativo = mudancas.ativo;
  if (mudancas.name !== undefined) linha.name = mudancas.name;
  if (Object.keys(linha).length === 0) return;

  const { error } = await supabase
    .from('workspace_members')
    .update(linha)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};

export interface VinculoDeAgencia {
  workspaceId: string;
  nome: string;
  papel: Role;
  ativo: boolean;
}

export interface UsuarioDoSaas {
  userId: string;
  email: string;
  nome?: string;
  criadoEm: string;
  ultimoAcesso?: string;
  emailConfirmado: boolean;
  adminDaPlataforma: boolean;
  agencias: VinculoDeAgencia[];
}

/**
 * Todos os usuários do produto, com os vínculos de cada um.
 *
 * Passa por RPC porque nem `auth.users` nem os vínculos de agências alheias
 * são alcançáveis por consulta direta: a primeira não é exposta ao PostgREST,
 * e a segunda é recortada por `private.e_membro`. Quem administra o produto
 * não é membro das agências dos clientes.
 *
 * A RPC recusa quem não está em `platform_admins` — com 42501, não com uma
 * lista vazia.
 */
export const listarUsuariosDoSaas = async (): Promise<UsuarioDoSaas[]> => {
  const { data, error } = await supabase.rpc('admin_usuarios_do_saas');
  if (error) throw new Error(error.message);

  return ((data as any[]) || []).map((u) => ({
    userId: u.user_id,
    email: u.email ?? '',
    nome: u.nome ?? undefined,
    criadoEm: u.criado_em,
    ultimoAcesso: u.ultimo_acesso ?? undefined,
    emailConfirmado: Boolean(u.email_confirmado),
    adminDaPlataforma: Boolean(u.admin_da_plataforma),
    agencias: (u.agencias || []).map((a: any) => ({
      workspaceId: a.workspace_id,
      nome: a.nome,
      papel: a.papel as Role,
      ativo: a.ativo ?? true,
    })),
  }));
};

export const removerMembro = async (workspaceId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
};
