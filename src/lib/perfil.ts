import { supabase } from './supabase';

/**
 * O perfil da pessoa: nome, foto, e-mail e senha.
 *
 * Nome e foto ficam em dois lugares, e não por descuido:
 *
 *   - `auth.users.raw_user_meta_data` é o registro da **pessoa**, e viaja com
 *     ela para qualquer agência que a convide depois;
 *   - `workspace_members.name` / `.avatar` é o que cada agência enxerga da
 *     equipe dela — é dessa coluna que a lista de membros, o kanban e o
 *     seletor leem.
 *
 * Gravar só nos metadados deixaria a tela de equipe mostrando o nome antigo
 * para os colegas, para sempre. Gravar só no vínculo perderia o nome na
 * próxima agência. Então vão os dois, e a RLS permite: existe a política
 * "membro edita o proprio perfil" (`user_id = auth.uid()`), e o trigger
 * `membro_editado` recusa mudança de `role` e `ativo` na própria linha — quem
 * edita o perfil não consegue se promover por tabela.
 *
 * Metadado serve para **exibir**, nunca para autorizar: o papel continua
 * vindo da sessão, como diz a convenção do projeto.
 */

export interface DadosDoPerfil {
  nome: string;
  avatar: string;
}

/**
 * Salva nome e foto.
 *
 * Devolve em quantos vínculos a mudança pegou. A tela usa isso para dizer a
 * verdade: "atualizado em 2 agências" é diferente de "salvo", que esconderia
 * o caso de o update ter passado sem tocar linha nenhuma.
 */
export const salvarPerfil = async (dados: DadosDoPerfil): Promise<{ vinculos: number }> => {
  const nome = dados.nome.trim();
  const avatar = dados.avatar.trim();

  if (nome.length < 2) {
    throw new Error('O nome precisa ter pelo menos 2 caracteres.');
  }
  if (avatar && !/^(https?:\/\/|\/)/.test(avatar)) {
    // Este valor vai para `src` de <img>. `javascript:` num src é execução.
    throw new Error('O endereço da foto precisa começar com https:// ou /.');
  }

  const { data: sessao } = await supabase.auth.getSession();
  const userId = sessao.session?.user?.id;
  if (!userId) throw new Error('Sua sessão expirou. Entre de novo para salvar.');

  const { error: erroMeta } = await supabase.auth.updateUser({
    // `name` e `full_name` porque `carregarSessao` lê os dois: contas antigas
    // gravaram num, o cadastro atual grava no outro.
    data: { name: nome, full_name: nome, nome, avatar },
  });
  if (erroMeta) throw new Error(erroMeta.message);

  const { data, error } = await supabase
    .from('workspace_members')
    .update({ name: nome, avatar: avatar || null })
    .eq('user_id', userId)
    .select('workspace_id');

  if (error) throw new Error(error.message);
  return { vinculos: (data || []).length };
};

/**
 * Troca a senha, exigindo a atual.
 *
 * O Supabase deixa trocar só com a sessão aberta, sem pedir a senha antiga.
 * Aqui ela é pedida de propósito: uma aba esquecida aberta num computador
 * compartilhado é o caso comum, e sem essa pergunta quem senta na frente dela
 * troca a senha e toma a conta — sem precisar saber nada.
 *
 * A conferência é feita entrando de novo com a senha informada, que é a única
 * forma de o cliente provar isso. `signInWithPassword` renova a sessão em vez
 * de derrubá-la, então a pessoa continua onde estava.
 */
export const alterarSenha = async (
  senhaAtual: string,
  novaSenha: string
): Promise<void> => {
  if (novaSenha.length < 8) {
    throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
  }
  if (novaSenha === senhaAtual) {
    throw new Error('A nova senha é igual à atual.');
  }

  const { data: sessao } = await supabase.auth.getSession();
  const email = sessao.session?.user?.email;
  if (!email) throw new Error('Sua sessão expirou. Entre de novo para trocar a senha.');

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email,
    password: senhaAtual,
  });
  if (erroLogin) throw new Error('A senha atual não confere.');

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw new Error(error.message);
};

/**
 * Pede a troca de e-mail.
 *
 * **Não troca nada agora.** O Supabase manda um link de confirmação, e o
 * e-mail só muda quando ele for aberto — por isso a função devolve o endereço
 * para a tela dizer para onde a mensagem foi. Anunciar "e-mail alterado" aqui
 * seria mentira: quem não abrir o link continua entrando com o antigo.
 */
export const pedirTrocaDeEmail = async (novoEmail: string): Promise<string> => {
  const alvo = novoEmail.trim().toLowerCase();
  if (!alvo.includes('@') || alvo.length < 5) {
    throw new Error('Informe um e-mail válido.');
  }

  const { error } = await supabase.auth.updateUser({ email: alvo });
  if (error) throw new Error(error.message);
  return alvo;
};
